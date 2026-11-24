import type { AuthUser } from '../types/auth.ts';

export async function launchOAuthPopup(params: {
  provider: 'google';
  mode: 'login' | 'link';
  sessionToken: string | null;
  onSuccess: (result: { user?: AuthUser; sessionToken?: string }) => void;
  onError: (message: string) => void;
}): Promise<() => void> {
  const { provider, mode, sessionToken, onSuccess, onError } = params;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  let authUrl = '';
  try {
    const res = await fetch(`/api/auth/${provider}/url?mode=${mode}`, {
      credentials: 'same-origin',
      headers,
    });
    const data = (await res.json().catch(() => null)) as {
      url?: string;
      error?: { message?: string };
    } | null;

    if (!res.ok || !data?.url) {
      onError(data?.error?.message || 'Could not initialize Google sign-in.');
      return () => {};
    }
    authUrl = data.url;
  } catch {
    onError('Network error while contacting the authentication server.');
    return () => {};
  }

  const width = 520;
  const height = 660;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

  const popup = window.open(
    authUrl,
    `reelsevaluator_${provider}_oauth`,
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );

  if (!popup) {
    onError('Popup was blocked by your browser. Please allow popups for this site and try again.');
    return () => {};
  }

  let settled = false;

  const cleanup = () => {
    window.removeEventListener('message', handleMessage);
    window.clearInterval(closedPoll);
  };

  const handleMessage = async (event: MessageEvent) => {
    if (event.origin !== window.location.origin) {
      return;
    }
    const data = event.data as {
      type?: string;
      provider?: string;
      mode?: string;
      handoffCode?: string | null;
      error?: string | null;
    } | null;

    if (!data || data.provider !== provider) return;

    if (data.type === 'OAUTH_AUTH_ERROR') {
      settled = true;
      cleanup();
      onError(data.error || 'Authentication was cancelled or failed.');
      return;
    }

    if (data.type === 'OAUTH_AUTH_SUCCESS') {
      settled = true;
      cleanup();

      if (mode === 'login' && data.handoffCode) {
        try {
          const completeRes = await fetch('/api/auth/oauth/complete', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'X-Requested-With': 'ReelsEvaluator',
            },
            body: JSON.stringify({ handoffCode: data.handoffCode }),
          });
          const completeData = (await completeRes.json().catch(() => null)) as {
            user?: AuthUser;
            sessionToken?: string;
            error?: { message?: string };
          } | null;
          if (!completeRes.ok || !completeData?.user) {
            onError(completeData?.error?.message || 'Could not finalize OAuth sign-in.');
            return;
          }
          onSuccess({ user: completeData.user, sessionToken: completeData.sessionToken });
        } catch {
          onError('Network error while completing OAuth sign-in.');
        }
        return;
      }

      onSuccess({});
    }
  };

  window.addEventListener('message', handleMessage);

  const closedPoll = window.setInterval(() => {
    if (popup.closed && !settled) {
      settled = true;
      cleanup();
    }
  }, 500);

  return cleanup;
}
