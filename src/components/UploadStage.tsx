import { useRef, useState } from 'react';
import { Film, Play, Sparkles, Trash2, UploadCloud } from 'lucide-react';
import type {
  CampaignObjective,
  EvaluationContext,
  ReelVideoMetadata,
  TargetUserPersona,
} from '../types/evaluation.ts';
import {
  formatBytes,
  formatDuration,
  validateVideoMetadata,
} from '../utils/evaluationLogic.ts';
import { ActionButton, AlertBanner, GlassPanel } from './ui/GlassPrimitives.tsx';

interface UploadStageProps {
  selectedFile: File | null;
  previewUrl: string | null;
  videoMetadata: ReelVideoMetadata | null;
  context: EvaluationContext;
  isAnalyzing: boolean;
  onFileSelected: (file: File, meta: ReelVideoMetadata, url: string) => void;
  onClearFile: () => void;
  onUpdateVideoMetrics: (metrics: { durationSeconds?: number; width?: number; height?: number }) => void;
  onChangeContext: (next: EvaluationContext) => void;
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
  isAnalyzing,
  onFileSelected,
  onClearFile,
  onUpdateVideoMetrics,
  onChangeContext,
  onAnalyze,
  validationError,
  onValidationError,
}: UploadStageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
          {!selectedFile || !previewUrl ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              className={`flex-1 min-h-[340px] flex flex-col items-center justify-center text-center rounded-2xl border-2 border-dashed p-6 transition-colors ${
                isDragging
                  ? 'border-indigo-400 bg-indigo-500/15'
                  : 'border-slate-700/80 bg-slate-950/60 hover:border-slate-500'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 border border-white/15 text-indigo-300 mb-4">
                <UploadCloud className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="font-display text-base font-semibold text-white">
                Upload Short-Form Reel
              </h2>
              <p className="mt-1.5 text-sm text-slate-300 max-w-xs leading-relaxed">
                Drag and drop an MP4, WebM, or MOV video here, or browse from your device.
              </p>
              <p className="mt-2 text-xs text-slate-400">
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
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-white/15 aspect-[9/14] max-h-[420px] flex items-center justify-center">
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

              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
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
            </div>
          )}
        </div>

        {/* Right: Evaluation Parameters & Launch CTA */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="border-b border-white/10 pb-4">
              <h1 className="font-display text-2xl font-bold tracking-tight text-white text-balance">
                Evaluate Reels Marketing &amp; Brand Engagement
              </h1>
              <p className="mt-1.5 text-sm text-slate-300 leading-relaxed max-w-2xl">
                Upload a short-form marketing video for real multimodal analysis using Google Gemini Free Tier. Each of the four Reels Marketing Content variables is scored across Interaction, Participation, and Sharing (2–5 rating scale; 8.00–20.00 overall score).
              </p>
            </div>

            {validationError && (
              <div className="mt-5">
                <AlertBanner tone="error" message={validationError} />
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="target-persona-select"
                  className="block text-sm font-medium text-slate-200 mb-1.5"
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
                  className="block text-sm font-medium text-slate-200 mb-1.5"
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
                className="block text-sm font-medium text-slate-200 mb-1.5"
              >
                Product or Brand Context <span className="font-normal text-slate-400">(Optional)</span>
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

            {/* Rubric preview strip */}
            <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-400">Informational</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-white">
                  2.00–5.00
                </p>
                <p className="text-[11px] text-slate-400 tabular-nums">Mean 3.40 · r=0.372</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Entertainment</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-white">
                  2.00–5.00
                </p>
                <p className="text-[11px] text-slate-400 tabular-nums">Mean 3.19 · r=0.463</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Trendiness</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-white">
                  2.00–5.00
                </p>
                <p className="text-[11px] text-slate-400 tabular-nums">Mean 3.43 · r=0.306</p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">Relatable</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-white">
                  2.00–5.00
                </p>
                <p className="text-[11px] text-slate-400 tabular-nums">Mean 3.31 · r=0.554</p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              <span>Each variable averaged across Interaction, Participation &amp; Sharing (8.00–20.00 total)</span>
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
