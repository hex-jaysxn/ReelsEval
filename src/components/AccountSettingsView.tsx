import { useState, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Link2,
  LogOut,
  ShieldCheck,
  Unlink,
  User as UserIcon,
} from 'lucide-react';
import type { AuthProviderAvailability, AuthUser } from '../types/auth.ts';
import { launchOAuthPopup } from '../utils/oauthPopup.ts';

interface AccountSettingsViewProps {
  user: AuthUser;
  sessionToken: string | null;
  providerAvailability: AuthProviderAvailability | null;
  onUserUpdated: (user: AuthUser) => void;
  onLogout: () => void;
}

export function AccountSettingsView({
  user,
  sessionToken,
  providerAvailability,
  onUserUpdated,
  onLogout,
}: AccountSettingsViewProps) {
  const [name, setName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const googleConnection = user.connectedProviders.find((p) => p.provider === 'google');
  const appleConnection = user.connectedProviders.find((p) => p.provider === 'apple');

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Requested-With': 'ReelsEvaluator',
  };
  if (sessionToken) {
    authHeaders.Authorization = `Bearer ${sessionToken}`;
  }

  async function refreshProfile() {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
    const res = await fetch('/api/auth/me', { credentials: 'same-origin', headers });
    const data = (await res.json().catch(() => null)) as { user?: AuthUser | null } | null;
    if (data?.user) {
      onUserUpdated(data.user);
    }
  }

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setBusyAction('profile');

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: authHeaders,
        body: JSON.stringify({ name }),
      });
      const data = (await res.json().catch(() => null)) as {
        user?: AuthUser;
        error?: { message?: string };
      } | null;
      if (!res.ok || !data?.user) {
        setErrorMessage(data?.error?.message || 'Could not update profile.');
      } else {
        onUserUpdated(data.user);
        setSuccessMessage('Profile name updated.');
      }
    } catch {
      setErrorMessage('Network error while updating profile.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePasswordSave(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match.');
      return;
    }

    setBusyAction('password');
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: authHeaders,
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json().catch(() => null)) as {
        user?: AuthUser;
        error?: { message?: string };
      } | null;
      if (!res.ok || !data?.user) {
        setErrorMessage(data?.error?.message || 'Could not update password.');
      } else {
        onUserUpdated(data.user);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccessMessage(
          user.hasPassword ? 'Password updated.' : 'Password added to your account.'
        );
      }
    } catch {
      setErrorMessage('Network error while updating password.');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConnectProvider(provider: 'google' | 'apple') {
    setErrorMessage(null);
    setSuccessMessage(null);
    setBusyAction(`connect_${provider}`);

    await launchOAuthPopup({
      provider,
      mode: 'link',
      sessionToken,
      onSuccess: async () => {
        await refreshProfile();
        setBusyAction(null);
        setSuccessMessage(
          `${provider === 'google' ? 'Google' : 'Apple'} account connected.`
        );
      },
      onError: (msg) => {
        setBusyAction(null);
        setErrorMessage(msg);
      },
    });
  }

  async function handleDisconnectProvider(provider: 'google' | 'apple') {
    setErrorMessage(null);
    setSuccessMessage(null);
    setBusyAction(`disconnect_${provider}`);

    try {
      const res = await fetch(`/api/auth/providers/${provider}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: authHeaders,
      });
      const data = (await res.json().catch(() => null)) as {
        user?: AuthUser;
        error?: { message?: string };
      } | null;
      if (!res.ok || !data?.user) {
        setErrorMessage(data?.error?.message || 'Could not disconnect provider.');
      } else {
        onUserUpdated(data.user);
        setSuccessMessage(
          `${provider === 'google' ? 'Google' : 'Apple'} sign-in disconnected.`
        );
      }
    } catch {
      setErrorMessage('Network error while disconnecting provider.');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section aria-label="Account Settings" className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-12 w-12 rounded-full border border-slate-200 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 font-display font-bold text-base">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-display text-lg font-bold text-slate-900">{user.name}</h1>
            <p className="text-sm text-slate-600">{user.email}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {user.emailVerified ? 'Verified email' : 'Unverified email'} · Member since{' '}
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shrink-0"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-2.5 text-sm text-red-800"
        >
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p>{errorMessage}</p>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-2.5 text-sm text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p>{successMessage}</p>
        </div>
      )}

      {/* Connected Authentication Providers */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Connected Authentication Providers
            </h2>
            <p className="text-xs text-slate-500">
              Manage how you sign in to this account. Matching verified emails link automatically.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
          {/* Email & Password */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Email & Password</p>
              <p className="text-xs text-slate-500">
                {user.hasPassword
                  ? `Password enabled for ${user.email}`
                  : 'No password set yet (signed up with external provider)'}
              </p>
            </div>
            <span
              className={`text-xs font-semibold ${
                user.hasPassword ? 'text-emerald-700' : 'text-slate-500'
              }`}
            >
              {user.hasPassword ? 'Connected' : 'Not set'}
            </span>
          </div>

          {/* Google */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Google</p>
              <p className="text-xs text-slate-500">
                {googleConnection
                  ? `Connected as ${googleConnection.email || user.email}`
                  : 'Quick sign-in with your Google account'}
              </p>
            </div>
            {googleConnection ? (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => handleDisconnectProvider('google')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => handleConnectProvider('google')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{busyAction === 'connect_google' ? 'Connecting...' : 'Connect Google'}</span>
              </button>
            )}
          </div>

          {/* Apple */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Apple</p>
              <p className="text-xs text-slate-500">
                {appleConnection
                  ? `Connected as ${appleConnection.email || user.email}${
                      appleConnection.isPrivateRelay ? ' (Private Relay)' : ''
                    }`
                  : 'Sign in with Apple (supports Private Relay email)'}
              </p>
            </div>
            {appleConnection ? (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => handleDisconnectProvider('apple')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => handleConnectProvider('apple')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{busyAction === 'connect_apple' ? 'Connecting...' : 'Connect Apple'}</span>
              </button>
            )}
          </div>
        </div>

        {providerAvailability &&
          (!providerAvailability.googleConfigured || !providerAvailability.appleConfigured) && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 space-y-1.5">
              <p className="font-semibold text-slate-800">OAuth Callback & Environment Reference</p>
              <p>
                Google Callback URL:{' '}
                <code className="font-mono text-slate-800 break-all">
                  {providerAvailability.callbackUrls.google}
                </code>
              </p>
              <p>
                Apple Callback URL:{' '}
                <code className="font-mono text-slate-800 break-all">
                  {providerAvailability.callbackUrls.apple}
                </code>
              </p>
            </div>
          )}
      </div>

      {/* Profile & Password Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleSaveProfile}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-slate-900">Profile Details</h3>
          </div>
          <div>
            <label htmlFor="settings-name" className="block text-xs font-medium text-slate-700 mb-1.5">
              Display Name
            </label>
            <input
              id="settings-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>
          <button
            type="submit"
            disabled={busyAction !== null}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busyAction === 'profile' ? 'Saving...' : 'Save Name'}
          </button>
        </form>

        <form
          onSubmit={handlePasswordSave}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-indigo-600" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-slate-900">
              {user.hasPassword ? 'Change Password' : 'Set Account Password'}
            </h3>
          </div>

          {user.hasPassword && (
            <div>
              <label
                htmlFor="settings-current-password"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Current Password
              </label>
              <input
                id="settings-current-password"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="settings-new-password"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              New Password
            </label>
            <input
              id="settings-new-password"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          <div>
            <label
              htmlFor="settings-confirm-password"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Confirm Password
            </label>
            <input
              id="settings-confirm-password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>

          <button
            type="submit"
            disabled={busyAction !== null}
            className="px-4 py-2 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busyAction === 'password'
              ? 'Updating...'
              : user.hasPassword
                ? 'Update Password'
                : 'Set Password'}
          </button>
        </form>
      </div>
    </section>
  );
}
