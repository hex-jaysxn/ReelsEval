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

