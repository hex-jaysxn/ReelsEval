import { useEffect, useState } from 'react';
import { AlertCircle, Menu, PlusCircle, RefreshCw } from 'lucide-react';
import type {
  EvaluationContext,
  ReelEvaluation,
  ReelVideoMetadata,
} from './types/evaluation.ts';
import { parseEvaluationApiResponse } from './utils/evaluationLogic.ts';
import {
  deleteEvaluationFromHistory,
  clearEvaluationHistory,
  loadEvaluationHistory,
  saveEvaluationToHistory,
} from './utils/historyStorage.ts';
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

export default function App() {
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
  const [history, setHistory] = useState<ReelEvaluation[]>(() => loadEvaluationHistory());

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
        },
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
      const updatedHistory = saveEvaluationToHistory(evaluation);
      setHistory(updatedHistory);
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

  const pageTitle =
    activeTab === 'evaluator'
      ? activeEvaluation
        ? 'Evaluation Report'
        : 'Video Evaluator'
      : activeTab === 'history'
        ? 'Evaluation History'
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
              onDeleteEvaluation={(id) => {
                const next = deleteEvaluationFromHistory(id);
                setHistory(next);
                if (activeEvaluation?.id === id) {
                  setActiveEvaluation(null);
                }
              }}
              onClearHistory={() => {
                const next = clearEvaluationHistory();
                setHistory(next);
                setActiveEvaluation(null);
              }}
              onGoToEvaluator={() => setActiveTab('evaluator')}
            />
          )}

          {activeTab === 'methodology' && <MethodologyView />}
        </main>
      </div>
    </div>
  );
}
