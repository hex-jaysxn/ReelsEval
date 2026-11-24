import { useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, ArrowLeft, BarChart3, CheckCircle2, KeyRound, Mail, Lock, User } from 'lucide-react';
import type { AuthProviderAvailability, AuthUser } from '../types/auth.ts';
import { launchOAuthPopup } from '../utils/oauthPopup.ts';
import { SocialAuthButtons } from './SocialAuthButtons.tsx';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

interface AuthPageProps {
  initialResetToken?: string | null;
  initialAuthError?: string | null;
  providerAvailability: AuthProviderAvailability | null;
  onAuthenticated: (user: AuthUser, sessionToken?: string) => void;
}

export function AuthPage({
  initialResetToken,
  initialAuthError,
  providerAvailability,
  onAuthenticated,
}: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(initialResetToken ? 'reset' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState(initialResetToken || '');

  const [busyProvider, setBusyProvider] = useState<'google' | 'apple' | 'password' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialAuthError || null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialResetToken) {
      setMode('reset');
      setResetToken(initialResetToken);
    }
  }, [initialResetToken]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrorMessage(null);
    setInfoMessage(null);
  }

  async function handleOAuthSignIn(provider: 'google' | 'apple') {
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-8 px-4 sm:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-[440px]">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
            ReelsEvaluator
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          {mode !== 'forgot' && mode !== 'reset' && (
            <div className="flex rounded-lg bg-slate-100 p-1 mb-6" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => switchMode('login')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                onClick={() => switchMode('register')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          <div className="mb-5">
            <h1 className="font-display text-xl font-bold text-slate-900">
              {mode === 'login'
                ? 'Welcome back'
                : mode === 'register'
                  ? 'Create your account'
                  : mode === 'forgot'
                    ? 'Reset your password'
                    : 'Set a new password'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
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
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3.5 flex items-start gap-2.5 text-sm text-red-800"
            >
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {infoMessage && (
            <div
              role="status"
              className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 flex items-start gap-2.5 text-sm text-emerald-800"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="leading-relaxed">{infoMessage}</p>
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <>
              <SocialAuthButtons
                onGoogleClick={() => handleOAuthSignIn('google')}
                onAppleClick={() => handleOAuthSignIn('apple')}
                busyProvider={busyProvider}
              />

              <div className="relative my-6 flex items-center" aria-hidden="true">
                <div className="flex-grow border-t border-slate-200" />
                <span className="mx-3 shrink-0 text-xs font-semibold tracking-wider text-slate-400">
                  OR
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="auth-name" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="auth-name"
                    type="text"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
              </div>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
              <div>
                <label htmlFor="auth-email" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
              </div>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="auth-password" className="block text-xs font-medium text-slate-700">
                    {mode === 'reset' ? 'New Password' : 'Password'}
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot')}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 focus-visible:outline-none focus-visible:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'login' ? 'Enter your password' : 'At least 8 characters'}
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
              </div>
            )}

            {mode === 'reset' && (
              <div>
                <label htmlFor="auth-confirm-password" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <KeyRound className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="auth-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={busyProvider !== null}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
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
            </button>
          </form>

          {(mode === 'forgot' || mode === 'reset') && (
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="mt-4 w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 py-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Back to Sign In</span>
            </button>
          )}
        </div>

        {providerAvailability &&
          (!providerAvailability.googleConfigured || !providerAvailability.appleConfigured) && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 space-y-1.5">
              <p className="font-semibold text-slate-800">OAuth Provider Configuration Status</p>
              {!providerAvailability.googleConfigured && (
                <p>
                  Google Sign-In requires <code className="font-mono text-slate-800">GOOGLE_CLIENT_ID</code> and{' '}
                  <code className="font-mono text-slate-800">GOOGLE_CLIENT_SECRET</code>.
                </p>
              )}
              {!providerAvailability.appleConfigured && (
                <p>
                  Apple Sign-In requires <code className="font-mono text-slate-800">APPLE_CLIENT_ID</code>,{' '}
                  <code className="font-mono text-slate-800">APPLE_TEAM_ID</code>,{' '}
                  <code className="font-mono text-slate-800">APPLE_KEY_ID</code>, and{' '}
                  <code className="font-mono text-slate-800">APPLE_PRIVATE_KEY</code>.
                </p>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
