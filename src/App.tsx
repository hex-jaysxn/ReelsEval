import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Menu, PlusCircle, RefreshCw } from 'lucide-react';
import type { AuthProviderAvailability, AuthUser } from './types/auth.ts';
import type {
  EvaluationContext,
  ReelEvaluation,
  ReelVideoMetadata,
} from './types/evaluation.ts';
import { parseEvaluationApiResponse } from './utils/evaluationLogic.ts';
import { Sidebar, type ActiveTab } from './components/Sidebar.tsx';
import { UploadStage } from './components/UploadStage.tsx';
import { ProcessingState } from './components/ProcessingState.tsx';
import { ReportActions } from './components/ReportActions.tsx';
import { ScoreGauge } from './components/ScoreGauge.tsx';
import { ChartsSection } from './components/ChartsSection.tsx';
import { CategoryScoreCards } from './components/CategoryScoreCards.tsx';
import { InsightsAndStrategy } from './components/InsightsAndStrategy.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { MethodologyView } from './components/MethodologyView.tsx';
import { AuthPage } from './components/AuthPage.tsx';
import { AccountSettingsView } from './components/AccountSettingsView.tsx';

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [providerAvailability, setProviderAvailability] =
    useState<AuthProviderAvailability | null>(null);

  const [initialParams] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      resetToken: params.get('resetToken'),
      oauthHandoff: params.get('oauthHandoff'),
      authError: params.get('authError'),
    };
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('evaluator');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<ReelVideoMetadata | null>(null);

  const [context, setContext] = useState<EvaluationContext>({
    targetPersona: 'Gen Z Consumers',
    campaignObjective: 'Brand Awareness',
    brandContext: '',
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<{
    code: string;
    message: string;
    retryAfterSeconds?: number;
  } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [activeEvaluation, setActiveEvaluation] = useState<ReelEvaluation | null>(null);
  const [history, setHistory] = useState<ReelEvaluation[]>([]);

  const loadUserEvaluations = useCallback(
    async (tokenOverride?: string | null) => {
      const headers: Record<string, string> = { Accept: 'application/json' };
      const effectiveToken = tokenOverride !== undefined ? tokenOverride : sessionToken;
      if (effectiveToken) {
        headers.Authorization = `Bearer ${effectiveToken}`;
      }
      try {
        const res = await fetch('/api/evaluations', {
          credentials: 'same-origin',
          headers,
        });
        const data = (await res.json().catch(() => null)) as {
          evaluations?: ReelEvaluation[];
        } | null;
        if (res.ok && Array.isArray(data?.evaluations)) {
          setHistory(data.evaluations);
        }
      } catch {
        // Ignore transient history load error
      }
    },
    [sessionToken]
  );

  useEffect(() => {
    let active = true;

    async function bootstrapAuth() {
      try {
        const providersRes = await fetch('/api/auth/providers', {
          credentials: 'same-origin',
        });
        const providersData = (await providersRes.json().catch(() => null)) as
          | AuthProviderAvailability
          | null;
        if (active && providersData) {
          setProviderAvailability(providersData);
        }

        if (initialParams.oauthHandoff) {
          const handoffRes = await fetch('/api/auth/oauth/complete', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'X-Requested-With': 'ReelsEvaluator',
            },
            body: JSON.stringify({ handoffCode: initialParams.oauthHandoff }),
          });
          const handoffData = (await handoffRes.json().catch(() => null)) as {
            user?: AuthUser;
            sessionToken?: string;
          } | null;
          window.history.replaceState({}, '', '/');
          if (active && handoffRes.ok && handoffData?.user) {
            setAuthUser(handoffData.user);
            setSessionToken(handoffData.sessionToken ?? null);
            await loadUserEvaluations(handoffData.sessionToken ?? null);
            return;
          }
        }

        const meRes = await fetch('/api/auth/me', { credentials: 'same-origin' });
        const meData = (await meRes.json().catch(() => null)) as {
          user?: AuthUser | null;
        } | null;
        if (active && meData?.user) {
          setAuthUser(meData.user);
          await loadUserEvaluations(null);
        }
      } finally {
        if (active) {
          setAuthLoading(false);
        }
      }
    }

    bootstrapAuth();
    return () => {
      active = false;
    };
  }, [initialParams.oauthHandoff, loadUserEvaluations]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleAuthenticated(user: AuthUser, token?: string) {
    setAuthUser(user);
    setSessionToken(token ?? null);
    setActiveTab('evaluator');
    loadUserEvaluations(token ?? null);
  }

  async function handleLogout() {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Requested-With': 'ReelsEvaluator',
    };
    if (sessionToken) {
      headers.Authorization = `Bearer ${sessionToken}`;
    }
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers,
      });
    } catch {
      // Proceed with local state reset
    }
    setAuthUser(null);
    setSessionToken(null);
    setActiveEvaluation(null);
    setHistory([]);
    setApiError(null);
    setActiveTab('evaluator');
  }

  function handleFileSelected(file: File, meta: ReelVideoMetadata, url: string) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(file);
    setVideoMetadata(meta);
    setPreviewUrl(url);
    setApiError(null);
    setValidationError(null);
  }

  function handleClearFile() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setVideoMetadata(null);
    setValidationError(null);
    setApiError(null);
  }

  function handleUpdateVideoMetrics(metrics: {
    durationSeconds?: number;
    width?: number;
    height?: number;
  }) {
    setVideoMetadata((prev) => (prev ? { ...prev, ...metrics } : prev));
  }

  function handleStartNewEvaluation() {
    setActiveEvaluation(null);
    setApiError(null);
    setValidationError(null);
    setActiveTab('evaluator');
  }

  async function handleAnalyzeReel() {
    if (!selectedFile || !videoMetadata || isAnalyzing) return;

    setIsAnalyzing(true);
    setApiError(null);
    setValidationError(null);

    try {
      const formData = new FormData();
      formData.append('video', selectedFile);
      formData.append('targetPersona', context.targetPersona);
      formData.append('campaignObjective', context.campaignObjective);
      if (context.brandContext?.trim()) {
        formData.append('brandContext', context.brandContext.trim());
      }
      if (videoMetadata.durationSeconds) {
        formData.append('durationSeconds', String(videoMetadata.durationSeconds));
      }
      if (videoMetadata.width) {
        formData.append('width', String(videoMetadata.width));
      }
      if (videoMetadata.height) {
        formData.append('height', String(videoMetadata.height));
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'ReelsEvaluator',
      };
      if (sessionToken) {
        headers.Authorization = `Bearer ${sessionToken}`;
      }

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
        headers,
      });

      const rawBody = await response.text();
      const parsed = parseEvaluationApiResponse({
        ok: response.ok,
        status: response.status,
        contentType: response.headers.get('content-type'),
        redirected: response.redirected,
        rawBody,
      });

      if (parsed.ok === false) {
        setApiError(parsed.error);
        return;
      }

      const evaluation = parsed.evaluation;
      setActiveEvaluation(evaluation);
      setHistory((prev) => [evaluation, ...prev.filter((item) => item.id !== evaluation.id)].slice(0, 30));
    } catch (err) {
      setApiError({
        code: 'NETWORK_ERROR',
        message:
          err instanceof Error
            ? `Network error while contacting evaluation server: ${err.message}`
            : 'Unable to reach evaluation server. Please check your connection and try again.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleDeleteEvaluation(id: string) {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Requested-With': 'ReelsEvaluator',
    };
    if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

    await fetch(`/api/evaluations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers,
    }).catch(() => null);

    setHistory((prev) => prev.filter((item) => item.id !== id));
    if (activeEvaluation?.id === id) {
      setActiveEvaluation(null);
    }
  }

  async function handleClearHistory() {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Requested-With': 'ReelsEvaluator',
    };
    if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

    await fetch('/api/evaluations', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers,
    }).catch(() => null);

    setHistory([]);
    setActiveEvaluation(null);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-500">Loading workspace...</div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <AuthPage
        initialResetToken={initialParams.resetToken}
        initialAuthError={initialParams.authError}
        providerAvailability={providerAvailability}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  const pageTitle =
    activeTab === 'evaluator'
      ? activeEvaluation
        ? 'Evaluation Report'
        : 'Video Evaluator'
      : activeTab === 'history'
        ? 'Evaluation History'
        : activeTab === 'settings'
          ? 'Account Settings'
          : 'Scoring Rubric';

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        history={history}
        activeEvaluationId={activeEvaluation?.id || null}
        onSelectHistoryItem={(item) => {
          setActiveEvaluation(item);
          setApiError(null);
          setActiveTab('evaluator');
        }}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        user={authUser}
        onLogout={handleLogout}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header Bar — Clean 3-zone SaaS contract */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shrink-0"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-slate-400 hidden sm:inline whitespace-nowrap">Workspace</span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">
                /
              </span>
              <span className="font-display font-semibold text-slate-900 truncate">
                {pageTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleStartNewEvaluation}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>New Evaluation</span>
            </button>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1280px] w-full mx-auto space-y-6">
          {activeTab === 'evaluator' && (
            <>
              {!activeEvaluation && (
                <UploadStage
                  selectedFile={selectedFile}
                  previewUrl={previewUrl}
                  videoMetadata={videoMetadata}
                  context={context}
                  isAnalyzing={isAnalyzing}
                  onFileSelected={handleFileSelected}
                  onClearFile={handleClearFile}
                  onUpdateVideoMetrics={handleUpdateVideoMetrics}
                  onChangeContext={setContext}
                  onAnalyze={handleAnalyzeReel}
                  validationError={validationError}
                  onValidationError={setValidationError}
                />
              )}

              {isAnalyzing && videoMetadata && (
                <ProcessingState fileName={videoMetadata.fileName} />
              )}

              {apiError && !isAnalyzing && (
                <div
                  role="alert"
                  className="bg-white border border-red-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <h2 className="font-display text-sm font-semibold text-red-900">
                        {apiError.code === 'RATE_LIMIT'
                          ? 'Gemini Free Tier Rate Limit Reached'
                          : apiError.code === 'INVALID_API_KEY'
                            ? 'Gemini API Key Configuration Required'
                            : apiError.code === 'UNSUPPORTED_VIDEO'
                              ? 'Unsupported Video Format or Codec'
                              : apiError.code === 'SESSION_OR_PROXY_HTML'
                                ? 'Preview Session Refresh Required'
                                : 'Video Evaluation Could Not Complete'}
                      </h2>
                      <p className="mt-1 text-sm text-red-700 leading-relaxed">
                        {apiError.message}
                      </p>
                      {apiError.retryAfterSeconds && (
                        <p className="mt-1 text-xs text-red-600 tabular-nums">
                          Suggested wait before retry: ~{apiError.retryAfterSeconds} seconds.
                        </p>
                      )}
                    </div>
                  </div>

                  {selectedFile && (
                    <button
                      type="button"
                      onClick={handleAnalyzeReel}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-200 bg-red-50 text-xs font-medium text-red-800 hover:bg-red-100 whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Retry Analysis</span>
                    </button>
                  )}
                </div>
              )}

              {activeEvaluation && !isAnalyzing && (
                <div className="space-y-6">
                  <ReportActions evaluation={activeEvaluation} />
                  <ScoreGauge evaluation={activeEvaluation} />
                  <ChartsSection evaluation={activeEvaluation} />
                  <CategoryScoreCards evaluation={activeEvaluation} />
                  <InsightsAndStrategy evaluation={activeEvaluation} />
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <HistoryView
              history={history}
              onSelectEvaluation={(item) => {
                setActiveEvaluation(item);
                setApiError(null);
                setActiveTab('evaluator');
              }}
              onDeleteEvaluation={handleDeleteEvaluation}
              onClearHistory={handleClearHistory}
              onGoToEvaluator={() => setActiveTab('evaluator')}
            />
          )}

          {activeTab === 'methodology' && <MethodologyView />}

          {activeTab === 'settings' && (
            <AccountSettingsView
              user={authUser}
              sessionToken={sessionToken}
              providerAvailability={providerAvailability}
              onUserUpdated={setAuthUser}
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>
    </div>
  );
}
