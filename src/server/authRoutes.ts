import express from 'express';
import type { AuthUser } from '../types/auth.ts';
import type { ApiErrorPayload } from '../types/evaluation.ts';
import {
  canDisconnectProvider,
  hashPassword,
  isValidEmail,
  normalizeEmail,
  validatePasswordStrength,
  verifyPassword,
} from './authLogic.ts';
import type { AppDatabase, OAuthProviderName } from './db.ts';
import {
  OAuthConfigError,
  buildAppleAuthUrl,
  buildGoogleAuthUrl,
  getAppBaseUrl,
  getAuthProviderAvailability,
  handleAppleCallback,
  handleGoogleCallback,
  isPasswordResetEmailConfigured,
  renderOAuthPopupHtml,
  sendPasswordResetEmail,
} from './oauthService.ts';

export const SESSION_COOKIE_NAME = 'reelsevaluator_session';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

export function extractSessionToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[SESSION_COOKIE_NAME] || null;
}

function isHttpsRequest(req: express.Request): boolean {
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)
    ?.split(',')[0]
    ?.trim();
  return req.secure || forwardedProto === 'https';
}

function setSessionCookie(
  req: express.Request,
  res: express.Response,
  rawToken: string
): void {
  const https = isHttpsRequest(req);
  const maxAgeSeconds = 7 * 24 * 60 * 60;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (https) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(req: express.Request, res: express.Response): void {
  const https = isHttpsRequest(req);
  const parts = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'Max-Age=0'];
  if (https) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function verifySameOriginMutation(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  const origin = req.headers.origin;
  const host =
    (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0]?.trim() ||
    req.headers.host;

  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) {
        next();
        return;
      }
    } catch {
      // Fall through to reject
    }
    const payload: ApiErrorPayload = {
      error: {
        code: 'ANALYSIS_FAILED',
        message: 'Cross-origin request blocked.',
      },
    };
    res.status(403).json(payload);
    return;
  }

  if (req.headers['x-requested-with'] === 'ReelsEvaluator' || !req.headers.cookie) {
    next();
    return;
  }

  next();
}

export function getAuthenticatedUserFromRequest(
  req: express.Request,
  db: AppDatabase
): AuthUser | null {
  const token = extractSessionToken(req);
  return db.getSessionUser(token);
}

export function requireAuthMiddleware(db: AppDatabase) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = getAuthenticatedUserFromRequest(req, db);
    if (!user) {
      const payload: ApiErrorPayload = {
        error: {
          code: 'INVALID_API_KEY',
          message: 'Please sign in to access your ReeView account.',
        },
      };
      res.status(401).json(payload);
      return;
    }
    (req as express.Request & { authUser?: AuthUser }).authUser = user;
    next();
  };
}

export function createAuthRouter(db: AppDatabase): express.Router {
  const router = express.Router();

  router.get('/providers', (req, res) => {
    res.json(getAuthProviderAvailability(req));
  });

  router.get('/me', (req, res) => {
    const user = getAuthenticatedUserFromRequest(req, db);
    res.json({ user });
  });

  router.post('/register', verifySameOriginMutation, async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!name) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Please enter your full name.' } });
      return;
    }
    if (!isValidEmail(email)) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Please enter a valid email address.' } });
      return;
    }
    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.valid) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: pwCheck.message } });
      return;
    }

    const existing = db.getUserByEmail(email);
    if (existing) {
      const message = existing.password_hash
        ? 'An account with this email already exists. Please sign in instead.'
        : 'An account with this email already exists via social sign-in. Sign in with Google or Apple, then set a password in Account Settings.';
      res.status(409).json({ error: { code: 'EMAIL_EXISTS', message } });
      return;
    }

    const passwordHash = await hashPassword(password);
    const created = db.createUser({
      email,
      emailVerified: false,
      name,
      passwordHash,
    });

    const token = db.createSession(created.id);
    setSessionCookie(req, res, token);
    res.status(201).json({ user: db.getAuthUserProfile(created.id), sessionToken: token });
  });

  router.post('/login', verifySameOriginMutation, async (req, res) => {
    const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!isValidEmail(email) || !password) {
      res.status(400).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email and password are required.' },
      });
      return;
    }

    const userRow = db.getUserByEmail(email);
    if (!userRow) {
      res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
      return;
    }

    if (!userRow.password_hash) {
      const providers = db
        .listOAuthIdentitiesForUser(userRow.id)
        .map((id) => (id.provider === 'google' ? 'Google' : 'Apple'))
        .join(' or ');
      res.status(401).json({
        error: {
          code: 'OAUTH_ACCOUNT_ONLY',
          message: `This account currently signs in with ${providers || 'an external provider'}. Continue with ${providers || 'your provider'} or reset your password.`,
        },
      });
      return;
    }

    const valid = await verifyPassword(password, userRow.password_hash);
    if (!valid) {
      res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
      return;
    }

    const token = db.createSession(userRow.id);
    setSessionCookie(req, res, token);
    res.json({ user: db.getAuthUserProfile(userRow.id), sessionToken: token });
  });

  router.post('/logout', verifySameOriginMutation, (req, res) => {
    const token = extractSessionToken(req);
    db.deleteSession(token);
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  router.post('/forgot-password', verifySameOriginMutation, async (req, res) => {
    const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : '';
    if (!isValidEmail(email)) {
      res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Please enter a valid email address.' },
      });
      return;
    }

    if (!isPasswordResetEmailConfigured()) {
      res.status(503).json({
        error: {
          code: 'EMAIL_NOT_CONFIGURED',
          message:
            'Password reset email delivery is not configured yet. Set RESEND_API_KEY and EMAIL_FROM in server environment secrets to enable password reset emails.',
        },
      });
      return;
    }

    const userRow = db.getUserByEmail(email);
    if (userRow) {
      const rawToken = db.createPasswordResetToken(userRow.id);
      const resetUrl = `${getAppBaseUrl(req)}/?resetToken=${encodeURIComponent(rawToken)}`;
      try {
        await sendPasswordResetEmail({ toEmail: userRow.email, resetUrl });
      } catch (err) {
        if (err instanceof OAuthConfigError) {
          res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
          return;
        }
        throw err;
      }
    }

    res.json({
      ok: true,
      message:
        'If an account exists for that email address, a password reset link has been sent.',
    });
  });

  router.post('/reset-password', verifySameOriginMutation, async (req, res) => {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!token) {
      res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Reset token is missing.' } });
      return;
    }
    const pwCheck = validatePasswordStrength(newPassword);
    if (!pwCheck.valid) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: pwCheck.message } });
      return;
    }

    const consumed = db.consumePasswordResetToken(token);
    if (!consumed) {
      res.status(400).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'This password reset link is invalid or has expired.',
        },
      });
      return;
    }

    const passwordHash = await hashPassword(newPassword);
    db.updateUserPassword(consumed.userId, passwordHash);

    const sessionToken = db.createSession(consumed.userId);
    setSessionCookie(req, res, sessionToken);
    res.json({ user: db.getAuthUserProfile(consumed.userId), sessionToken });
  });

  router.patch('/profile', verifySameOriginMutation, (req, res) => {
    const authUser = getAuthenticatedUserFromRequest(req, db);
    if (!authUser) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } });
      return;
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Name cannot be empty.' } });
      return;
    }

    db.updateUserProfile(authUser.id, { name });
    res.json({ user: db.getAuthUserProfile(authUser.id) });
  });

  router.post('/password', verifySameOriginMutation, async (req, res) => {
    const authUser = getAuthenticatedUserFromRequest(req, db);
    if (!authUser) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } });
      return;
    }

    const currentPassword =
      typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    const pwCheck = validatePasswordStrength(newPassword);
    if (!pwCheck.valid) {
      res.status(400).json({ error: { code: 'INVALID_INPUT', message: pwCheck.message } });
      return;
    }

    const userRow = db.getUserById(authUser.id);
    if (!userRow) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Account not found.' } });
      return;
    }

    if (userRow.password_hash) {
      const ok = await verifyPassword(currentPassword, userRow.password_hash);
      if (!ok) {
        res.status(401).json({
          error: { code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' },
        });
        return;
      }
    }

    const passwordHash = await hashPassword(newPassword);
    db.updateUserPassword(authUser.id, passwordHash);
    res.json({ user: db.getAuthUserProfile(authUser.id) });
  });

  router.get('/google/url', (req, res) => {
    const mode = req.query.mode === 'link' ? 'link' : 'login';
    const sessionUser = getAuthenticatedUserFromRequest(req, db);
    if (mode === 'link' && !sessionUser) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Sign in before connecting Google.' },
      });
      return;
    }

    try {
      const url = buildGoogleAuthUrl({
        req,
        db,
        mode,
        sessionUserId: sessionUser?.id ?? null,
      });
      res.json({ url });
    } catch (err) {
      if (err instanceof OAuthConfigError) {
        res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
        return;
      }
      res.status(500).json({
        error: { code: 'OAUTH_ERROR', message: 'Could not start Google Sign-In.' },
      });
    }
  });

  router.get(['/google/callback', '/google/callback/'], async (req, res) => {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';

    if (oauthError || !code || !state) {
      res
        .status(400)
        .send(
          renderOAuthPopupHtml({
            success: false,
            provider: 'google',
            mode: 'login',
            errorMessage: oauthError
              ? `Google sign-in was cancelled or denied (${oauthError}).`
              : 'Missing authorization code from Google.',
          })
        );
      return;
    }

    try {
      const result = await handleGoogleCallback({ code, state, db });
      let handoffCode: string | undefined;
      if (result.mode === 'login') {
        const token = db.createSession(result.userId);
        setSessionCookie(req, res, token);
        handoffCode = db.createOAuthHandoff(result.userId);
      }
      res.send(
        renderOAuthPopupHtml({
          success: true,
          provider: 'google',
          mode: result.mode,
          handoffCode,
        })
      );
    } catch (err) {
      const message =
        err instanceof OAuthConfigError
          ? err.message
          : 'Google authentication could not be completed.';
      res.status(400).send(
        renderOAuthPopupHtml({
          success: false,
          provider: 'google',
          mode: 'login',
          errorMessage: message,
        })
      );
    }
  });

  router.get('/apple/url', (req, res) => {
    const mode = req.query.mode === 'link' ? 'link' : 'login';
    const sessionUser = getAuthenticatedUserFromRequest(req, db);
    if (mode === 'link' && !sessionUser) {
      res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Sign in before connecting Apple.' },
      });
      return;
    }

    try {
      const url = buildAppleAuthUrl({
        req,
        db,
        mode,
        sessionUserId: sessionUser?.id ?? null,
      });
      res.json({ url });
    } catch (err) {
      if (err instanceof OAuthConfigError) {
        res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
        return;
      }
      res.status(500).json({
        error: { code: 'OAUTH_ERROR', message: 'Could not start Sign in with Apple.' },
      });
    }
  });

  const appleCallbackHandler = async (req: express.Request, res: express.Response) => {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
      string,
      unknown
    >;
    const code =
      typeof body.code === 'string'
        ? body.code
        : typeof req.query.code === 'string'
          ? req.query.code
          : '';
    const state =
      typeof body.state === 'string'
        ? body.state
        : typeof req.query.state === 'string'
          ? req.query.state
          : '';
    const userJson = typeof body.user === 'string' ? body.user : undefined;
    const oauthError =
      typeof body.error === 'string'
        ? body.error
        : typeof req.query.error === 'string'
          ? req.query.error
          : '';

    if (oauthError || !code || !state) {
      res.status(400).send(
        renderOAuthPopupHtml({
          success: false,
          provider: 'apple',
          mode: 'login',
          errorMessage: oauthError
            ? `Apple sign-in was cancelled or denied (${oauthError}).`
            : 'Missing authorization code from Apple.',
        })
      );
      return;
    }

    try {
      const result = await handleAppleCallback({ code, state, userJson, db });
      let handoffCode: string | undefined;
      if (result.mode === 'login') {
        const token = db.createSession(result.userId);
        setSessionCookie(req, res, token);
        handoffCode = db.createOAuthHandoff(result.userId);
      }
      res.send(
        renderOAuthPopupHtml({
          success: true,
          provider: 'apple',
          mode: result.mode,
          handoffCode,
        })
      );
    } catch (err) {
      const message =
        err instanceof OAuthConfigError
          ? err.message
          : 'Apple authentication could not be completed.';
      res.status(400).send(
        renderOAuthPopupHtml({
          success: false,
          provider: 'apple',
          mode: 'login',
          errorMessage: message,
        })
      );
    }
  };

  router.post(
    ['/apple/callback', '/apple/callback/'],
    express.urlencoded({ extended: false }),
    appleCallbackHandler
  );
  router.get(['/apple/callback', '/apple/callback/'], appleCallbackHandler);

  router.post('/oauth/complete', verifySameOriginMutation, (req, res) => {
    const handoffCode =
      typeof req.body?.handoffCode === 'string' ? req.body.handoffCode.trim() : '';
    if (!handoffCode) {
      res.status(400).json({ error: { code: 'INVALID_HANDOFF', message: 'Missing OAuth handoff code.' } });
      return;
    }

    const userId = db.consumeOAuthHandoff(handoffCode);
    if (!userId) {
      res.status(401).json({
        error: { code: 'INVALID_HANDOFF', message: 'OAuth session expired. Please try signing in again.' },
      });
      return;
    }

    const sessionToken = db.createSession(userId);
    setSessionCookie(req, res, sessionToken);
    res.json({ user: db.getAuthUserProfile(userId), sessionToken });
  });

  router.delete('/providers/:provider', verifySameOriginMutation, (req, res) => {
    const authUser = getAuthenticatedUserFromRequest(req, db);
    if (!authUser) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required.' } });
      return;
    }

    const provider = req.params.provider as OAuthProviderName;
    if (provider !== 'google' && provider !== 'apple') {
      res.status(400).json({
        error: { code: 'INVALID_PROVIDER', message: 'Unsupported authentication provider.' },
      });
      return;
    }

    const connectedOAuthProviders = authUser.connectedProviders
      .map((p) => p.provider)
      .filter((p): p is OAuthProviderName => p === 'google' || p === 'apple');

    const check = canDisconnectProvider({
      hasPassword: authUser.hasPassword,
      connectedOAuthProviders,
      providerToRemove: provider,
    });

    if (!check.allowed) {
      res.status(400).json({
        error: { code: 'LAST_AUTH_METHOD', message: check.reason },
      });
      return;
    }

    db.removeOAuthIdentity(authUser.id, provider);
    res.json({ user: db.getAuthUserProfile(authUser.id) });
  });

  return router;
}
