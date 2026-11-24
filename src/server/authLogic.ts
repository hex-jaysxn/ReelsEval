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
