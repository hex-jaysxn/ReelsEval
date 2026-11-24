import { useRef, useState } from 'react';
import { AlertCircle, Film, Play, Sparkles, Trash2, UploadCloud } from 'lucide-react';
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
    <section
      aria-label="Video Upload and Configuration"
      className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8"
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
              className={`flex-1 min-h-[340px] flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed p-6 transition-colors ${
                isDragging
                  ? 'border-indigo-600 bg-indigo-50/50'
                  : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-slate-200 text-indigo-600 mb-4">
                <UploadCloud className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Upload Short-Form Reel
              </h2>
              <p className="mt-1.5 text-sm text-slate-500 max-w-xs leading-relaxed">
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

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
              >
                <Film className="h-4 w-4" aria-hidden="true" />
                <span>Select Video File</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-200 aspect-[9/14] max-h-[420px] flex items-center justify-center">
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

              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">
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

                <button
                  type="button"
                  onClick={onClearFile}
                  disabled={isAnalyzing}
                  aria-label="Remove selected video"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Change</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Evaluation Parameters & Launch CTA */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="border-b border-slate-200 pb-4">
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 text-balance">
                Evaluate Reels Marketing & Brand Engagement
              </h1>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed max-w-2xl">
                Upload a short-form marketing video for real multimodal analysis using Google Gemini Free Tier. Scored across four 5-point Reels Marketing Content variables (20 points total) and three Brand Engagement pillars.
              </p>
            </div>

            {validationError && (
              <div
                role="alert"
                className="mt-5 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{validationError}</span>
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="target-persona-select"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:opacity-60"
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
                  className="block text-sm font-medium text-slate-700 mb-1.5"
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:opacity-60"
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
                className="block text-sm font-medium text-slate-700 mb-1.5"
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
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:opacity-60"
              />
            </div>

            {/* Rubric preview strip */}
            <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500">Related Content</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">
                  0–5 pts
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Entertainment</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">
                  0–5 pts
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Informational</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">
                  0–5 pts
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Trendiness</p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900">
                  0–5 pts
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              <span>Evaluates Interaction, Sharing & Participation alongside content quality</span>
            </div>

            <button
              type="button"
              onClick={onAnalyze}
              disabled={!selectedFile || isAnalyzing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
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
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
