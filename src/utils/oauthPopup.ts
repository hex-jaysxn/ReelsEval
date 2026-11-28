import type { AuthUser } from '../types/auth.ts';

const OAUTH_BROADCAST_CHANNEL = 'reeview_oauth_channel';
const OAUTH_TIMEOUT_MS = 3 * 60 * 1000;

interface OAuthBridgeMessage {
  type?: string;
  provider?: string;
  mode?: string;
  handoffCode?: string | null;
  error?: string | null;
}

function isTopLevelMobileBrowser(): boolean {
  try {
    if (window.self !== window.top) {
      return false;
    }
  } catch {
    return false;
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }

  const hasCoarsePointer =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const maxTouch = typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0;
  return hasCoarsePointer && maxTouch > 0;
}

export async function launchOAuthPopup(params: {
  provider: 'google';
  mode: 'login' | 'link';
  sessionToken: string | null;
  onSuccess: (result: { user?: AuthUser; sessionToken?: string }) => void;
  onError: (message: string) => void;
  onCancelReady?: (cancelFn: () => void) => void;
}): Promise<() => void> {
  const { provider, mode, sessionToken, onSuccess, onError, onCancelReady } = params;

  const useSameTabMobileRedirect = isTopLevelMobileBrowser();
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (sessionToken) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  if (useSameTabMobileRedirect) {
    let aborted = false;
    const cancelSameTab = () => {
      aborted = true;
    };
    onCancelReady?.(cancelSameTab);

    try {
      const openerOrigin = encodeURIComponent(window.location.origin);
      const res = await fetch(
        `/api/auth/${provider}/url?mode=${mode}&flowType=redirect&openerOrigin=${openerOrigin}`,
        {
          credentials: 'same-origin',
          headers,
        }
      );
      const data = (await res.json().catch(() => null)) as {
        url?: string;
        error?: { message?: string };
      } | null;

      if (aborted) return cancelSameTab;

      if (!res.ok || !data?.url) {
        onError(data?.error?.message || 'Could not initialize Google sign-in.');
        return cancelSameTab;
      }

      window.location.assign(data.url);
      return cancelSameTab;
    } catch {
      if (!aborted) {
        onError('Network error while contacting the authentication server.');
      }
      return cancelSameTab;
    }
  }

  const width = 520;
  const height = 660;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

  // Open synchronously inside the user click gesture so browsers preserve user
  // activation, link window.opener properly, and permit closing the popup later.
  let popup: Window | null = null;
  try {
    popup = window.open(
      'about:blank',
      `reelsevaluator_${provider}_oauth`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  } catch {
    popup = null;
  }

  if (popup) {
    try {
      popup.document.open();
      popup.document.write(
        '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connecting to Google...</title></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#070b28;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px;"><div><p style="font-size:15px;font-weight:600;margin:0 0 6px;">Connecting to Google Sign-In...</p><p style="font-size:13px;color:#94a3b8;margin:0;">Please wait a moment.</p></div></body></html>'
      );
      popup.document.close();
    } catch {
      // Ignore restricted blank popup document write
    }
  }

  let abortedByCaller = false;
  let settled = false;
  let closedPoll = 0;
  let flowPoll = 0;
  let closeGraceTimer = 0;
  let timeoutTimer = 0;
  let closeGracePending = false;
  let flowPollInFlight = false;
  let channel: BroadcastChannel | null = null;

  const cleanup = () => {
    window.removeEventListener('message', handleWindowMessage);
    window.removeEventListener('focus', handleWindowFocusOrVisible);
    document.removeEventListener('visibilitychange', handleWindowFocusOrVisible);
    if (closedPoll) window.clearInterval(closedPoll);
    if (flowPoll) window.clearInterval(flowPoll);
    if (closeGraceTimer) window.clearTimeout(closeGraceTimer);
    if (timeoutTimer) window.clearTimeout(timeoutTimer);
    if (channel) {
      try {
        channel.close();
      } catch {
        // Ignore channel close errors
      }
      channel = null;
    }
  };

  const closePopupSafe = () => {
    if (popup && !popup.closed) {
      try {
        popup.close();
      } catch {
        // Ignore close failure
      }
    }
    try {
      window.focus();
    } catch {
      // Ignore focus restriction
    }
  };

  const cancelFlow = () => {
    abortedByCaller = true;
    if (settled) return;
    settled = true;
    cleanup();
    closePopupSafe();
  };

  onCancelReady?.(cancelFlow);

  let authUrl = '';
  let callbackOrigin: string | null = null;
  let flowId: string | null = null;
  try {
    const openerOrigin = encodeURIComponent(window.location.origin);
    const res = await fetch(
      `/api/auth/${provider}/url?mode=${mode}&flowType=popup&openerOrigin=${openerOrigin}`,
      {
        credentials: 'same-origin',
        headers,
      }
    );
    const data = (await res.json().catch(() => null)) as {
      url?: string;
      callbackOrigin?: string;
      flowId?: string;
      error?: { message?: string };
    } | null;

    if (abortedByCaller) {
      closePopupSafe();
      return cancelFlow;
    }

    if (!res.ok || !data?.url) {
      closePopupSafe();
      onError(data?.error?.message || 'Could not initialize Google sign-in.');
      return cancelFlow;
    }

    authUrl = data.url;
    callbackOrigin = data.callbackOrigin || null;
    flowId = data.flowId || null;
  } catch {
    closePopupSafe();
    if (!abortedByCaller) {
      onError('Network error while contacting the authentication server.');
    }
    return cancelFlow;
  }

  if (!popup || popup.closed) {
    const isTopLevelWindow = (() => {
      try {
        return window.self === window.top;
      } catch {
        return false;
      }
    })();

    if (isTopLevelWindow && mode === 'login') {
      window.location.assign(authUrl);
      return cancelFlow;
    }

    onError(
      'Popup was blocked by your browser. Please allow popups for this site and try again.'
    );
    return cancelFlow;
  }

  const sendChannelAck = () => {
    try {
      channel?.postMessage({ type: 'OAUTH_AUTH_ACK', provider });
    } catch {
      // Ignore channel ack failure
    }
  };

  const completeWithServer = async (payload: { handoffCode?: string | null; flowId?: string | null }) => {
    if (mode === 'login' && (payload.handoffCode || payload.flowId)) {
      const completeHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'ReelsEvaluator',
      };
      try {
        const completeRes = await fetch('/api/auth/oauth/complete', {
          method: 'POST',
          credentials: 'same-origin',
          headers: completeHeaders,
          body: JSON.stringify({
            handoffCode: payload.handoffCode || undefined,
            flowId: payload.flowId || undefined,
          }),
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
        closePopupSafe();
        onSuccess({ user: completeData.user, sessionToken: completeData.sessionToken });
      } catch {
        onError('Network error while completing OAuth sign-in.');
      }
      return;
    }

    if (mode === 'link' && payload.flowId) {
      const completeHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'ReelsEvaluator',
      };
      if (sessionToken) completeHeaders.Authorization = `Bearer ${sessionToken}`;
      try {
        const completeRes = await fetch('/api/auth/oauth/complete', {
          method: 'POST',
          credentials: 'same-origin',
          headers: completeHeaders,
          body: JSON.stringify({ flowId: payload.flowId }),
        });
        const completeData = (await completeRes.json().catch(() => null)) as {
          user?: AuthUser;
          error?: { message?: string };
        } | null;
        closePopupSafe();
        if (completeRes.ok && completeData?.user) {
          onSuccess({ user: completeData.user });
          return;
        }
      } catch {
        // Fall through to generic link refresh
      }
    }

    closePopupSafe();
    onSuccess({});
  };

  const processOAuthPayload = async (data: OAuthBridgeMessage | null | undefined) => {
    if (settled || !data || data.provider !== provider) return;

    if (data.type === 'OAUTH_AUTH_ERROR') {
      settled = true;
      sendChannelAck();
      cleanup();
      closePopupSafe();
      onError(data.error || 'Authentication was cancelled or failed.');
      return;
    }

    if (data.type === 'OAUTH_AUTH_SUCCESS') {
      settled = true;
      sendChannelAck();
      cleanup();
      await completeWithServer({ handoffCode: data.handoffCode, flowId });
    }
  };

  const pollFlowStatusOnce = async (): Promise<boolean> => {
    if (settled || !flowId || flowPollInFlight) return false;
    flowPollInFlight = true;
    try {
      const res = await fetch(
        `/api/auth/oauth/flow-status?flowId=${encodeURIComponent(flowId)}`,
        {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        }
      );
      if (!res.ok || settled) return false;
      const statusData = (await res.json().catch(() => null)) as {
        status?: string;
        claimed?: boolean;
        error?: string | null;
      } | null;
      if (!statusData || settled) return false;

      if (statusData.status === 'success' && !statusData.claimed) {
        settled = true;
        sendChannelAck();
        cleanup();
        await completeWithServer({ flowId });
        return true;
      }

      if (statusData.status === 'error') {
        settled = true;
        sendChannelAck();
        cleanup();
        closePopupSafe();
        onError(statusData.error || 'Authentication was cancelled or failed.');
        return true;
      }
    } catch {
      // Ignore transient poll errors
    } finally {
      flowPollInFlight = false;
    }
    return false;
  };

  function handleWindowMessage(event: MessageEvent) {
    const originAllowed =
      event.origin === window.location.origin ||
      (callbackOrigin !== null && event.origin === callbackOrigin);
    if (!originAllowed) {
      return;
    }
    void processOAuthPayload(event.data as OAuthBridgeMessage | null);
  }

  function handleWindowFocusOrVisible() {
    if (document.visibilityState === 'visible' && !settled) {
      void pollFlowStatusOnce();
    }
  }

  window.addEventListener('message', handleWindowMessage);
  window.addEventListener('focus', handleWindowFocusOrVisible);
  document.addEventListener('visibilitychange', handleWindowFocusOrVisible);

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(OAUTH_BROADCAST_CHANNEL);
      channel.onmessage = (event: MessageEvent) => {
        void processOAuthPayload(event.data as OAuthBridgeMessage | null);
      };
    }
  } catch {
    channel = null;
  }

  try {
    popup.location.replace(authUrl);
  } catch {
    try {
      popup.location.href = authUrl;
    } catch {
      settled = true;
      cleanup();
      onError('Could not navigate sign-in window to Google. Please try again.');
      return cancelFlow;
    }
  }

  if (flowId) {
    flowPoll = window.setInterval(() => {
      if (!settled) {
        void pollFlowStatusOnce();
      }
    }, 850);
  }

  closedPoll = window.setInterval(() => {
    let isClosed = false;
    try {
      isClosed = popup ? popup.closed : true;
    } catch {
      isClosed = false;
    }

    if (isClosed && !settled && !closeGracePending) {
      closeGracePending = true;
      closeGraceTimer = window.setTimeout(async () => {
        if (settled) return;

        const completedViaFlow = await pollFlowStatusOnce();
        if (completedViaFlow || settled) return;

        try {
          const meHeaders: Record<string, string> = { Accept: 'application/json' };
          if (sessionToken) meHeaders.Authorization = `Bearer ${sessionToken}`;
          const meRes = await fetch('/api/auth/me', {
            credentials: 'same-origin',
            headers: meHeaders,
          });
          const meData = (await meRes.json().catch(() => null)) as {
            user?: AuthUser | null;
          } | null;

          if (settled) return;

          if (mode === 'login' && meRes.ok && meData?.user) {
            settled = true;
            cleanup();
            onSuccess({ user: meData.user });
            return;
          }

          if (
            mode === 'link' &&
            meRes.ok &&
            meData?.user?.connectedProviders.some((p) => p.provider === provider)
          ) {
            settled = true;
            cleanup();
            onSuccess({ user: meData.user });
            return;
          }
        } catch {
          // Fall through to cancellation error
        }

        if (!settled) {
          settled = true;
          cleanup();
          onError('Google sign-in window was closed before completing. Please try again.');
        }
      }, 350);
    }
  }, 400);

  timeoutTimer = window.setTimeout(() => {
    if (!settled) {
      settled = true;
      cleanup();
      closePopupSafe();
      onError('Google sign-in timed out. Please try again.');
    }
  }, OAUTH_TIMEOUT_MS);

  return cancelFlow;
}
