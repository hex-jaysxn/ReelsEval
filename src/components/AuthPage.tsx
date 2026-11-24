import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, KeyRound, Lock, Mail, User } from 'lucide-react';
import type { AuthProviderAvailability, AuthUser } from '../types/auth.ts';
import { launchOAuthPopup } from '../utils/oauthPopup.ts';
import { SocialAuthButtons } from './SocialAuthButtons.tsx';
import { ActionButton, AlertBanner, ElevatedGlassPanel, GlassPanel, ReeViewMark } from './ui/GlassPrimitives.tsx';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

interface AuthPageProps {
  initialMode?: 'login' | 'register';
  initialResetToken?: string | null;
  initialAuthError?: string | null;
  providerAvailability: AuthProviderAvailability | null;
  onAuthenticated: (user: AuthUser, sessionToken?: string) => void;
  onBackToLanding?: () => void;
}

export function AuthPage({
  initialMode = 'login',
  initialResetToken,
  initialAuthError,
  providerAvailability,
  onAuthenticated,
  onBackToLanding,
}: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(initialResetToken ? 'reset' : initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState(initialResetToken || '');

  const [busyProvider, setBusyProvider] = useState<'google' | 'password' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialAuthError || null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialResetToken) {
      setMode('reset');
      setResetToken(initialResetToken);
    }
  }, [initialResetToken]);

  useEffect(() => {
    if (!initialResetToken) {
      setMode(initialMode);
    }
  }, [initialMode, initialResetToken]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrorMessage(null);
    setInfoMessage(null);
  }

  async function handleOAuthSignIn(provider: 'google') {
    setErrorMessage(null);
    setInfoMessage(null);
    setBusyProvider(provider);

    await launchOAuthPopup({
      provider,
      mode: 'login',
      sessionToken: null,
      onSuccess: async ({ user, sessionToken }) => {
        if (user) {
          setBusyProvider(null);
          onAuthenticated(user, sessionToken);
          return;
        }
        try {
          const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
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
        setBusyProvider(null);
        setErrorMessage(msg);
      },
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
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
        const data = (await res.json().catch(() => null)) as {
          message?: string;
          error?: { message?: string };
        } | null;
        if (!res.ok) {
          setErrorMessage(data?.error?.message || 'Unable to send password reset email.');
        } else {
          setInfoMessage(
            data?.message ||
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
        const data = (await res.json().catch(() => null)) as {
          user?: AuthUser;
          sessionToken?: string;
          error?: { message?: string };
        } | null;
        if (!res.ok || !data?.user) {
          setErrorMessage(data?.error?.message || 'Could not reset password.');
        } else {
          window.history.replaceState({}, '', '/');
          onAuthenticated(data.user, data.sessionToken);
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
      const data = (await res.json().catch(() => null)) as {
        user?: AuthUser;
        sessionToken?: string;
        error?: { message?: string };
      } | null;

      if (!res.ok || !data?.user) {
        setErrorMessage(
          data?.error?.message ||
            (mode === 'register' ? 'Could not create account.' : 'Sign in failed.')
        );
        return;
      }

      onAuthenticated(data.user, data.sessionToken);
    } catch {
      setErrorMessage('Network error while contacting authentication server.');
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <div className="min-h-screen rv-atmosphere flex flex-col justify-center py-6 px-4 sm:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-[460px] rv-animate-in">
        {onBackToLanding && (
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={onBackToLanding}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Back to ReeView Overview</span>
            </button>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 mb-4">
          <ReeViewMark size="md" />
          <span className="font-display text-2xl font-bold tracking-tight text-white">
            ReeView
          </span>
        </div>

        <ElevatedGlassPanel className="p-6 sm:p-7">
          {mode !== 'forgot' && mode !== 'reset' && (
            <div
              className="flex rounded-xl bg-slate-950/75 border border-white/8 p-1 mb-6"
              role="tablist"
              aria-label="Authentication mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => switchMode('login')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                onClick={() => switchMode('register')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  mode === 'register'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          <div className="mb-5">
            <h1 className="font-display text-xl font-bold text-white">
              {mode === 'login'
                ? 'Welcome back to ReeView'
                : mode === 'register'
                  ? 'Create your ReeView account'
                  : mode === 'forgot'
                    ? 'Reset your password'
                    : 'Set a new password'}
            </h1>
            <p className="mt-1 text-sm text-slate-300 leading-relaxed">
              {mode === 'login'
                ? 'Sign in to evaluate short-form Reels and access your saved assessments.'
                : mode === 'register'
                  ? 'Start evaluating marketing Reels with Google Gemini Free Tier.'
                  : mode === 'forgot'
                    ? 'Enter the email associated with your account to receive a reset link.'
                    : 'Choose a strong password (minimum 8 characters) for your account.'}
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5">
              <AlertBanner tone="error" message={errorMessage} />
            </div>
          )}

          {infoMessage && (
            <div className="mb-5">
              <AlertBanner tone="success" message={infoMessage} />
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <>
              <SocialAuthButtons
                onGoogleClick={() => handleOAuthSignIn('google')}
                busyProvider={busyProvider}
              />

              <div className="relative my-6 flex items-center" aria-hidden="true">
                <div className="flex-grow border-t border-white/12" />
                <span className="mx-3 shrink-0 text-xs font-semibold tracking-wider text-slate-400">
                  OR
                </span>
                <div className="flex-grow border-t border-white/12" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
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
                <label htmlFor="auth-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
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
                  <label htmlFor="auth-password" className="block text-xs font-medium text-slate-300">
                    {mode === 'reset' ? 'New Password' : 'Password'}
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs font-medium text-indigo-300 hover:text-indigo-200 cursor-pointer focus-visible:outline-none focus-visible:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
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
                <label htmlFor="auth-confirm-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <KeyRound className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
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
              className="mt-4 w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white py-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Back to Sign In</span>
            </button>
          )}
        </ElevatedGlassPanel>

        {providerAvailability && !providerAvailability.googleConfigured && (
          <GlassPanel className="mt-4 p-4 text-xs text-slate-300 space-y-1.5">
            <p className="font-semibold text-white">OAuth Provider Configuration Status</p>
            <p>
              Google Sign-In requires <code className="font-mono text-indigo-300">GOOGLE_CLIENT_ID</code> and{' '}
              <code className="font-mono text-indigo-300">GOOGLE_CLIENT_SECRET</code>.
            </p>
          </GlassPanel>
        )}
      </div>
    </div>
  );
}
