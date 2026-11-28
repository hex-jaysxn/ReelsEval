import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ExternalLink, KeyRound, Lock, Mail, RotateCw, ShieldCheck, User } from 'lucide-react';
import type { AuthProviderAvailability, AuthUser } from '../types/auth.ts';
import type { AppRoute } from '../utils/appRoute.ts';
import { parseAuthApiResponse } from '../utils/authResponse.ts';
import { launchOAuthPopup } from '../utils/oauthPopup.ts';
import { SocialAuthButtons } from './SocialAuthButtons.tsx';
import { ActionButton, AlertBanner, ElevatedGlassPanel, GlassPanel, ReeViewMark } from './ui/GlassPrimitives.tsx';
import {
  BlurRevealText,
  ClipRevealHeading,
  RV_EASE,
  RV_SPRING,
  ScaleMaskReveal,
  ScrollDepthBackdrop,
} from './ui/MotionPrimitives.tsx';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

interface OtpChallengeState {
  challengeId: string;
  purpose: 'login' | 'register';
  maskedEmail: string;
}

interface AuthPageProps {
  initialMode?: 'login' | 'register';
  initialResetToken?: string | null;
  initialAuthError?: string | null;
  proxyBlockedNotice?: string | null;
  providerAvailability: AuthProviderAvailability | null;
  onAuthenticated: (user: AuthUser, sessionToken?: string) => void;
  onBackToLanding?: () => void;
  onNavigateRoute?: (route: AppRoute) => void;
}

export function AuthPage({
  initialMode = 'login',
  initialResetToken,
  initialAuthError,
  proxyBlockedNotice,
  providerAvailability,
  onAuthenticated,
  onBackToLanding,
  onNavigateRoute,
}: AuthPageProps) {
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<AuthMode>(initialResetToken ? 'reset' : initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem('reeview_remembered_email') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState(initialResetToken || '');

  const [otpChallenge, setOtpChallenge] = useState<OtpChallengeState | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  const [busyProvider, setBusyProvider] = useState<'google' | 'password' | null>(null);
  const cancelOAuthRef = useRef<(() => void) | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialAuthError || proxyBlockedNotice || null
  );
  const [isProxyError, setIsProxyError] = useState<boolean>(
    Boolean(!initialAuthError && proxyBlockedNotice)
  );
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      cancelOAuthRef.current?.();
      cancelOAuthRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!initialAuthError && proxyBlockedNotice) {
      setErrorMessage((prev) => prev || proxyBlockedNotice);
      setIsProxyError(true);
    }
  }, [initialAuthError, proxyBlockedNotice]);

  useEffect(() => {
    if (initialResetToken) {
      setMode('reset');
      setResetToken(initialResetToken);
      setOtpChallenge(null);
    }
  }, [initialResetToken]);

  useEffect(() => {
    if (!initialResetToken) {
      setMode(initialMode);
      setOtpChallenge(null);
    }
  }, [initialMode, initialResetToken]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCountdown]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setOtpChallenge(null);
    setOtpCode('');
    setResendCountdown(0);
    setErrorMessage(proxyBlockedNotice || null);
    setIsProxyError(Boolean(proxyBlockedNotice));
    setInfoMessage(null);
  }

  function handleCancelOAuth() {
    cancelOAuthRef.current?.();
    cancelOAuthRef.current = null;
    setBusyProvider(null);
  }

  async function handleOAuthSignIn(provider: 'google') {
    cancelOAuthRef.current?.();
    cancelOAuthRef.current = null;
    setErrorMessage(null);
    setIsProxyError(false);
    setInfoMessage(null);
    setBusyProvider(provider);

    await launchOAuthPopup({
      provider,
      mode: 'login',
      sessionToken: null,
      onCancelReady: (cancelFn) => {
        cancelOAuthRef.current = cancelFn;
      },
      onSuccess: async ({ user, sessionToken }) => {
        cancelOAuthRef.current = null;
        if (user) {
          setBusyProvider(null);
          onAuthenticated(user, sessionToken);
          return;
        }
        try {
          const headers: Record<string, string> = { Accept: 'application/json' };
          if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
          const res = await fetch('/api/auth/me', {
            credentials: 'same-origin',
            headers,
          });
          const data = (await res.json().catch(() => null)) as { user?: AuthUser | null } | null;
          setBusyProvider(null);
          if (data?.user) {
            onAuthenticated(data.user, sessionToken);
          } else {
            setErrorMessage('Authentication succeeded, but session could not be verified. Please retry.');
          }
        } catch {
          setBusyProvider(null);
          setErrorMessage('Failed to verify session after OAuth sign-in.');
        }
      },
      onError: (msg) => {
        cancelOAuthRef.current = null;
        setBusyProvider(null);
        setErrorMessage(msg);
      },
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setIsProxyError(false);
    setInfoMessage(null);

    if (mode === 'forgot') {
      setBusyProvider('password');
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'ReelsEvaluator',
          },
          body: JSON.stringify({ email }),
        });
        const parsed = parseAuthApiResponse({
          ok: res.ok,
          status: res.status,
          contentType: res.headers.get('content-type'),
          redirected: res.redirected,
          rawBody: await res.text(),
        });
        if (!parsed.ok) {
          setErrorMessage(parsed.error.message);
        } else {
          setInfoMessage(
            parsed.data.message ||
              'If an account exists for that email address, reset instructions have been sent.'
          );
        }
      } catch {
        setErrorMessage('Network error while requesting password reset.');
      } finally {
        setBusyProvider(null);
      }
      return;
    }

    if (mode === 'reset') {
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
      setBusyProvider('password');
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'ReelsEvaluator',
          },
          body: JSON.stringify({ token: resetToken, newPassword: password }),
        });
        const parsed = parseAuthApiResponse({
          ok: res.ok,
          status: res.status,
          contentType: res.headers.get('content-type'),
          redirected: res.redirected,
          rawBody: await res.text(),
        });
        if (!parsed.ok || !parsed.data.user) {
          setErrorMessage(
            !parsed.ok ? parsed.error.message : 'Could not reset password.'
          );
        } else {
          window.history.replaceState({}, '', '/');
          onAuthenticated(parsed.data.user, parsed.data.sessionToken);
        }
      } catch {
        setErrorMessage('Network error while resetting password.');
      } finally {
        setBusyProvider(null);
      }
      return;
    }

    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const bodyPayload =
      mode === 'register' ? { name, email, password } : { email, password };

    setBusyProvider('password');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'ReelsEvaluator',
        },
        body: JSON.stringify(bodyPayload),
      });
      const parsed = parseAuthApiResponse({
        ok: res.ok,
        status: res.status,
        contentType: res.headers.get('content-type'),
        redirected: res.redirected,
        rawBody: await res.text(),
      });

      if (!parsed.ok) {
        setErrorMessage(parsed.error.message);
        setIsProxyError(parsed.error.code === 'SESSION_OR_PROXY_HTML');
        return;
      }

      const data = parsed.data;
      if (data.otpRequired && data.challengeId) {
        setOtpChallenge({
          challengeId: data.challengeId,
          purpose: data.purpose || (mode === 'register' ? 'register' : 'login'),
          maskedEmail: data.maskedEmail || email,
        });
        setOtpCode('');
        setResendCountdown(data.resendCooldownSeconds ?? 30);
        return;
      }

      if (data.user) {
        onAuthenticated(data.user, data.sessionToken);
      } else {
        setErrorMessage(
          `Unexpected response payload from authentication server (HTTP ${res.status}).`
        );
      }
    } catch {
      setErrorMessage('Network error while contacting authentication server.');
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    if (!otpChallenge) return;
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanedCode = otpCode.replace(/\D/g, '');
    if (cleanedCode.length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setBusyProvider('password');
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'ReelsEvaluator',
        },
        body: JSON.stringify({
          challengeId: otpChallenge.challengeId,
          code: cleanedCode,
        }),
      });
      const parsed = parseAuthApiResponse({
        ok: res.ok,
        status: res.status,
        contentType: res.headers.get('content-type'),
        redirected: res.redirected,
        rawBody: await res.text(),
      });

      if (!parsed.ok || !parsed.data.user) {
        setErrorMessage(
          !parsed.ok ? parsed.error.message : 'Verification failed. Please try again.'
        );
        return;
      }

      onAuthenticated(parsed.data.user, parsed.data.sessionToken);
    } catch {
      setErrorMessage('Network error while verifying code.');
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleResendOtp() {
    if (!otpChallenge || resendCountdown > 0 || busyProvider !== null) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setBusyProvider('password');

    try {
      const res = await fetch('/api/auth/otp/resend', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Requested-With': 'ReelsEvaluator',
        },
        body: JSON.stringify({ challengeId: otpChallenge.challengeId }),
      });
      const parsed = parseAuthApiResponse({
        ok: res.ok,
        status: res.status,
        contentType: res.headers.get('content-type'),
        redirected: res.redirected,
        rawBody: await res.text(),
      });

      if (!parsed.ok) {
        if (parsed.error.retryAfterSeconds) {
          setResendCountdown(parsed.error.retryAfterSeconds);
        }
        setErrorMessage(parsed.error.message);
        return;
      }

      setOtpCode('');
      setResendCountdown(parsed.data.resendCooldownSeconds ?? 30);
      setInfoMessage(
        `A new 6-digit verification code was sent to ${parsed.data.maskedEmail || otpChallenge.maskedEmail}.`
      );
    } catch {
      setErrorMessage('Network error while resending verification code.');
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <div className="relative min-h-screen rv-atmosphere overflow-x-clip flex flex-col justify-center py-6 px-4 sm:px-6 text-slate-50">
      <ScrollDepthBackdrop />
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-[460px]">
        {onBackToLanding && (
          <motion.div
            initial={reduced ? { opacity: 1 } : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduced ? 0.01 : 0.3, ease: RV_EASE }}
            className="mb-3 flex items-center justify-between"
          >
            <button
              type="button"
              onClick={onBackToLanding}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-200 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Back to ReeView Overview</span>
            </button>
          </motion.div>
        )}

        <motion.div
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0.01 : 0.36, delay: 0.04, ease: RV_EASE }}
          className="flex items-center justify-center gap-3 mb-4"
        >
          <ReeViewMark size="lg" />
          <span className="font-display text-2xl font-bold tracking-tight text-white">
            ReeView
          </span>
        </motion.div>

        <ScaleMaskReveal delay={0.08}>
          <ElevatedGlassPanel className="p-6 sm:p-7">
            {mode !== 'forgot' && mode !== 'reset' && !otpChallenge && (
              <div
                className="flex rounded-xl bg-[#070b28] border border-sky-400/20 p-1 mb-6"
                role="tablist"
                aria-label="Authentication mode"
              >
                {(
                  [
                    { id: 'login', label: 'Sign In' },
                    { id: 'register', label: 'Create Account' },
                  ] as const
                ).map((tab) => {
                  const selected = mode === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => switchMode(tab.id)}
                      className={`relative flex-1 py-2 text-sm font-medium rounded-lg transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                        selected ? 'text-white' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {selected && (
                        <motion.span
                          layoutId="rv-auth-tab-pill"
                          transition={reduced ? { duration: 0.01 } : RV_SPRING}
                          className="absolute inset-0 rounded-lg rv-cta-gradient shadow-sm"
                          aria-hidden="true"
                        />
                      )}
                      <span className="relative z-10">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mb-5">
              <ClipRevealHeading delay={0.14}>
                <h1 className="font-display text-xl font-bold text-white">
                  {otpChallenge
                    ? 'Verify your email'
                    : mode === 'login'
                      ? 'Welcome back to ReeView'
                      : mode === 'register'
                        ? 'Create your ReeView account'
                        : mode === 'forgot'
                          ? 'Reset your password'
                          : 'Set a new password'}
                </h1>
              </ClipRevealHeading>
              <BlurRevealText delay={0.2}>
                <p className="mt-1 text-sm text-slate-200 leading-relaxed">
                  {otpChallenge
                    ? `Enter the 6-digit verification code sent to ${otpChallenge.maskedEmail} before ${
                        otpChallenge.purpose === 'register'
                          ? 'completing registration'
                          : 'signing in'
                      }.`
                    : mode === 'login'
                      ? 'Sign in with Google or verify via Email OTP to access your saved assessments.'
                      : mode === 'register'
                        ? 'Start evaluating marketing Reels with Google Gemini Free Tier.'
                        : mode === 'forgot'
                          ? 'Enter the email associated with your account to receive a reset link.'
                          : 'Choose a strong password (minimum 8 characters) for your account.'}
                </p>
              </BlurRevealText>
            </div>

            <AnimatePresence>
              {errorMessage && (
                <div className="mb-5">
                  <AlertBanner
                    key={errorMessage}
                    tone="error"
                    message={errorMessage}
                    actionLayout="stacked"
                    action={
                      isProxyError ? (
                        <a
                          href={window.location.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300/40 bg-red-500/25 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-500/35 active:scale-[0.98] transition-all duration-150"
                        >
                          <span>Open ReeView in New Tab</span>
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      ) : undefined
                    }
                  />
                </div>
              )}

              {infoMessage && (
                <div className="mb-5">
                  <AlertBanner key={infoMessage} tone="success" message={infoMessage} />
                </div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {otpChallenge ? (
                <motion.form
                  key={`otp-${otpChallenge.challengeId}`}
                  initial={reduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: reduced ? 0.01 : 0.2, ease: RV_EASE }}
                  onSubmit={handleVerifyOtp}
                  className="space-y-4"
                >
                  <div>
                    <label htmlFor="auth-otp-code" className="block text-xs font-medium text-slate-200 mb-1.5">
                      6-Digit Verification Code
                    </label>
                    <div className="relative">
                      <ShieldCheck className="h-4 w-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                      <input
                        id="auth-otp-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        required
                        autoFocus
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="w-full h-12 px-10 rounded-xl rv-input-solid font-mono text-lg tracking-[0.35em] text-center"
                      />
                    </div>
                  </div>

                  <ActionButton
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={busyProvider !== null || otpCode.length !== 6}
                    className="w-full"
                  >
                    {busyProvider === 'password'
                      ? 'Verifying...'
                      : otpChallenge.purpose === 'register'
                        ? 'Verify & Create Account'
                        : 'Verify & Sign In'}
                  </ActionButton>

                  <div className="flex items-center justify-between pt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpChallenge(null);
                        setOtpCode('');
                        setResendCountdown(0);
                        setErrorMessage(null);
                        setInfoMessage(null);
                      }}
                      className="inline-flex items-center gap-1.5 font-medium text-slate-200 hover:text-white transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Use a different email</span>
                    </button>

                    <button
                      type="button"
                      disabled={resendCountdown > 0 || busyProvider !== null}
                      onClick={handleResendOtp}
                      className="inline-flex items-center gap-1.5 font-medium text-cyan-300 hover:text-cyan-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    >
                      <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend code'}
                      </span>
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.div
                  key={`form-${mode}`}
                  initial={reduced ? { opacity: 1 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: reduced ? 0.01 : 0.2, ease: RV_EASE }}
                >
                  {(mode === 'login' || mode === 'register') && (
                    <>
                      <SocialAuthButtons
                        onGoogleClick={() => handleOAuthSignIn('google')}
                        onCancelClick={handleCancelOAuth}
                        busyProvider={busyProvider}
                      />

                      <div className="relative my-6 flex items-center" aria-hidden="true">
                        <div className="flex-grow border-t border-sky-400/15" />
                        <span className="mx-3 shrink-0 text-xs font-semibold tracking-wider text-slate-300">
                          OR
                        </span>
                        <div className="flex-grow border-t border-sky-400/15" />
                      </div>
                    </>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'register' && (
                      <div>
                        <label htmlFor="auth-name" className="block text-xs font-medium text-slate-200 mb-1.5">
                          Full Name
                        </label>
                        <div className="relative">
                          <User className="h-4 w-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                          <input
                            id="auth-name"
                            type="text"
                            autoComplete="name"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Alex Rivera"
                            className="w-full h-11 pl-9 pr-3 rounded-xl rv-input-solid text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
                      <div>
                        <label htmlFor="auth-email" className="block text-xs font-medium text-slate-200 mb-1.5">
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className="h-4 w-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                          <input
                            id="auth-email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@company.com"
                            className="w-full h-11 pl-9 pr-3 rounded-xl rv-input-solid text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {(mode === 'login' || mode === 'register' || mode === 'reset') && (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor="auth-password" className="block text-xs font-medium text-slate-200">
                            {mode === 'reset' ? 'New Password' : 'Password'}
                          </label>
                          {mode === 'login' && (
                            <button
                              type="button"
                              onClick={() => switchMode('forgot')}
                              className="text-xs font-medium text-cyan-300 hover:text-cyan-200 cursor-pointer focus-visible:outline-none focus-visible:underline"
                            >
                              Forgot password?
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <Lock className="h-4 w-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                          <input
                            id="auth-password"
                            type="password"
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={mode === 'login' ? 'Enter your password' : 'At least 8 characters'}
                            className="w-full h-11 pl-9 pr-3 rounded-xl rv-input-solid text-sm"
                          />
                        </div>
                      </div>
                    )}

                    {mode === 'reset' && (
                      <div>
                        <label htmlFor="auth-confirm-password" className="block text-xs font-medium text-slate-200 mb-1.5">
                          Confirm New Password
                        </label>
                        <div className="relative">
                          <KeyRound className="h-4 w-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                          <input
                            id="auth-confirm-password"
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={8}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter your new password"
                            className="w-full h-11 pl-9 pr-3 rounded-xl rv-input-solid text-sm"
                          />
                        </div>
                      </div>
                    )}

                    <ActionButton
                      type="submit"
                      variant="primary"
                      size="lg"
                      disabled={busyProvider !== null}
                      className="w-full"
                    >
                      {busyProvider === 'password'
                        ? 'Please wait...'
                        : mode === 'login'
                          ? 'Sign In with Email'
                          : mode === 'register'
                            ? 'Create Account'
                            : mode === 'forgot'
                              ? 'Send Reset Link'
                              : 'Update Password'}
                    </ActionButton>
                  </form>

                  {(mode === 'forgot' || mode === 'reset') && (
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="mt-4 w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-200 hover:text-white py-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Back to Sign In</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </ElevatedGlassPanel>
        </ScaleMaskReveal>

        {providerAvailability &&
          (!providerAvailability.googleConfigured || !providerAvailability.emailOtpConfigured) && (
            <GlassPanel className="mt-4 p-4 text-xs text-slate-200 space-y-1.5">
              <p className="font-semibold text-white">Authentication Configuration Status</p>
              {!providerAvailability.googleConfigured && (
                <p>
                  Google Sign-In requires <code className="font-mono text-cyan-300">GOOGLE_CLIENT_ID</code> and{' '}
                  <code className="font-mono text-cyan-300">GOOGLE_CLIENT_SECRET</code>.
                </p>
              )}
              {!providerAvailability.emailOtpConfigured && (
                <p>
                  Email OTP verification requires Gmail/SMTP (<code className="font-mono text-cyan-300">SMTP_USER</code> +{' '}
                  <code className="font-mono text-cyan-300">SMTP_PASS</code>) or{' '}
                  <code className="font-mono text-cyan-300">BREVO_API_KEY</code> +{' '}
                  <code className="font-mono text-cyan-300">EMAIL_FROM</code>.
                </p>
              )}
            </GlassPanel>
          )}

        {onNavigateRoute && (
          <div className="mt-5 flex items-center justify-center gap-4 text-xs text-slate-300">
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                onNavigateRoute('privacy');
              }}
              className="hover:text-white transition-colors rv-link-underline"
            >
              Privacy Policy
            </a>
            <span className="text-slate-500" aria-hidden="true">·</span>
            <a
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                onNavigateRoute('terms');
              }}
              className="hover:text-white transition-colors rv-link-underline"
            >
              Terms of Service
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
