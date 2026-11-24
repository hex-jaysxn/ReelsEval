import { Download, FileJson, Printer } from 'lucide-react';
import type { ReelEvaluation } from '../types/evaluation.ts';
import {
  buildReportMarkdown,
  formatBytes,
  formatDuration,
} from '../utils/evaluationLogic.ts';
import { ActionButton, GlassPanel } from './ui/GlassPrimitives.tsx';

interface ReportActionsProps {
  evaluation: ReelEvaluation;
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ReportActions({ evaluation }: ReportActionsProps) {
  const baseName = evaluation.videoMetadata.fileName.replace(/\.[^/.]+$/, '') || 'reel-evaluation';

  function handleDownloadMarkdown() {
    const md = buildReportMarkdown(evaluation);
    triggerDownload(md, `${baseName}-report.md`, 'text/markdown;charset=utf-8');
  }

  function handleDownloadJson() {
    const json = JSON.stringify(evaluation, null, 2);
    triggerDownload(json, `${baseName}-report.json`, 'application/json;charset=utf-8');
  }

  return (
    <GlassPanel className="px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rv-animate-in rv-card-hover">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-300">
          <span className="font-semibold text-white truncate max-w-[260px]">
            {evaluation.videoMetadata.fileName}
          </span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="tabular-nums">{formatBytes(evaluation.videoMetadata.fileSizeBytes)}</span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="tabular-nums">{formatDuration(evaluation.videoMetadata.durationSeconds)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
          <span>{evaluation.context.targetPersona}</span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span>{evaluation.context.campaignObjective}</span>
          <span className="text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-indigo-300">{evaluation.modelUsed}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
        <ActionButton variant="secondary" size="sm" onClick={handleDownloadMarkdown}>
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Download Report (.md)</span>
        </ActionButton>

        <ActionButton variant="secondary" size="sm" onClick={handleDownloadJson}>
          <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Export JSON</span>
        </ActionButton>

        <ActionButton variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Print</span>
        </ActionButton>
      </div>
    </GlassPanel>
  );
}
