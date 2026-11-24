import { useMemo, useState } from 'react';
import { Download, Eye, Film, Search, Trash2 } from 'lucide-react';
import type { ReelEvaluation } from '../types/evaluation.ts';
import { buildReportMarkdown, formatBytes, formatDuration } from '../utils/evaluationLogic.ts';
import { ActionButton, EmptyState, GlassPanel, Modal } from './ui/GlassPrimitives.tsx';

interface HistoryViewProps {
  history: ReelEvaluation[];
  onSelectEvaluation: (evaluation: ReelEvaluation) => void;
  onDeleteEvaluation: (id: string) => void;
  onClearHistory: () => void;
  onGoToEvaluator: () => void;
}

type TierFilter = 'all' | 'very-effective' | 'effective' | 'moderate' | 'less-effective';

export function HistoryView({
  history,
  onSelectEvaluation,
  onDeleteEvaluation,
  onClearHistory,
  onGoToEvaluator,
}: HistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return history.filter((item) => {
      const matchesSearch =
        !q ||
        item.videoMetadata.fileName.toLowerCase().includes(q) ||
        item.context.targetPersona.toLowerCase().includes(q) ||
        item.context.campaignObjective.toLowerCase().includes(q) ||
        item.scoreTier.level.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (tierFilter === 'very-effective') return item.overallScore >= 17;
      if (tierFilter === 'effective') return item.overallScore >= 14 && item.overallScore < 17;
      if (tierFilter === 'moderate') return item.overallScore >= 11 && item.overallScore < 14;
      if (tierFilter === 'less-effective') return item.overallScore < 11;
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
    <section aria-label="Evaluation History" className="space-y-6 rv-animate-in">
      <GlassPanel className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-white/10">
          <div>
            <h1 className="font-display text-xl font-bold text-white">Evaluation History</h1>
            <p className="mt-1 text-sm text-slate-300">
              Saved Reel assessments scored on the 8.00–20.00 effectiveness rubric.
            </p>
          </div>

          {history.length > 0 && (
            <ActionButton
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setConfirmClearOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear All History</span>
            </ActionButton>
          )}
        </div>

        {history.length === 0 ? (
          <EmptyState
            icon={<Film className="h-6 w-6" aria-hidden="true" />}
            title="No Reels Evaluated Yet"
            description="Upload a short-form marketing video in the Video Evaluator to generate your first 4×3 rubric assessment and save it here."
            action={
              <ActionButton variant="primary" onClick={onGoToEvaluator}>
                <span>Evaluate Your First Reel</span>
              </ActionButton>
            }
          />
        ) : (
          <>
            {/* Search & Section V Tier Filters */}
            <div className="mt-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search
                  className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by file, audience, or level..."
                  aria-label="Search evaluation history"
                  className="w-full h-10 rounded-xl rv-input-solid pl-10 pr-3.5 text-sm"
                />
              </div>

              <div
                role="group"
                aria-label="Filter by effectiveness level"
                className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-950/75 border border-white/10 rounded-xl self-start"
              >
                {[
                  { id: 'all', label: 'All' },
                  { id: 'very-effective', label: '17–20' },
                  { id: 'effective', label: '14–16.99' },
                  { id: 'moderate', label: '11–13.99' },
                  { id: 'less-effective', label: '8–10.99' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTierFilter(opt.id as TierFilter)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      tierFilter === opt.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
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
                  <tr className="border-b border-white/12 text-xs font-semibold text-slate-400">
                    <th className="py-3 pr-4">Video</th>
                    <th className="py-3 px-4">Target Audience</th>
                    <th className="py-3 px-4 text-right">Overall Score</th>
                    <th className="py-3 px-4">Effectiveness Level</th>
                    <th className="py-3 px-4">Evaluated</th>
                    <th className="py-3 pl-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8 text-sm">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-slate-400">
                        No evaluations match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3.5 pr-4">
                          <p className="font-medium text-white truncate max-w-[220px]">
                            {item.videoMetadata.fileName}
                          </p>
                          <p className="text-xs text-slate-400 tabular-nums">
                            {formatBytes(item.videoMetadata.fileSizeBytes)} ·{' '}
                            {formatDuration(item.videoMetadata.durationSeconds)}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="text-slate-200">{item.context.targetPersona}</p>
                          <p className="text-xs text-slate-400">{item.context.campaignObjective}</p>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-indigo-300 whitespace-nowrap">
                          {item.overallScore.toFixed(2)} / 20
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold text-slate-200 whitespace-nowrap">
                          {item.scoreTier.level}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400 tabular-nums whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 pl-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectEvaluation(item)}
                              aria-label={`View report for ${item.videoMetadata.fileName}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white whitespace-nowrap cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportMarkdown(item)}
                              aria-label={`Download Markdown report for ${item.videoMetadata.fileName}`}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white cursor-pointer"
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteEvaluation(item.id)}
                              aria-label={`Delete evaluation for ${item.videoMetadata.fileName}`}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-400 hover:bg-red-950/80 hover:text-red-300 hover:border-red-500/40 cursor-pointer"
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
      </GlassPanel>

      <Modal
        open={confirmClearOpen}
        title="Clear all saved evaluations?"
        description="This permanently removes all Reel evaluations and reports from your ReeView history. This action cannot be undone."
        onClose={() => setConfirmClearOpen(false)}
        footer={
          <>
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={() => setConfirmClearOpen(false)}
            >
              Cancel
            </ActionButton>
            <ActionButton
              variant="danger"
              size="sm"
              onClick={() => {
                setConfirmClearOpen(false);
                onClearHistory();
              }}
            >
              Clear All History
            </ActionButton>
          </>
        }
      />
    </section>
  );
}
