import type { AuthUser } from '../types/auth.ts';

export interface AuthApiPayload {
  ok?: boolean;
  otpRequired?: boolean;
  purpose?: 'login' | 'register';
  challengeId?: string;
  maskedEmail?: string;
  resendCooldownSeconds?: number;
  message?: string;
  user?: AuthUser;
  sessionToken?: string;
  error?: {
    code?: string;
    message?: string;
    retryAfterSeconds?: number;
  };
}

export type ParsedAuthResponse =
  | { ok: true; data: AuthApiPayload }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        retryAfterSeconds?: number;
      };
    };

export function parseAuthApiResponse(params: {
  ok: boolean;
  status: number;
  contentType?: string | null;
  redirected?: boolean;
  rawBody: string;
}): ParsedAuthResponse {
  const { ok, status, contentType, redirected, rawBody } = params;
  const trimmed = (rawBody || '').trim();
  const normalizedType = (contentType || '').toLowerCase();
  const looksLikeHtml =
    normalizedType.includes('text/html') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html');

  let parsed: AuthApiPayload | null = null;
  if (trimmed && !looksLikeHtml) {
    try {
      const json = JSON.parse(trimmed) as unknown;
      if (json && typeof json === 'object' && !Array.isArray(json)) {
        parsed = json as AuthApiPayload;
      }
    } catch {
      parsed = null;
    }
  }

  if (parsed?.error?.message) {
    return {
      ok: false,
      error: {
        code: parsed.error.code || 'AUTH_ERROR',
        message: parsed.error.message,
        retryAfterSeconds: parsed.error.retryAfterSeconds,
      },
    };
  }

  if (ok && parsed) {
    return { ok: true, data: parsed };
  }

  if (looksLikeHtml || (redirected && !parsed)) {
    return {
      ok: false,
      error: {
        code: 'SESSION_OR_PROXY_HTML',
        message: `Authentication received an HTML page instead of JSON (HTTP ${status}). Your preview session may have refreshed—please reload the page and try again.`,
      },
    };
  }

  if (!trimmed) {
    return {
      ok: false,
      error: {
        code: 'EMPTY_RESPONSE',
        message: `Authentication server returned an empty response (HTTP ${status}). Please reload the page and try again.`,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: 'UNEXPECTED_RESPONSE',
      message: `Unexpected response from authentication server (HTTP ${status}). Please reload the page and try again.`,
    },
  };
}
