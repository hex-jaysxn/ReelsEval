import { useState, type FormEvent } from 'react';
import {
  KeyRound,
  Link2,
  LogOut,
  ShieldCheck,
  Unlink,
  User as UserIcon,
} from 'lucide-react';
import type { AuthProviderAvailability, AuthUser } from '../types/auth.ts';
import { launchOAuthPopup } from '../utils/oauthPopup.ts';
import { ActionButton, AlertBanner, GlassPanel, StatusBadge } from './ui/GlassPrimitives.tsx';

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

  async function handleConnectProvider(provider: 'google') {
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
        setSuccessMessage('Google account connected.');
      },
      onError: (msg) => {
        setBusyAction(null);
        setErrorMessage(msg);
      },
    });
  }

  async function handleDisconnectProvider(provider: 'google') {
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
        setSuccessMessage('Google sign-in disconnected.');
      }
    } catch {
      setErrorMessage('Network error while disconnecting provider.');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section aria-label="Account Settings" className="space-y-6 rv-animate-in">
      <GlassPanel className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-12 w-12 rounded-full border border-white/20 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-indigo-500/20 border border-indigo-400/35 flex items-center justify-center text-indigo-200 font-display font-bold text-base">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-display text-lg font-bold text-white">{user.name}</h1>
            <p className="text-sm text-slate-300">{user.email}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {user.emailVerified ? 'Verified email' : 'Unverified email'} · Member since{' '}
              {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <ActionButton variant="secondary" size="sm" onClick={onLogout}>
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Sign Out</span>
        </ActionButton>
      </GlassPanel>

      {errorMessage && <AlertBanner tone="error" message={errorMessage} />}
      {successMessage && <AlertBanner tone="success" message={successMessage} />}

      {/* Connected Authentication Providers */}
      <GlassPanel className="p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-indigo-400 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-display text-base font-semibold text-white">
              Connected Authentication Providers
            </h2>
            <p className="text-xs text-slate-400">
              Manage how you sign in to ReeView. Matching verified emails link automatically.
            </p>
          </div>
        </div>

        <div className="divide-y divide-white/10 border border-white/10 rounded-xl bg-slate-950/45">
          {/* Email & Password */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Email &amp; Password</p>
              <p className="text-xs text-slate-400">
                {user.hasPassword
                  ? `Password enabled for ${user.email}`
                  : 'No password set yet (signed up with external provider)'}
              </p>
            </div>
            <StatusBadge tone={user.hasPassword ? 'positive' : 'neutral'}>
              {user.hasPassword ? 'Connected' : 'Not set'}
            </StatusBadge>
          </div>

          {/* Google */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Google</p>
              <p className="text-xs text-slate-400">
                {googleConnection
                  ? `Connected as ${googleConnection.email || user.email}`
                  : 'Quick sign-in with your Google account'}
              </p>
            </div>
            {googleConnection ? (
              <ActionButton
                variant="secondary"
                size="sm"
                disabled={busyAction !== null}
                onClick={() => handleDisconnectProvider('google')}
              >
                <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Disconnect</span>
              </ActionButton>
            ) : (
              <ActionButton
                variant="primary"
                size="sm"
                disabled={busyAction !== null}
                onClick={() => handleConnectProvider('google')}
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{busyAction === 'connect_google' ? 'Connecting...' : 'Connect Google'}</span>
              </ActionButton>
            )}
          </div>

        </div>

        {providerAvailability && !providerAvailability.googleConfigured && (
          <div className="rounded-xl bg-slate-950/65 border border-white/10 p-4 text-xs text-slate-300 space-y-1.5">
            <p className="font-semibold text-white">OAuth Callback &amp; Environment Reference</p>
            <p>
              Google Callback URL:{' '}
              <code className="font-mono text-indigo-300 break-all">
                {providerAvailability.callbackUrls.google}
              </code>
            </p>
          </div>
        )}
      </GlassPanel>

      {/* Profile & Password Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPanel className="p-6">
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-indigo-400" aria-hidden="true" />
              <h3 className="font-display text-base font-semibold text-white">Profile Details</h3>
            </div>
            <div>
              <label htmlFor="settings-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                Display Name
              </label>
              <input
                id="settings-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl rv-input-solid text-sm"
              />
            </div>
            <ActionButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={busyAction !== null}
            >
              {busyAction === 'profile' ? 'Saving...' : 'Save Name'}
            </ActionButton>
          </form>
        </GlassPanel>

        <GlassPanel className="p-6">
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-indigo-400" aria-hidden="true" />
              <h3 className="font-display text-base font-semibold text-white">
                {user.hasPassword ? 'Change Password' : 'Set Account Password'}
              </h3>
            </div>

            {user.hasPassword && (
              <div>
                <label
                  htmlFor="settings-current-password"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Current Password
                </label>
                <input
                  id="settings-current-password"
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl rv-input-solid text-sm"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="settings-new-password"
                className="block text-xs font-medium text-slate-300 mb-1.5"
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
                className="w-full h-11 px-3.5 rounded-xl rv-input-solid text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="settings-confirm-password"
                className="block text-xs font-medium text-slate-300 mb-1.5"
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
                className="w-full h-11 px-3.5 rounded-xl rv-input-solid text-sm"
              />
            </div>

            <ActionButton
              type="submit"
              variant="secondary"
              size="sm"
              disabled={busyAction !== null}
            >
              {busyAction === 'password'
                ? 'Updating...'
                : user.hasPassword
                  ? 'Update Password'
                  : 'Set Password'}
            </ActionButton>
          </form>
        </GlassPanel>
      </div>
    </section>
  );
}
