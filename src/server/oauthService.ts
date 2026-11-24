import type express from 'express';
import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from 'jose';
import type { AuthProviderAvailability } from '../types/auth.ts';
import {
  decideOAuthResolution,
  generateOpaqueToken,
  generatePkceChallenge,
  isApplePrivateRelayEmail,
  normalizeEmail,
} from './authLogic.ts';
import type { AppDatabase, OAuthProviderName } from './db.ts';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

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

export function isAppleOAuthConfigured(): boolean {
  const clientId = process.env.APPLE_CLIENT_ID?.trim();
  if (!clientId) return false;
  if (process.env.APPLE_CLIENT_SECRET?.trim()) return true;
  return Boolean(
    process.env.APPLE_TEAM_ID?.trim() &&
      process.env.APPLE_KEY_ID?.trim() &&
      process.env.APPLE_PRIVATE_KEY?.trim()
  );
}

export function isPasswordResetEmailConfigured(): boolean {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim()
  );
}

export function getAuthProviderAvailability(
  req: express.Request
): AuthProviderAvailability {
  const baseUrl = getAppBaseUrl(req);
  return {
    googleConfigured: isGoogleOAuthConfigured(),
    appleConfigured: isAppleOAuthConfigured(),
    passwordResetEmailConfigured: isPasswordResetEmailConfigured(),
    callbackUrls: {
      google: `${baseUrl}/api/auth/google/callback`,
      apple: `${baseUrl}/api/auth/apple/callback`,
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
    isPrivateRelay: false,
    mode: stateRecord.mode,
    sessionUserId: stateRecord.user_id,
  });
}

async function generateAppleClientSecret(clientId: string): Promise<string> {
  const staticSecret = process.env.APPLE_CLIENT_SECRET?.trim();
  if (staticSecret) {
    return staticSecret;
  }

  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const keyId = process.env.APPLE_KEY_ID?.trim();
  const rawPrivateKey = process.env.APPLE_PRIVATE_KEY?.trim();

  if (!teamId || !keyId || !rawPrivateKey) {
    throw new OAuthConfigError(
      'Sign in with Apple requires APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY (or APPLE_CLIENT_SECRET).'
    );
  }

  const normalizedPem = rawPrivateKey.replace(/\\n/g, '\n');
  const privateKey = await importPKCS8(normalizedPem, 'ES256');
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setAudience('https://appleid.apple.com')
    .setSubject(clientId)
    .sign(privateKey);
}

export function buildAppleAuthUrl(params: {
  req: express.Request;
  db: AppDatabase;
  mode: 'login' | 'link';
  sessionUserId: string | null;
}): string {
  const clientId = process.env.APPLE_CLIENT_ID?.trim();
  if (!clientId || !isAppleOAuthConfigured()) {
    throw new OAuthConfigError(
      'Sign in with Apple requires APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY to be configured in server environment secrets.'
    );
  }

  const baseUrl = getAppBaseUrl(params.req);
  const redirectUri = `${baseUrl}/api/auth/apple/callback`;
  const nonce = generateOpaqueToken(16);
  const codeVerifier = generateOpaqueToken(32);

  const state = params.db.createOAuthState({
    provider: 'apple',
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
    response_mode: 'form_post',
    scope: 'name email',
    state,
    nonce,
  });

  return `https://appleid.apple.com/auth/authorize?${query.toString()}`;
}

export async function handleAppleCallback(params: {
  code: string;
  state: string;
  userJson?: string;
  db: AppDatabase;
}): Promise<{ userId: string; mode: 'login' | 'link' }> {
  const clientId = process.env.APPLE_CLIENT_ID?.trim();
  if (!clientId || !isAppleOAuthConfigured()) {
    throw new OAuthConfigError('Sign in with Apple is not configured on the server.');
  }

  const stateRecord = params.db.consumeOAuthState(params.state, 'apple');
  if (!stateRecord) {
    throw new OAuthConfigError(
      'Invalid or expired Apple Sign-In state. Please try signing in again.',
      400,
      'INVALID_OAUTH_STATE'
    );
  }

  const appleClientSecret = await generateAppleClientSecret(clientId);

  const tokenRes = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: appleClientSecret,
      code: params.code,
      grant_type: 'authorization_code',
      redirect_uri: stateRecord.redirect_uri,
    }),
  });

  const tokenData = (await tokenRes.json().catch(() => null)) as {
    id_token?: string;
    error?: string;
    error_description?: string;
  } | null;

  if (!tokenRes.ok || !tokenData?.id_token) {
    throw new OAuthConfigError(
      tokenData?.error_description || tokenData?.error || 'Apple token exchange failed.',
      401,
      'OAUTH_EXCHANGE_FAILED'
    );
  }

  const { payload } = await jwtVerify(tokenData.id_token, APPLE_JWKS, {
    issuer: 'https://appleid.apple.com',
    audience: clientId,
  });

  if (payload.nonce && payload.nonce !== stateRecord.nonce) {
    throw new OAuthConfigError('Apple ID token nonce mismatch.', 401, 'INVALID_NONCE');
  }

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const tokenEmail = typeof payload.email === 'string' ? normalizeEmail(payload.email) : '';
  const emailVerified =
    payload.email_verified === true || payload.email_verified === 'true';

  let parsedName = '';
  if (params.userJson) {
    try {
      const userObj = JSON.parse(params.userJson) as {
        name?: { firstName?: string; lastName?: string };
      };
      const first = userObj.name?.firstName?.trim() || '';
      const last = userObj.name?.lastName?.trim() || '';
      parsedName = `${first} ${last}`.trim();
    } catch {
      // Ignore malformed optional Apple user payload
    }
  }

  const existingIdentity = params.db.findOAuthIdentity('apple', sub);
  const effectiveEmail = tokenEmail || existingIdentity?.provider_email || '';

  if (!sub || !effectiveEmail) {
    throw new OAuthConfigError(
      'Apple Sign-In did not return a user identifier or email address.',
      400,
      'MISSING_PROFILE_CLAIMS'
    );
  }

  const isPrivateRelay =
    payload.is_private_email === true ||
    payload.is_private_email === 'true' ||
    isApplePrivateRelayEmail(effectiveEmail);

  return completeOAuthIdentityResolution({
    db: params.db,
    provider: 'apple',
    providerUserId: sub,
    email: effectiveEmail,
    emailVerified,
    name: parsedName || existingIdentity?.display_name || 'Apple User',
    avatarUrl: null,
    isPrivateRelay,
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
  isPrivateRelay: boolean;
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
    isPrivateRelay: params.isPrivateRelay,
    displayName: params.name,
    avatarUrl: params.avatarUrl,
  });

  return { userId: targetUserId, mode: params.mode };
}

export async function sendPasswordResetEmail(params: {
  toEmail: string;
  resetUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    throw new OAuthConfigError(
      'Password reset emails require RESEND_API_KEY and EMAIL_FROM to be configured in server environment secrets.',
      503,
      'EMAIL_NOT_CONFIGURED'
    );
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.toEmail],
      subject: 'Reset your ReeView password',
      html: `<p>Click the link below to reset your ReeView password. This link expires in 30 minutes.</p><p><a href="${params.resetUrl}">${params.resetUrl}</a></p>`,
    }),
  });

  if (!res.ok) {
    throw new OAuthConfigError(
      'Failed to send password reset email. Check RESEND_API_KEY and EMAIL_FROM configuration.',
      502,
      'EMAIL_DELIVERY_FAILED'
    );
  }
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
