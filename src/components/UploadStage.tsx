import { useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Film, Layers, Play, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import type {
  CampaignObjective,
  EvaluationContext,
  EvaluationScope,
  ReelVideoMetadata,
  TargetUserPersona,
} from '../types/evaluation.ts';
import {
  ALL_REELS_VARIABLES,
  STUDY_VARIABLE_META,
  createFullEvaluationScope,
  formatBytes,
  formatDuration,
  toggleEvaluationVariable,
  validateVideoMetadata,
} from '../utils/evaluationLogic.ts';
import { ActionButton, AlertBanner, GlassPanel } from './ui/GlassPrimitives.tsx';
import { RV_EASE, RV_SPRING } from './ui/MotionPrimitives.tsx';

interface UploadStageProps {
  selectedFile: File | null;
  previewUrl: string | null;
  videoMetadata: ReelVideoMetadata | null;
  context: EvaluationContext;
  evaluationScope: EvaluationScope;
  isAnalyzing: boolean;
  onFileSelected: (file: File, meta: ReelVideoMetadata, url: string) => void;
  onClearFile: () => void;
  onUpdateVideoMetrics: (metrics: { durationSeconds?: number; width?: number; height?: number }) => void;
  onChangeContext: (next: EvaluationContext) => void;
  onChangeEvaluationScope: (next: EvaluationScope) => void;
  onAnalyze: () => void;
  validationError: string | null;
  onValidationError: (msg: string | null) => void;
}

const PERSONA_OPTIONS: TargetUserPersona[] = [
  'General Audience',
  'Gen Z Consumers',
  'Business Owners',
  'Social Media Content Creators',
  'Marketing Professionals',
];

const OBJECTIVE_OPTIONS: CampaignObjective[] = [
  'Brand Awareness',
  'Product Conversion',
  'Community Engagement',
  'Educational Authority',
];

export function UploadStage({
  selectedFile,
  previewUrl,
  videoMetadata,
  context,
  evaluationScope,
  isAnalyzing,
  onFileSelected,
  onClearFile,
  onUpdateVideoMetrics,
  onChangeContext,
  onChangeEvaluationScope,
  onAnalyze,
  validationError,
  onValidationError,
}: UploadStageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const reduced = useReducedMotion();

  const selectedCount = evaluationScope.selectedVariables.length;
  const isFullSelected =
    evaluationScope.fullEvaluation && selectedCount === ALL_REELS_VARIABLES.length;

  function handleIncomingFile(file: File | undefined) {
    if (!file) return;
    const result = validateVideoMetadata({
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (!result.valid) {
      onValidationError(result.errorMessage || 'Invalid video file.');
      return;
    }

    onValidationError(null);
    const objectUrl = URL.createObjectURL(file);
    onFileSelected(
      file,
      {
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type || 'video/mp4',
      },
      objectUrl
    );
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    handleIncomingFile(droppedFile);
  }

  return (
    <GlassPanel
      as="section"
      ariaLabel="Video Upload and Configuration"
      className="p-6 lg:p-8 rv-animate-in"
    >
      <div className="flex flex-col lg:flex-row gap-8 items-stretch">
        {/* Left: Drag & Drop or Video Preview */}
        <div className="w-full lg:w-[360px] shrink-0 flex flex-col">
          <AnimatePresence mode="wait">
            {!selectedFile || !previewUrl ? (
              <motion.div
                key="dropzone"
                initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.985 }}
                animate={
                  reduced
                    ? { opacity: 1 }
                    : { opacity: 1, scale: isDragging ? 1.015 : 1 }
                }
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                transition={reduced ? { duration: 0.01 } : RV_SPRING}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={handleDrop}
                className={`flex-1 min-h-[340px] flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed p-6 transition-colors duration-200 ${
                  isDragging
                    ? 'border-cyan-400 bg-cyan-500/12 shadow-[0_0_24px_rgba(6,182,212,0.2)]'
                    : 'border-sky-400/25 bg-[#070b28]/75 hover:border-cyan-400/45'
                }`}
              >
                <motion.div
                  animate={
                    reduced
                      ? undefined
                      : isDragging
                        ? { y: -3, scale: 1.06 }
                        : { y: 0, scale: 1 }
                  }
                  transition={RV_SPRING}
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0e154a] border border-cyan-400/30 text-cyan-300 mb-4"
                >
                  <UploadCloud className="h-6 w-6" aria-hidden="true" />
                </motion.div>
                <h2 className="font-display text-base font-semibold text-white">
                  Upload Short-Form Reel
                </h2>
                <p className="mt-1.5 text-sm text-slate-200 max-w-xs leading-relaxed">
                  Drag and drop an MP4, WebM, or MOV video here, or browse from your device.
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  Max 45 MB · Optimized for Gemini Free Tier
                </p>

                <input
                  ref={fileInputRef}
                  id="reel-video-input"
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
                  className="sr-only"
                  onChange={(e) => {
                    handleIncomingFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />

                <ActionButton
                  type="button"
                  variant="primary"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-5"
                >
                  <Film className="h-4 w-4" aria-hidden="true" />
                  <span>Select Video File</span>
                </ActionButton>
              </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.975, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.975 }}
                transition={{ duration: reduced ? 0.01 : 0.26, ease: RV_EASE }}
                className="flex flex-col h-full"
              >
                <div className="relative rounded-2xl overflow-hidden bg-[#05081f] border border-sky-400/25 aspect-[9/14] max-h-[420px] flex items-center justify-center shadow-lg">
                  <video
                    src={previewUrl}
                    controls
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={(e) => {
                      const el = e.currentTarget;
                      onUpdateVideoMetrics({
                        durationSeconds: Number.isFinite(el.duration) ? el.duration : undefined,
                        width: el.videoWidth || undefined,
                        height: el.videoHeight || undefined,
                      });
                    }}
                    className="h-full w-full object-contain"
                  />
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-300">
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">
                      {videoMetadata?.fileName}
                    </p>
                    <p className="mt-0.5 tabular-nums">
                      {formatBytes(videoMetadata?.fileSizeBytes || 0)}
                      <span aria-hidden="true"> · </span>
                      {formatDuration(videoMetadata?.durationSeconds)}
                      {videoMetadata?.width && videoMetadata?.height ? (
                        <>
                          <span aria-hidden="true"> · </span>
                          {videoMetadata.width}×{videoMetadata.height}
                        </>
                      ) : null}
                    </p>
                  </div>

                  <ActionButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onClearFile}
                    disabled={isAnalyzing}
                    aria-label="Remove selected video"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Change</span>
                  </ActionButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Evaluation Parameters, Content Scope & Launch CTA */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="border-b border-sky-400/15 pb-4">
              <h1 className="font-display text-2xl font-bold tracking-tight text-white text-balance">
                Evaluate Reels Marketing &amp; Brand Engagement
              </h1>
              <p className="mt-1.5 text-sm text-slate-200 leading-relaxed max-w-2xl">
                Upload a short-form marketing video for real multimodal analysis using Google Gemini Free Tier. Score selected content characteristics across Interaction, Participation, and Sharing using the official research rubric (2–5 rating scale).
              </p>
            </div>

            <AnimatePresence>
              {validationError && (
                <div className="mt-5">
                  <AlertBanner key={validationError} tone="error" message={validationError} />
                </div>
              )}
            </AnimatePresence>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="target-persona-select"
                  className="block text-sm font-medium text-slate-100 mb-1.5"
                >
                  Primary Target Audience
                </label>
                <select
                  id="target-persona-select"
                  value={context.targetPersona}
                  disabled={isAnalyzing}
                  onChange={(e) =>
                    onChangeContext({
                      ...context,
                      targetPersona: e.target.value as TargetUserPersona,
                    })
                  }
                  className="w-full h-11 rounded-xl rv-input-solid px-3.5 text-sm disabled:opacity-60"
                >
                  {PERSONA_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="campaign-objective-select"
                  className="block text-sm font-medium text-slate-100 mb-1.5"
                >
                  Campaign Objective
                </label>
                <select
                  id="campaign-objective-select"
                  value={context.campaignObjective}
                  disabled={isAnalyzing}
                  onChange={(e) =>
                    onChangeContext({
                      ...context,
                      campaignObjective: e.target.value as CampaignObjective,
                    })
                  }
                  className="w-full h-11 rounded-xl rv-input-solid px-3.5 text-sm disabled:opacity-60"
                >
                  {OBJECTIVE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5">
              <label
                htmlFor="brand-context-input"
                className="block text-sm font-medium text-slate-100 mb-1.5"
              >
                Product or Brand Context <span className="font-normal text-slate-300">(Optional)</span>
              </label>
              <input
                id="brand-context-input"
                type="text"
                maxLength={300}
                disabled={isAnalyzing}
                value={context.brandContext || ''}
                onChange={(e) =>
                  onChangeContext({
                    ...context,
                    brandContext: e.target.value,
                  })
                }
                placeholder="e.g., Eco-friendly skincare launch targeting Gen Z commuters"
                className="w-full h-11 rounded-xl rv-input-solid px-3.5 text-sm disabled:opacity-60"
              />
            </div>

            {/* Selective Content-Variable Evaluation Selector */}
            <div className="mt-6 pt-5 border-t border-sky-400/15">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-base font-semibold text-white">
                  What would you like to evaluate?
                </h2>
                <span className="font-mono text-xs text-cyan-300 tabular-nums">
                  {selectedCount} of 4 selected
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-200 leading-relaxed">
                Select one or more content characteristics. ReeView will focus its analysis, scoring, strengths, areas for improvement, and recommendations on your selected characteristics.
              </p>

              {/* Full Evaluation Option */}
              <button
                type="button"
                aria-pressed={isFullSelected}
                disabled={isAnalyzing}
                onClick={() => onChangeEvaluationScope(createFullEvaluationScope())}
                className={`mt-3.5 w-full text-left rounded-xl border px-4 py-3 flex items-center justify-between gap-3 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed ${
                  isFullSelected
                    ? 'border-cyan-400/80 bg-gradient-to-r from-violet-500/20 via-blue-500/18 to-cyan-400/18 shadow-[0_0_20px_rgba(34,211,238,0.18)]'
                    : 'border-sky-400/25 bg-[#070b28]/70 hover:border-cyan-400/50 hover:bg-[#0e154a]/80'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                      isFullSelected
                        ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200'
                        : 'border-sky-400/25 bg-[#0b1038] text-slate-300'
                    }`}
                  >
                    <Layers className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-xs font-bold tracking-wider text-white">
                        FULL EVALUATION
                      </span>
                      <span className="text-[11px] font-mono text-cyan-300 tabular-nums">
                        8.00–20.00 Official Score
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-200">
                      Evaluate all four content characteristics using the complete assessment.
                    </p>
                  </div>
                </div>

                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isFullSelected
                      ? 'border-cyan-300 bg-cyan-400 text-[#05081f]'
                      : 'border-sky-400/35 bg-[#090e30] text-transparent'
                  }`}
                >
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                </span>
              </button>

              {/* Four Individual Characteristic Cards */}
              <div
                role="group"
                aria-label="Content characteristics to evaluate"
                className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                {ALL_REELS_VARIABLES.map((key) => {
                  const meta = STUDY_VARIABLE_META[key];
                  const isSelected = evaluationScope.selectedVariables.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={isSelected}
                      disabled={isAnalyzing}
                      onClick={() =>
                        onChangeEvaluationScope(toggleEvaluationVariable(evaluationScope, key))
                      }
                      className={`text-left rounded-xl border p-3.5 flex flex-col justify-between gap-2 min-h-[96px] transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'border-cyan-400/75 bg-cyan-500/12 shadow-[0_0_16px_rgba(34,211,238,0.14)]'
                          : 'border-sky-400/20 bg-[#070b28]/60 opacity-80 hover:opacity-100 hover:border-sky-400/45 hover:bg-[#0c1240]/75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-display text-xs font-bold tracking-wider text-white">
                            {meta.selectionTitle}
                          </span>
                          <p className="mt-1 text-xs text-slate-200 leading-snug">
                            {meta.selectionDescription}
                          </p>
                        </div>
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            isSelected
                              ? 'border-cyan-300 bg-cyan-400 text-[#05081f]'
                              : 'border-sky-400/35 bg-[#090e30] text-transparent'
                          }`}
                        >
                          <Check className="h-3 w-3 stroke-[2.5]" />
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-300 tabular-nums">
                        2.00–5.00 · Mean {meta.surveyMean.toFixed(2)} · r={meta.correlationLabel}
                      </p>
                    </button>
                  );
                })}
              </div>

              {selectedCount === 0 && (
                <p className="mt-2.5 text-xs font-medium text-amber-300">
                  Please select at least one content characteristic to evaluate.
                </p>
              )}
            </div>
          </div>

          <div className="mt-7 pt-5 border-t border-sky-400/15 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-300">
              {isFullSelected ? (
                <span>
                  Each variable averaged across Interaction, Participation &amp; Sharing (8.00–20.00 official total)
                </span>
              ) : selectedCount > 0 ? (
                <span>
                  Partial scope: {selectedCount} of 4 characteristics evaluated (2.00–5.00 scale per characteristic)
                </span>
              ) : (
                <span>Select 1–4 content characteristics above before running analysis</span>
              )}
            </div>

            <ActionButton
              type="button"
              variant="primary"
              size="lg"
              onClick={onAnalyze}
              disabled={!selectedFile || isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Sparkles className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Analyzing Reel...</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  <span>Analyze Reel</span>
                </>
              )}
            </ActionButton>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
