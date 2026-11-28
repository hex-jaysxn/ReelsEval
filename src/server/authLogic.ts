import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);

export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized || normalized.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  message?: string;
} {
  if (typeof password !== 'string' || password.length < 8) {
    return {
      valid: false,
      message: 'Password must be at least 8 characters long.',
    };
  }
  if (password.length > 128) {
    return {
      valid: false,
      message: 'Password must be 128 characters or fewer.',
    };
  }
  return { valid: true };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined
): Promise<boolean> {
  if (!storedHash || !password) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, hexKey] = parts;
  if (!salt || !hexKey) return false;
  try {
    const keyBuffer = Buffer.from(hexKey, 'hex');
    const derived = (await scryptAsync(password, salt, 64)) as Buffer;
    if (keyBuffer.length !== derived.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derived);
  } catch {
    return false;
  }
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function generatePkceChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function canDisconnectProvider(params: {
  hasPassword: boolean;
  connectedOAuthProviders: 'google'[];
  providerToRemove: 'google';
}): { allowed: boolean; reason?: string } {
  const remainingOAuth = params.connectedOAuthProviders.filter(
    (p) => p !== params.providerToRemove
  );
  if (!params.hasPassword && remainingOAuth.length === 0) {
    return {
      allowed: false,
      reason:
        'Set a password or connect another provider before disconnecting your only sign-in method.',
    };
  }
  return { allowed: true };
}

export function decideOAuthResolution(params: {
  existingIdentityUserId: string | null;
  existingEmailUserId: string | null;
  emailVerified: boolean;
  mode: 'login' | 'link';
  sessionUserId: string | null;
}):
  | { action: 'sign_in'; targetUserId: string }
  | { action: 'link_existing_email'; targetUserId: string }
  | { action: 'create_user' }
  | { action: 'link_to_session'; targetUserId: string }
  | { action: 'error'; errorCode: string; errorMessage: string } {
  if (params.mode === 'link') {
    if (!params.sessionUserId) {
      return {
        action: 'error',
        errorCode: 'UNAUTHORIZED',
        errorMessage: 'You must be signed in to connect an authentication provider.',
      };
    }
    if (
      params.existingIdentityUserId &&
      params.existingIdentityUserId !== params.sessionUserId
    ) {
      return {
        action: 'error',
        errorCode: 'PROVIDER_ALREADY_LINKED',
        errorMessage: 'This external account is already linked to another user.',
      };
    }
    return {
      action: 'link_to_session',
      targetUserId: params.sessionUserId,
    };
  }

  if (params.existingIdentityUserId) {
    return {
      action: 'sign_in',
      targetUserId: params.existingIdentityUserId,
    };
  }

  if (params.existingEmailUserId) {
    if (params.emailVerified) {
      return {
        action: 'link_existing_email',
        targetUserId: params.existingEmailUserId,
      };
    }
    return {
      action: 'error',
      errorCode: 'UNVERIFIED_OAUTH_EMAIL',
      errorMessage:
        'An account with this email already exists, and the provider did not verify email ownership. Sign in with your password and link the provider in Account Settings.',
    };
  }

  return { action: 'create_user' };
}

export function generateNumericOtp(digits = 6): string {
  const max = 10 ** digits;
  return crypto.randomInt(0, max).toString().padStart(digits, '0');
}

export function hashOtpCode(code: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(code.trim()).digest('hex');
}

export function verifyOtpCode(code: string, salt: string, expectedHash: string): boolean {
  const normalized = (code || '').trim();
  if (!/^\d{6}$/.test(normalized) || !salt || !expectedHash) {
    return false;
  }
  try {
    const actualBuf = Buffer.from(hashOtpCode(normalized, salt), 'hex');
    const expectedBuf = Buffer.from(expectedHash, 'hex');
    if (actualBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

export function maskEmailAddress(email: string): string {
  const normalized = normalizeEmail(email);
  const atIdx = normalized.indexOf('@');
  if (atIdx <= 0) return normalized;
  const local = normalized.slice(0, atIdx);
  const domain = normalized.slice(atIdx + 1);
  const visiblePrefix = local.slice(0, Math.min(2, local.length));
  return `${visiblePrefix}***@${domain}`;
}

export function escapeHtml(input: string): string {
  return (input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const SIMPLE_EMAIL_FROM_REGEX = /^[^\s<>@"',;]+@[^\s<>@"',;]+\.[^\s<>@"',;]{2,}$/;
const NAMED_EMAIL_FROM_REGEX = /^(.+?)\s*<([^\s<>@"',;]+@[^\s<>@"',;]+\.[^\s<>@"',;]{2,})>?$/;

export function normalizeEmailFrom(raw?: string | null): string | null {
  if (typeof raw !== 'string') return null;
  let value = raw.replace(/[\r\n\t]+/g, ' ').trim();
  if (!value || value === 'MY_EMAIL_FROM') return null;

  if (/^EMAIL_FROM\s*=\s*/i.test(value)) {
    value = value.replace(/^EMAIL_FROM\s*=\s*/i, '').trim();
  }

  while (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('“') && value.endsWith('”')) ||
    (value.startsWith('‘') && value.endsWith('’'))
  ) {
    value = value.slice(1, -1).trim();
  }

  if (/^EMAIL_FROM\s*=\s*/i.test(value)) {
    value = value.replace(/^EMAIL_FROM\s*=\s*/i, '').trim();
  }

  if (!value || value === 'MY_EMAIL_FROM') return null;

  if (value.startsWith('<') && value.endsWith('>')) {
    const inner = value.slice(1, -1).trim().replace(/^["']+|["']+$/g, '');
    if (SIMPLE_EMAIL_FROM_REGEX.test(inner)) {
      return inner;
    }
  }

  if (SIMPLE_EMAIL_FROM_REGEX.test(value)) {
    return value;
  }

  const namedMatch = value.match(NAMED_EMAIL_FROM_REGEX);
  if (namedMatch) {
    const displayName = namedMatch[1]
      .replace(/^["'“‘]+|["'”’]+$/g, '')
      .trim();
    const email = namedMatch[2].trim();
    return displayName ? `${displayName} <${email}>` : email;
  }

  const tokens = value.split(/\s+/);
  if (tokens.length >= 2) {
    const candidateEmail = tokens[tokens.length - 1]
      .replace(/^[<"']+|[>"',;]+$/g, '')
      .trim();
    if (SIMPLE_EMAIL_FROM_REGEX.test(candidateEmail)) {
      const displayName = tokens
        .slice(0, -1)
        .join(' ')
        .replace(/^["'“‘]+|["'”’]+$/g, '')
        .trim();
      return displayName ? `${displayName} <${candidateEmail}>` : candidateEmail;
    }
  }

  return null;
}

export function cleanSecretValue(raw?: string | null, placeholder?: string): string {
  if (typeof raw !== 'string') return '';
  let value = raw.trim();
  while (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  if (!value || (placeholder && value === placeholder)) return '';
  return value;
}

export function parseSenderNameAndEmail(fromAddress: string): {
  name?: string;
  email: string;
} {
  const namedMatch = fromAddress.match(NAMED_EMAIL_FROM_REGEX);
  if (namedMatch) {
    const name = namedMatch[1].trim();
    const email = namedMatch[2].trim();
    return name ? { name, email } : { email };
  }
  return { email: fromAddress.trim() };
}

export type ResolvedEmailTransport =
  | {
      provider: 'smtp';
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
      from: string;
    }
  | {
      provider: 'brevo';
      apiKey: string;
      rawFrom: string;
    }
  | {
      provider: 'resend';
      apiKey: string;
      rawFrom: string;
    };

export function inferSmtpHostFromEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (/@(gmail|googlemail)\.com$/i.test(normalized)) {
    return 'smtp.gmail.com';
  }
  if (/@(outlook|hotmail|live|msn)\.com$/i.test(normalized)) {
    return 'smtp-mail.outlook.com';
  }
  if (/@yahoo\.com$/i.test(normalized)) {
    return 'smtp.mail.yahoo.com';
  }
  return null;
}

export function resolveEmailTransportConfig(
  env: Record<string, string | undefined>
): ResolvedEmailTransport | null {
  const smtpUser = cleanSecretValue(env.SMTP_USER, 'MY_SMTP_USER');
  const rawSmtpPass = cleanSecretValue(env.SMTP_PASS, 'MY_SMTP_PASS');
  const explicitSmtpHost = cleanSecretValue(env.SMTP_HOST, 'MY_SMTP_HOST');

  if (smtpUser && rawSmtpPass) {
    const host = explicitSmtpHost || inferSmtpHostFromEmail(smtpUser);
    if (host) {
      const parsedPort = Number(cleanSecretValue(env.SMTP_PORT));
      const port =
        Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
          ? parsedPort
          : host === 'smtp.gmail.com'
            ? 465
            : 587;
      const secureEnv = cleanSecretValue(env.SMTP_SECURE).toLowerCase();
      const secure =
        secureEnv === 'true' ? true : secureEnv === 'false' ? false : port === 465;

      // Google App Passwords are displayed in 4-char space-separated groups
      const pass =
        host === 'smtp.gmail.com' && /^[a-zA-Z0-9]{4}(\s+[a-zA-Z0-9]{4}){3}$/.test(rawSmtpPass)
          ? rawSmtpPass.replace(/\s+/g, '')
          : rawSmtpPass;

      const normalizedFrom = normalizeEmailFrom(env.EMAIL_FROM);
      const isResendSandbox = Boolean(normalizedFrom && /@resend\.dev>?$/i.test(normalizedFrom));
      const fallbackFrom = isValidEmail(smtpUser) ? `ReeView <${smtpUser}>` : null;
      const from =
        normalizedFrom && !isResendSandbox
          ? normalizedFrom
          : fallbackFrom || normalizedFrom || '';

      if (from) {
        return {
          provider: 'smtp',
          host,
          port,
          secure,
          user: smtpUser,
          pass,
          from,
        };
      }
    }
  }

  const brevoKey = cleanSecretValue(env.BREVO_API_KEY, 'MY_BREVO_API_KEY');
  const rawFrom = cleanSecretValue(env.EMAIL_FROM, 'MY_EMAIL_FROM');
  if (brevoKey && rawFrom) {
    return {
      provider: 'brevo',
      apiKey: brevoKey,
      rawFrom,
    };
  }

  const resendKey = cleanSecretValue(env.RESEND_API_KEY, 'MY_RESEND_API_KEY');
  if (resendKey && rawFrom) {
    return {
      provider: 'resend',
      apiKey: resendKey,
      rawFrom,
    };
  }

  return null;
}

const TRUSTED_EXACT_ORIGINS = new Set([
  'https://reeview.ai.studio',
]);

function extractAppletSlug(hostname: string): string | null {
  const match = hostname.match(/^ais-(?:dev|pre)-([a-z0-9-]+)(?:\.[a-z0-9-]+)*\.run\.app$/i);
  return match ? match[1].toLowerCase() : null;
}

export function isTrustedAppOrigin(
  candidateOrigin: string,
  context: { requestOrigin?: string | null; appUrl?: string | null }
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(candidateOrigin);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }

  const normalized = parsed.origin;
  if (TRUSTED_EXACT_ORIGINS.has(normalized)) {
    return true;
  }

  if (
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
  ) {
    return true;
  }

  for (const refUrl of [context.requestOrigin, context.appUrl]) {
    if (!refUrl) continue;
    try {
      const refParsed = new URL(refUrl);
      if (refParsed.origin === normalized) {
        return true;
      }
      const refSlug = extractAppletSlug(refParsed.hostname);
      const candSlug = extractAppletSlug(parsed.hostname);
      if (refSlug && candSlug && refSlug === candSlug && parsed.protocol === 'https:') {
        return true;
      }
    } catch {
      // Ignore malformed reference URL
    }
  }

  return false;
}

export function resolveTrustedOpenerOrigin(params: {
  candidateOrigin?: string | null;
  requestOrigin?: string | null;
  appUrl?: string | null;
}): string | null {
  const candidates = [params.candidateOrigin, params.requestOrigin, params.appUrl];
  for (const raw of candidates) {
    if (!raw || typeof raw !== 'string') continue;
    try {
      const origin = new URL(raw.trim()).origin;
      if (
        isTrustedAppOrigin(origin, {
          requestOrigin: params.requestOrigin,
          appUrl: params.appUrl,
        })
      ) {
        return origin;
      }
    } catch {
      // Ignore invalid URL
    }
  }
  return null;
}

export function isHttpsRequestValues(params: {
  secure: boolean;
  forwardedProto?: string | null;
  forwardedSsl?: string | null;
  originHeader?: string | null;
}): boolean {
  if (params.secure) return true;
  const proto = params.forwardedProto?.split(',')[0]?.trim().toLowerCase();
  if (proto === 'https') return true;
  if (params.forwardedSsl?.trim().toLowerCase() === 'on') return true;
  if (params.originHeader?.trim().toLowerCase().startsWith('https://')) return true;
  return false;
}

