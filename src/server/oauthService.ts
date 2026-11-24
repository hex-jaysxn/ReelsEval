import type express from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import nodemailer from 'nodemailer';
import type { AuthProviderAvailability } from '../types/auth.ts';
import {
  decideOAuthResolution,
  escapeHtml,
  generateOpaqueToken,
  generatePkceChallenge,
  normalizeEmail,
  normalizeEmailFrom,
  parseSenderNameAndEmail,
  resolveEmailTransportConfig,
} from './authLogic.ts';
import type { AppDatabase, OAuthProviderName } from './db.ts';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export class OAuthConfigError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 503, code = 'OAUTH_NOT_CONFIGURED') {
    super(message);
    this.name = 'OAuthConfigError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function getAppBaseUrl(req: express.Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured && configured !== 'MY_APP_URL') {
    return configured.replace(/\/+$/, '');
  }
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)
    ?.split(',')[0]
    ?.trim();
  const proto = forwardedProto || (req.secure ? 'https' : 'http');
  const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)
    ?.split(',')[0]
    ?.trim();
  const host = forwardedHost || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

export function isPasswordResetEmailConfigured(): boolean {
  return Boolean(resolveEmailTransportConfig(process.env));
}

export function getAuthProviderAvailability(
  req: express.Request
): AuthProviderAvailability {
  const baseUrl = getAppBaseUrl(req);
  const emailConfigured = isPasswordResetEmailConfigured();
  return {
    googleConfigured: isGoogleOAuthConfigured(),
    emailOtpConfigured: emailConfigured,
    passwordResetEmailConfigured: emailConfigured,
    callbackUrls: {
      google: `${baseUrl}/api/auth/google/callback`,
    },
  };
}

export function buildGoogleAuthUrl(params: {
  req: express.Request;
  db: AppDatabase;
  mode: 'login' | 'link';
  sessionUserId: string | null;
}): string {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new OAuthConfigError(
      'Google Sign-In requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to be configured in server environment secrets.'
    );
  }

  const baseUrl = getAppBaseUrl(params.req);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  const nonce = generateOpaqueToken(16);
  const codeVerifier = generateOpaqueToken(32);
  const codeChallenge = generatePkceChallenge(codeVerifier);

  const state = params.db.createOAuthState({
    provider: 'google',
    mode: params.mode,
    userId: params.sessionUserId,
    nonce,
    codeVerifier,
    redirectUri,
  });

  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
}

export async function handleGoogleCallback(params: {
  code: string;
  state: string;
  db: AppDatabase;
}): Promise<{ userId: string; mode: 'login' | 'link' }> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new OAuthConfigError('Google OAuth is not configured on the server.');
  }

  const stateRecord = params.db.consumeOAuthState(params.state, 'google');
  if (!stateRecord) {
    throw new OAuthConfigError(
      'Invalid or expired Google Sign-In state. Please try signing in again.',
      400,
      'INVALID_OAUTH_STATE'
    );
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: stateRecord.redirect_uri,
      grant_type: 'authorization_code',
      code_verifier: stateRecord.code_verifier,
    }),
  });

  const tokenData = (await tokenRes.json().catch(() => null)) as {
    id_token?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!tokenRes.ok || !tokenData?.id_token) {
    throw new OAuthConfigError(
      tokenData?.error_description || 'Google token exchange failed.',
      401,
      'OAUTH_EXCHANGE_FAILED'
    );
  }

  const { payload } = await jwtVerify(tokenData.id_token, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientId,
  });

  if (payload.nonce !== stateRecord.nonce) {
    throw new OAuthConfigError('Google ID token nonce mismatch.', 401, 'INVALID_NONCE');
  }

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? normalizeEmail(payload.email) : '';
  const emailVerified = payload.email_verified === true;
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const picture = typeof payload.picture === 'string' ? payload.picture : null;

  if (!sub || !email) {
    throw new OAuthConfigError(
      'Google profile did not include required account identifiers.',
      400,
      'MISSING_PROFILE_CLAIMS'
    );
  }

  return completeOAuthIdentityResolution({
    db: params.db,
    provider: 'google',
    providerUserId: sub,
    email,
    emailVerified,
    name: name || email.split('@')[0],
    avatarUrl: picture,
    mode: stateRecord.mode,
    sessionUserId: stateRecord.user_id,
  });
}

function completeOAuthIdentityResolution(params: {
  db: AppDatabase;
  provider: OAuthProviderName;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string | null;
  mode: 'login' | 'link';
  sessionUserId: string | null;
}): { userId: string; mode: 'login' | 'link' } {
  const existingIdentity = params.db.findOAuthIdentity(
    params.provider,
    params.providerUserId
  );
  const existingEmailUser = params.db.getUserByEmail(params.email);

  const decision = decideOAuthResolution({
    existingIdentityUserId: existingIdentity?.user_id ?? null,
    existingEmailUserId: existingEmailUser?.id ?? null,
    emailVerified: params.emailVerified,
    mode: params.mode,
    sessionUserId: params.sessionUserId,
  });

  if (decision.action === 'error') {
    throw new OAuthConfigError(decision.errorMessage, 409, decision.errorCode);
  }

  let targetUserId: string;
  if (decision.action === 'create_user') {
    const newUser = params.db.createUser({
      email: params.email,
      emailVerified: params.emailVerified,
      name: params.name,
      avatarUrl: params.avatarUrl,
      passwordHash: null,
    });
    targetUserId = newUser.id;
  } else {
    targetUserId = decision.targetUserId;
    const current = params.db.getUserById(targetUserId);
    if (current) {
      params.db.updateUserProfile(targetUserId, {
        avatarUrl: current.avatar_url || params.avatarUrl,
        emailVerified: Boolean(current.email_verified) || params.emailVerified,
      });
    }
  }

  params.db.upsertOAuthIdentity({
    userId: targetUserId,
    provider: params.provider,
    providerUserId: params.providerUserId,
    providerEmail: params.email,
    displayName: params.name,
    avatarUrl: params.avatarUrl,
  });

  return { userId: targetUserId, mode: params.mode };
}

async function sendTransactionalEmail(params: {
  toEmail: string;
  subject: string;
  html: string;
  notConfiguredMessage: string;
}): Promise<void> {
  const config = resolveEmailTransportConfig(process.env);
  if (!config) {
    throw new OAuthConfigError(
      params.notConfiguredMessage,
      503,
      'EMAIL_NOT_CONFIGURED'
    );
  }

  if (config.provider === 'smtp') {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });

    try {
      await transporter.sendMail({
        from: config.from,
        to: params.toEmail,
        subject: params.subject,
        html: params.html,
      });
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err || '');
      if (/535|EAUTH|Invalid login|Username and Password not accepted/i.test(msg)) {
        throw new OAuthConfigError(
          'SMTP authentication failed. Check SMTP_USER and SMTP_PASS in Settings → Secrets (for Gmail, use a 16-character Google App Password with 2-Step Verification enabled).',
          502,
          'EMAIL_DELIVERY_FAILED'
        );
      }
      throw new OAuthConfigError(
        msg ? `SMTP email delivery failed: ${msg}` : 'SMTP email delivery failed.',
        502,
        'EMAIL_DELIVERY_FAILED'
      );
    }
  }

  if (config.provider === 'brevo') {
    const from = normalizeEmailFrom(config.rawFrom);
    if (!from) {
      throw new OAuthConfigError(
        'EMAIL_FROM is invalid for Brevo. In Settings → Secrets, set EMAIL_FROM to your verified Brevo sender email (e.g. `ReeView <jaysonapoya06@gmail.com>`).',
        503,
        'EMAIL_INVALID_FROM'
      );
    }
    const sender = parseSenderNameAndEmail(from);

    let res: Response;
    try {
      res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': config.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: sender.name ? { name: sender.name, email: sender.email } : { email: sender.email },
          to: [{ email: params.toEmail }],
          subject: params.subject,
          htmlContent: params.html,
        }),
      });
    } catch {
      throw new OAuthConfigError(
        'Could not reach Brevo email delivery service. Please try again.',
        502,
        'EMAIL_DELIVERY_FAILED'
      );
    }

    if (!res.ok) {
      const errorBody = (await res.json().catch(() => null)) as {
        message?: string;
        code?: string;
      } | null;
      const providerMessage =
        typeof errorBody?.message === 'string' ? errorBody.message.trim() : '';

      if (res.status === 401) {
        throw new OAuthConfigError(
          'Brevo rejected BREVO_API_KEY (invalid API key). Update BREVO_API_KEY in Settings → Secrets.',
          502,
          'EMAIL_DELIVERY_FAILED'
        );
      }

      throw new OAuthConfigError(
        providerMessage
          ? `Email delivery failed: ${providerMessage}`
          : 'Failed to send email via Brevo. Check BREVO_API_KEY and EMAIL_FROM.',
        502,
        'EMAIL_DELIVERY_FAILED'
      );
    }
    return;
  }

  const from = normalizeEmailFrom(config.rawFrom);
  if (!from) {
    throw new OAuthConfigError(
      'EMAIL_FROM is invalid. In Settings → Secrets, set EMAIL_FROM to `Name <email@example.com>` without surrounding quotes, or switch to Gmail/SMTP (`SMTP_USER` + `SMTP_PASS`).',
      503,
      'EMAIL_INVALID_FROM'
    );
  }

  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.toEmail],
        subject: params.subject,
        html: params.html,
      }),
    });
  } catch {
    throw new OAuthConfigError(
      'Could not reach the email delivery service (Resend). Please try again.',
      502,
      'EMAIL_DELIVERY_FAILED'
    );
  }

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as {
      message?: string;
      name?: string;
    } | null;
    const providerMessage =
      typeof errorBody?.message === 'string' ? errorBody.message.trim() : '';

    if (res.status === 401 || /api key is invalid/i.test(providerMessage)) {
      throw new OAuthConfigError(
        'Email service rejected RESEND_API_KEY (invalid API key). Update RESEND_API_KEY in Settings → Secrets.',
        502,
        'EMAIL_DELIVERY_FAILED'
      );
    }

    if (/invalid.*from.*field/i.test(providerMessage)) {
      throw new OAuthConfigError(
        'EMAIL_FROM is invalid. Set EMAIL_FROM to `Name <email@example.com>` without quotes, or switch to Gmail SMTP (`SMTP_USER` + `SMTP_PASS`).',
        502,
        'EMAIL_INVALID_FROM'
      );
    }

    throw new OAuthConfigError(
      providerMessage
        ? `Email delivery failed: ${providerMessage}`
        : 'Failed to send email. Check email sender configuration in Settings → Secrets.',
      502,
      'EMAIL_DELIVERY_FAILED'
    );
  }
}

export async function sendPasswordResetEmail(params: {
  toEmail: string;
  resetUrl: string;
}): Promise<void> {
  await sendTransactionalEmail({
    toEmail: params.toEmail,
    subject: 'Reset your ReeView password',
    html: `<p>Click the link below to reset your ReeView password. This link expires in 30 minutes.</p><p><a href="${params.resetUrl}">${params.resetUrl}</a></p>`,
    notConfiguredMessage:
      'Password reset emails require Gmail/SMTP (SMTP_USER & SMTP_PASS) or Brevo/Resend API secrets to be configured.',
  });
}

export async function sendEmailOtpEmail(params: {
  toEmail: string;
  recipientName?: string | null;
  otpCode: string;
  purpose: 'login' | 'register';
  expiresMinutes?: number;
}): Promise<void> {
  const expiresMinutes = params.expiresMinutes ?? 10;
  const safeName = escapeHtml((params.recipientName || '').trim() || 'there');
  const safeCode = escapeHtml(params.otpCode);
  const actionLabel =
    params.purpose === 'register'
      ? 'complete creating your ReeView account'
      : 'sign in to your ReeView workspace';

  await sendTransactionalEmail({
    toEmail: params.toEmail,
    subject:
      params.purpose === 'register'
        ? 'Verify your email for ReeView'
        : 'Your ReeView sign-in verification code',
    html: `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #0f172a;">
      <h2 style="margin: 0 0 12px; font-size: 20px;">ReeView Verification Code</h2>
      <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.5;">Hi ${safeName}, enter the 6-digit code below to ${actionLabel}:</p>
      <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; text-align: center; font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #0f172a; margin-bottom: 16px;">${safeCode}</div>
      <p style="margin: 0; font-size: 12px; color: #475569;">This code expires in ${expiresMinutes} minutes. If you did not request this code, you can safely ignore this email.</p>
    </div>`,
    notConfiguredMessage:
      'Email verification codes require Gmail/SMTP (SMTP_USER & SMTP_PASS) or Brevo/Resend API secrets to be configured.',
  });
}

export function renderOAuthPopupHtml(params: {
  success: boolean;
  provider: OAuthProviderName;
  mode: 'login' | 'link';
  handoffCode?: string;
  errorMessage?: string;
}): string {
  const payload = JSON.stringify({
    type: params.success ? 'OAUTH_AUTH_SUCCESS' : 'OAUTH_AUTH_ERROR',
    provider: params.provider,
    mode: params.mode,
    handoffCode: params.handoffCode || null,
    error: params.errorMessage || null,
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Authentication Complete</title>
  </head>
  <body style="font-family: system-ui, sans-serif; padding: 24px; color: #0f172a;">
    <script>
      (function () {
        var msg = ${payload};
        if (window.opener) {
          window.opener.postMessage(msg, window.location.origin);
          window.close();
        } else {
          window.location.href = msg.error
            ? '/?authError=' + encodeURIComponent(msg.error)
            : msg.handoffCode
              ? '/?oauthHandoff=' + encodeURIComponent(msg.handoffCode)
              : '/';
        }
      })();
    </script>
    <p>${
      params.success
        ? 'Authentication successful. You can close this window.'
        : 'Authentication did not complete. You can close this window and retry.'
    }</p>
  </body>
</html>`;
}
