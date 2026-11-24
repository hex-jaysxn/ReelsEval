import { Download, FileJson, Printer } from 'lucide-react';
import type { ReelEvaluation } from '../types/evaluation.ts';
import {
  buildReportMarkdown,
  formatBytes,
  formatDuration,
} from '../utils/evaluationLogic.ts';

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
    <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600">
          <span className="font-semibold text-slate-900 truncate max-w-[240px]">
            {evaluation.videoMetadata.fileName}
          </span>
          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>
          <span className="tabular-nums">{formatBytes(evaluation.videoMetadata.fileSizeBytes)}</span>
          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>
          <span className="tabular-nums">{formatDuration(evaluation.videoMetadata.durationSeconds)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
          <span>{evaluation.context.targetPersona}</span>
          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>
          <span>{evaluation.context.campaignObjective}</span>
          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-slate-500">{evaluation.modelUsed}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
        <button
          type="button"
          onClick={handleDownloadMarkdown}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Download Report (.md)</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadJson}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
        >
          <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Export JSON</span>
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
        >
          <Printer className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Print</span>
        </button>
      </div>
    </div>
  );
}
