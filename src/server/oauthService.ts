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
  resolveTrustedOpenerOrigin,
} from './authLogic.ts';
import type { AppDatabase, OAuthProviderName } from './db.ts';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export class OAuthConfigError extends Error {
  statusCode: number;
  code: string;
  openerOrigin?: string | null;
  flowIdHash?: string | null;
  flowType?: 'popup' | 'redirect';

  constructor(
    message: string,
    statusCode = 503,
    code = 'OAUTH_NOT_CONFIGURED',
    openerOrigin?: string | null,
    flowIdHash?: string | null,
    flowType?: 'popup' | 'redirect'
  ) {
    super(message);
    this.name = 'OAuthConfigError';
    this.statusCode = statusCode;
    this.code = code;
    this.openerOrigin = openerOrigin ?? null;
    this.flowIdHash = flowIdHash ?? null;
    this.flowType = flowType ?? 'popup';
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

export function getRequestOrigin(req: express.Request): string {
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)
    ?.split(',')[0]
    ?.trim()
    ?.toLowerCase();
  const proto = forwardedProto || (req.secure ? 'https' : 'http');
  const forwardedHost = (req.headers['x-forwarded-host'] as string | undefined)
    ?.split(',')[0]
    ?.trim();
  const host = forwardedHost || req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

export function buildGoogleAuthUrl(params: {
  req: express.Request;
  db: AppDatabase;
  mode: 'login' | 'link';
  sessionUserId: string | null;
  candidateOpenerOrigin?: string | null;
  flowType?: 'popup' | 'redirect';
}): { url: string; callbackOrigin: string; flowId: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new OAuthConfigError(
      'Google Sign-In requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to be configured in server environment secrets.'
    );
  }

  const baseUrl = getAppBaseUrl(params.req);
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  const callbackOrigin = new URL(redirectUri).origin;
  const openerOrigin = resolveTrustedOpenerOrigin({
    candidateOrigin: params.candidateOpenerOrigin || (params.req.headers.origin as string | undefined),
    requestOrigin: getRequestOrigin(params.req),
    appUrl: process.env.APP_URL?.trim() || null,
  });

  const nonce = generateOpaqueToken(16);
  const codeVerifier = generateOpaqueToken(32);
  const codeChallenge = generatePkceChallenge(codeVerifier);
  const flowId = generateOpaqueToken(24);
  const flowType = params.flowType === 'redirect' ? 'redirect' : 'popup';

  const state = params.db.createOAuthState({
    provider: 'google',
    mode: params.mode,
    userId: params.sessionUserId,
    nonce,
    codeVerifier,
    redirectUri,
    openerOrigin,
    flowId,
    flowType,
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

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`,
    callbackOrigin,
    flowId,
  };
}

export async function handleGoogleCallback(params: {
  code: string;
  state: string;
  db: AppDatabase;
}): Promise<{
  userId: string;
  mode: 'login' | 'link';
  openerOrigin: string | null;
  flowIdHash: string | null;
  flowType: 'popup' | 'redirect';
}> {
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

  const openerOrigin = stateRecord.opener_origin ?? null;
  const flowIdHash = stateRecord.flow_id_hash ?? null;
  const flowType = stateRecord.flow_type === 'redirect' ? 'redirect' : 'popup';

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
      'OAUTH_EXCHANGE_FAILED',
      openerOrigin,
      flowIdHash,
      flowType
    );
  }

  const { payload } = await jwtVerify(tokenData.id_token, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: clientId,
  });

  if (payload.nonce !== stateRecord.nonce) {
    throw new OAuthConfigError(
      'Google ID token nonce mismatch.',
      401,
      'INVALID_NONCE',
      openerOrigin,
      flowIdHash,
      flowType
    );
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
      'MISSING_PROFILE_CLAIMS',
      openerOrigin,
      flowIdHash,
      flowType
    );
  }

  try {
    const resolved = completeOAuthIdentityResolution({
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
    return {
      ...resolved,
      openerOrigin,
      flowIdHash,
      flowType,
    };
  } catch (err) {
    if (err instanceof OAuthConfigError) {
      if (!err.openerOrigin) err.openerOrigin = openerOrigin;
      if (!err.flowIdHash) err.flowIdHash = flowIdHash;
      if (!err.flowType) err.flowType = flowType;
    }
    throw err;
  }
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
  targetOrigin?: string | null;
  flowIdHash?: string | null;
  flowType?: 'popup' | 'redirect';
}): string {
  const payload = JSON.stringify({
    type: params.success ? 'OAUTH_AUTH_SUCCESS' : 'OAUTH_AUTH_ERROR',
    provider: params.provider,
    mode: params.mode,
    handoffCode: params.handoffCode || null,
    error: params.errorMessage || null,
  });

  const safeTargetOrigin = JSON.stringify(params.targetOrigin || null);
  const safeFlowHash = JSON.stringify(params.flowIdHash || null);
  const safeFlowType = JSON.stringify(params.flowType === 'redirect' ? 'redirect' : 'popup');
  const safeBase = params.targetOrigin || '';
  const fallbackHref = params.errorMessage
    ? `${safeBase}/?authError=${encodeURIComponent(params.errorMessage)}`
    : params.mode === 'link'
      ? `${safeBase}/?oauthLinked=${encodeURIComponent(params.provider)}`
      : params.handoffCode
        ? `${safeBase}/?oauthHandoff=${encodeURIComponent(params.handoffCode)}`
        : `${safeBase}/`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Authentication Complete</title>
  </head>
  <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#070b28;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;padding:24px;text-align:center;">
    <div style="max-width:380px;">
      <p id="rv-oauth-title" style="font-size:17px;font-weight:700;margin:0 0 8px;">${
        params.success
          ? 'Google sign-in complete'
          : 'Google sign-in could not complete'
      }</p>
      <p id="rv-oauth-desc" style="font-size:13px;color:#cbd5e1;margin:0 0 18px;line-height:1.5;">${
        params.success
          ? 'Returning you to your main ReeView tab...'
          : escapeHtml(params.errorMessage || 'Please return to ReeView and try again.')
      }</p>
      <div style="display:flex;flex-direction:column;gap:10px;align-items:center;">
        <button id="rv-return-btn" type="button" style="display:none;padding:10px 18px;border-radius:10px;border:none;background:#22d3ee;color:#070b28;font-size:13px;font-weight:700;cursor:pointer;">Back to Main ReeView Tab</button>
        <a id="rv-fallback-link" href="${escapeHtml(fallbackHref)}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#22d3ee;color:#070b28;font-size:13px;font-weight:700;text-decoration:none;">Open ReeView</a>
      </div>
    </div>
    <script>
      (function () {
        var msg = ${payload};
        var explicitOrigin = ${safeTargetOrigin};
        var flowHash = ${safeFlowHash};
        var flowType = ${safeFlowType};
        var postTarget = explicitOrigin || window.location.origin;
        var deliveredToOpener = false;
        var acked = false;

        var fallbackUrl = msg.error
          ? (explicitOrigin || '') + '/?authError=' + encodeURIComponent(msg.error)
          : msg.mode === 'link'
            ? (explicitOrigin || '') + '/?oauthLinked=' + encodeURIComponent(msg.provider)
            : msg.handoffCode
              ? (explicitOrigin || '') + '/?oauthHandoff=' + encodeURIComponent(msg.handoffCode)
              : (explicitOrigin || '') + '/';

        if (flowType === 'redirect') {
          window.location.replace(fallbackUrl);
          return;
        }

        function showMainTabReadyState() {
          var titleEl = document.getElementById('rv-oauth-title');
          var descEl = document.getElementById('rv-oauth-desc');
          var returnBtn = document.getElementById('rv-return-btn');
          var fallbackLink = document.getElementById('rv-fallback-link');
          if (titleEl) {
            titleEl.textContent = msg.error
              ? 'Return to your main ReeView tab'
              : 'You are signed in on your main ReeView tab';
          }
          if (descEl) {
            descEl.textContent = msg.error
              ? msg.error
              : 'Your Google account is saved in your main ReeView tab. You can close this window or switch back to ReeView.';
          }
          if (returnBtn) {
            returnBtn.style.display = 'inline-block';
            returnBtn.onclick = function () {
              try { if (window.opener && !window.opener.closed) window.opener.focus(); } catch (e) {}
              try { window.close(); } catch (e) {}
            };
          }
          if (fallbackLink) {
            fallbackLink.textContent = 'Continue in This Tab Instead';
            fallbackLink.style.background = 'transparent';
            fallbackLink.style.color = '#94a3b8';
            fallbackLink.style.border = '1px solid rgba(148,163,184,0.35)';
            fallbackLink.href = (explicitOrigin || '') + '/';
          }
        }

        try {
          if (typeof BroadcastChannel !== 'undefined') {
            var channel = new BroadcastChannel('reeview_oauth_channel');
            channel.onmessage = function (ev) {
              if (ev && ev.data && ev.data.type === 'OAUTH_AUTH_ACK') {
                acked = true;
                try { window.close(); } catch (e) {}
              }
            };
            channel.postMessage(msg);
          }
        } catch (e) {}

        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(msg, postTarget);
            deliveredToOpener = true;
            try { window.opener.focus(); } catch (e) {}
          }
        } catch (e) {}

        if (deliveredToOpener) {
          try { window.close(); } catch (e) {}
        }

        var startedAt = Date.now();
        var checkInterval = window.setInterval(function () {
          if (window.closed) {
            window.clearInterval(checkInterval);
            return;
          }

          if (acked) {
            window.clearInterval(checkInterval);
            try { if (window.opener && !window.opener.closed) window.opener.focus(); } catch (e) {}
            try { window.close(); } catch (e) {}
            showMainTabReadyState();
            return;
          }

          if (flowHash) {
            fetch('/api/auth/oauth/flow-status?flowHash=' + encodeURIComponent(flowHash), {
              credentials: 'same-origin'
            })
              .then(function (r) { return r.ok ? r.json() : null; })
              .then(function (data) {
                if (data && data.claimed) {
                  acked = true;
                  window.clearInterval(checkInterval);
                  try { if (window.opener && !window.opener.closed) window.opener.focus(); } catch (e) {}
                  try { window.close(); } catch (e) {}
                  showMainTabReadyState();
                } else if (Date.now() - startedAt >= 1800) {
                  window.clearInterval(checkInterval);
                  window.location.replace(fallbackUrl);
                }
              })
              .catch(function () {
                if (Date.now() - startedAt >= 1800) {
                  window.clearInterval(checkInterval);
                  window.location.replace(fallbackUrl);
                }
              });
          } else if (Date.now() - startedAt >= (deliveredToOpener ? 1000 : 350)) {
            window.clearInterval(checkInterval);
            if (!deliveredToOpener) {
              window.location.replace(fallbackUrl);
            } else {
              showMainTabReadyState();
            }
          }
        }, 250);
      })();
    </script>
  </body>
</html>`;
}
