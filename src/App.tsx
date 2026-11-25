import { useCallback, useEffect, useState } from 'react';
import { Menu, PlusCircle, RefreshCw } from 'lucide-react';
import { AnimatePresence, MotionConfig, useMotionValueEvent, useScroll } from 'motion/react';
import type { AuthProviderAvailability, AuthUser } from './types/auth.ts';
import type {
  EvaluationContext,
  ReelEvaluation,
  ReelVideoMetadata,
} from './types/evaluation.ts';
import { getRoutePath, parseAppRoute, type AppRoute } from './utils/appRoute.ts';
import { parseEvaluationApiResponse } from './utils/evaluationLogic.ts';
import { parseAuthApiResponse } from './utils/authResponse.ts';
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
import { LandingPage } from './components/LandingPage.tsx';
import { LegalPage } from './components/LegalPages.tsx';
import { ActionButton, AlertBanner, ReeViewMark } from './components/ui/GlassPrimitives.tsx';
import {
  MagneticWrapper,
  PageTransition,
  ScrollDepthBackdrop,
  ScrollProgressBar,
} from './components/ui/MotionPrimitives.tsx';

export default function App() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [providerAvailability, setProviderAvailability] =
    useState<AuthProviderAvailability | null>(null);
  const [proxyBlockedNotice, setProxyBlockedNotice] = useState<string | null>(null);

  const [initialParams] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      resetToken: params.get('resetToken'),
      oauthHandoff: params.get('oauthHandoff'),
      authError: params.get('authError'),
      autostart: params.get('autostart'),
    };
  });

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() =>
    parseAppRoute(window.location.pathname)
  );
  const [unauthView, setUnauthView] = useState<'landing' | 'auth'>(() =>
    initialParams.resetToken || initialParams.authError || initialParams.autostart
      ? 'auth'
      : 'landing'
  );
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');

  const [activeTab, setActiveTab] = useState<ActiveTab>('evaluator');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const [workspaceScrolled, setWorkspaceScrolled] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const next = latest > 20;
    if (next !== workspaceScrolled) {
      setWorkspaceScrolled(next);
    }
  });

  const navigateRoute = useCallback((route: AppRoute) => {
    const targetPath = getRoutePath(route);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setCurrentRoute(route);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    function handlePopState() {
      setCurrentRoute(parseAppRoute(window.location.pathname));
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
          headers: { Accept: 'application/json' },
        });
        const providersParsed = parseAuthApiResponse({
          ok: providersRes.ok,
          status: providersRes.status,
          contentType: providersRes.headers.get('content-type'),
          redirected: providersRes.redirected,
          rawBody: await providersRes.text(),
        });
        if (active && providersParsed.ok) {
          setProviderAvailability(providersParsed.data as unknown as AuthProviderAvailability);
        } else if (
          active &&
          !providersParsed.ok &&
          providersParsed.error.code === 'SESSION_OR_PROXY_HTML'
        ) {
          setProxyBlockedNotice(providersParsed.error.message);
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
    setUnauthView('landing');
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

  const workflowStep = isAnalyzing ? 2 : activeEvaluation ? 3 : 1;
  const evaluatorViewKey = isAnalyzing
    ? 'evaluator-processing'
    : activeEvaluation
      ? `evaluator-report-${activeEvaluation.id}`
      : 'evaluator-upload';
  const mainContentKey = activeTab === 'evaluator' ? evaluatorViewKey : `tab-${activeTab}`;

  const topLevelKey =
    currentRoute === 'privacy' || currentRoute === 'terms'
      ? `legal-${currentRoute}`
      : authLoading
        ? 'loading'
        : !authUser
          ? `unauth-${unauthView}`
          : 'workspace';

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        {currentRoute === 'privacy' || currentRoute === 'terms' ? (
          <PageTransition key={topLevelKey} routeKey={topLevelKey}>
            <LegalPage
              page={currentRoute}
              onNavigateRoute={navigateRoute}
              onNavigateAuth={(mode) => {
                setAuthInitialMode(mode);
                setUnauthView('auth');
                navigateRoute('main');
              }}
            />
          </PageTransition>
        ) : authLoading ? (
          <PageTransition key={topLevelKey} routeKey={topLevelKey}>
            <div className="min-h-screen rv-atmosphere flex flex-col items-center justify-center p-6 gap-4 text-slate-50">
              <div className="animate-pulse">
                <ReeViewMark size="lg" />
              </div>
              <p className="text-sm font-medium text-slate-200">Loading ReeView workspace...</p>
            </div>
          </PageTransition>
        ) : !authUser ? (
          unauthView === 'landing' ? (
            <PageTransition key={topLevelKey} routeKey={topLevelKey}>
              <LandingPage
                onNavigateAuth={(mode) => {
                  setAuthInitialMode(mode);
                  setUnauthView('auth');
                }}
                onNavigateRoute={navigateRoute}
              />
            </PageTransition>
          ) : (
            <PageTransition key={topLevelKey} routeKey={topLevelKey}>
              <AuthPage
                initialMode={authInitialMode}
                initialResetToken={initialParams.resetToken}
                initialAuthError={initialParams.authError}
                proxyBlockedNotice={proxyBlockedNotice}
                providerAvailability={providerAvailability}
                onAuthenticated={handleAuthenticated}
                onBackToLanding={() => setUnauthView('landing')}
                onNavigateRoute={navigateRoute}
              />
            </PageTransition>
          )
        ) : (
          <PageTransition key={topLevelKey} routeKey={topLevelKey}>
            <div className="min-h-screen flex rv-atmosphere text-slate-50">
              <ScrollProgressBar />
              <ScrollDepthBackdrop />
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
                {/* Top Header Bar */}
                <header
                  className={`sticky top-0 z-30 h-16 rv-glass-nav border-b px-4 sm:px-8 flex items-center justify-between gap-4 no-print ${
                    workspaceScrolled ? 'rv-glass-nav-scrolled' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileMenuOpen(true)}
                      aria-label="Open navigation menu"
                      className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/25 bg-[#0e154a] text-slate-100 hover:bg-[#151f64] hover:text-white active:scale-95 transition-all duration-150 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                    >
                      <Menu className="h-5 w-5" aria-hidden="true" />
                    </button>

                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <span className="text-slate-300 hidden sm:inline whitespace-nowrap">ReeView</span>
                      <span className="text-slate-500 hidden sm:inline" aria-hidden="true">
                        /
                      </span>
                      <span className="font-display font-semibold text-white truncate">
                        {pageTitle}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {activeTab === 'evaluator' && (
                      <ol
                        aria-label="Evaluation workflow progress"
                        className="hidden xl:flex items-center gap-2 text-xs text-slate-300"
                      >
                        <li
                          className={`transition-colors duration-200 ${
                            workflowStep === 1 ? 'text-white font-semibold' : ''
                          }`}
                        >
                          01 Upload
                        </li>
                        <li aria-hidden="true" className="text-slate-500">→</li>
                        <li
                          className={`transition-colors duration-200 ${
                            workflowStep === 2 ? 'text-cyan-300 font-semibold' : ''
                          }`}
                        >
                          02 AI Analysis
                        </li>
                        <li aria-hidden="true" className="text-slate-500">→</li>
                        <li
                          className={`transition-colors duration-200 ${
                            workflowStep === 3 ? 'text-emerald-300 font-semibold' : ''
                          }`}
                        >
                          03 Report
                        </li>
                      </ol>
                    )}

                    <MagneticWrapper>
                      <ActionButton
                        variant="primary"
                        size="sm"
                        className="hover:translate-y-0"
                        onClick={handleStartNewEvaluation}
                      >
                        <PlusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>New Evaluation</span>
                      </ActionButton>
                    </MagneticWrapper>
                  </div>
                </header>

                {/* Main Content Viewport */}
                <main className="flex-1 p-4 sm:p-8 max-w-[1280px] w-full mx-auto space-y-6">
                  <AnimatePresence>
                    {activeTab === 'evaluator' && apiError && !isAnalyzing && (
                      <AlertBanner
                        key={apiError.code + apiError.message}
                        tone="error"
                        title={
                          apiError.code === 'RATE_LIMIT'
                            ? 'Gemini Free Tier Rate Limit Reached'
                            : apiError.code === 'INVALID_API_KEY'
                              ? 'Gemini API Key Configuration Required'
                              : apiError.code === 'UNSUPPORTED_VIDEO'
                                ? 'Unsupported Video Format or Codec'
                                : apiError.code === 'SESSION_OR_PROXY_HTML'
                                  ? 'Preview Session Refresh Required'
                                  : 'Video Evaluation Could Not Complete'
                        }
                        message={apiError.message}
                        detail={
                          apiError.retryAfterSeconds
                            ? `Suggested wait before retry: ~${apiError.retryAfterSeconds} seconds.`
                            : undefined
                        }
                        action={
                          selectedFile ? (
                            <ActionButton variant="danger" size="sm" onClick={handleAnalyzeReel}>
                              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Retry Analysis</span>
                            </ActionButton>
                          ) : undefined
                        }
                      />
                    )}
                  </AnimatePresence>

                  <AnimatePresence mode="wait">
                    <PageTransition key={mainContentKey} routeKey={mainContentKey}>
                      {activeTab === 'evaluator' && (
                        <>
                          {!activeEvaluation && !isAnalyzing && (
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
                    </PageTransition>
                  </AnimatePresence>
                </main>
              </div>
            </div>
          </PageTransition>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
