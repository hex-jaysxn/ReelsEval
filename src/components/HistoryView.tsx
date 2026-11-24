import { useMemo, useState } from 'react';
import { Download, Eye, Film, Search, Trash2 } from 'lucide-react';
import type { ReelEvaluation } from '../types/evaluation.ts';
import { buildReportMarkdown, formatBytes, formatDuration } from '../utils/evaluationLogic.ts';

interface HistoryViewProps {
  history: ReelEvaluation[];
  onSelectEvaluation: (evaluation: ReelEvaluation) => void;
  onDeleteEvaluation: (id: string) => void;
  onClearHistory: () => void;
  onGoToEvaluator: () => void;
}

type TierFilter = 'all' | 'high' | 'strong' | 'needs-work';

export function HistoryView({
  history,
  onSelectEvaluation,
  onDeleteEvaluation,
  onClearHistory,
  onGoToEvaluator,
}: HistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return history.filter((item) => {
      const matchesSearch =
        !q ||
        item.videoMetadata.fileName.toLowerCase().includes(q) ||
        item.context.targetPersona.toLowerCase().includes(q) ||
        item.context.campaignObjective.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (tierFilter === 'high') return item.overallScore >= 17;
      if (tierFilter === 'strong') return item.overallScore >= 13 && item.overallScore < 17;
      if (tierFilter === 'needs-work') return item.overallScore < 13;
      return true;
    });
  }, [history, searchQuery, tierFilter]);

  function handleExportMarkdown(evaluation: ReelEvaluation) {
    const md = buildReportMarkdown(evaluation);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const baseName = evaluation.videoMetadata.fileName.replace(/\.[^/.]+$/, '') || 'reel-evaluation';
    link.href = url;
    link.download = `${baseName}-report.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <section aria-label="Evaluation History" className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900">Evaluation History</h1>
            <p className="mt-1 text-sm text-slate-500">
              Saved Reel evaluations stored locally in your browser for longitudinal benchmarking.
            </p>
          </div>

          {history.length > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear All History</span>
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-400">
              <Film className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-display text-base font-semibold text-slate-900">
              No Reels Evaluated Yet
            </h2>
            <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto">
              Upload a short-form marketing video in the Video Evaluator to generate your first 20-point Gemini evaluation and save it here.
            </p>
            <button
              type="button"
              onClick={onGoToEvaluator}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              <span>Evaluate Your First Reel</span>
            </button>
          </div>
        ) : (
          <>
            {/* Search & Tier Filters */}
            <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search
                  className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by file, audience, or goal..."
                  aria-label="Search evaluation history"
                  className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                />
              </div>

              <div
                role="group"
                aria-label="Filter by score tier"
                className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start"
              >
                {[
                  { id: 'all', label: 'All' },
                  { id: 'high', label: '17–20' },
                  { id: 'strong', label: '13–16.5' },
                  { id: 'needs-work', label: '0–12.5' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTierFilter(opt.id as TierFilter)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      tierFilter === opt.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* History Table */}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                    <th className="py-3 pr-4">Video</th>
                    <th className="py-3 px-4">Target Audience</th>
                    <th className="py-3 px-4 text-right">Overall Score</th>
                    <th className="py-3 px-4 text-right">Engagement</th>
                    <th className="py-3 px-4">Evaluated</th>
                    <th className="py-3 pl-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                        No evaluations match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 pr-4">
                          <p className="font-medium text-slate-900 truncate max-w-[220px]">
                            {item.videoMetadata.fileName}
                          </p>
                          <p className="text-xs text-slate-400 tabular-nums">
                            {formatBytes(item.videoMetadata.fileSizeBytes)} ·{' '}
                            {formatDuration(item.videoMetadata.durationSeconds)}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="text-slate-700">{item.context.targetPersona}</p>
                          <p className="text-xs text-slate-400">{item.context.campaignObjective}</p>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                          {item.overallScore} / 20
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-600">
                          {item.brandEngagementSummary.totalOutOf15} / 15
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 pl-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectEvaluation(item)}
                              aria-label={`View report for ${item.videoMetadata.fileName}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportMarkdown(item)}
                              aria-label={`Download Markdown report for ${item.videoMetadata.fileName}`}
                              className="inline-flex items-center justify-center p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteEvaluation(item.id)}
                              aria-label={`Delete evaluation for ${item.videoMetadata.fileName}`}
                              className="inline-flex items-center justify-center p-1.5 rounded-md border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
