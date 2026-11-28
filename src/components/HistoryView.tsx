import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Download, Eye, Film, Search, Trash2 } from 'lucide-react';
import type { ReelEvaluation } from '../types/evaluation.ts';
import {
  buildReportMarkdown,
  computeSelectedCharacteristicsAverage,
  formatBytes,
  formatDuration,
  getEvaluatedVariableList,
  getVariableEffectiveness,
  isFullEvaluation,
  resolveEvaluationScope,
} from '../utils/evaluationLogic.ts';
import { ActionButton, EmptyState, GlassPanel, Modal } from './ui/GlassPrimitives.tsx';
import { RV_SPRING } from './ui/MotionPrimitives.tsx';

interface HistoryViewProps {
  history: ReelEvaluation[];
  onSelectEvaluation: (evaluation: ReelEvaluation) => void;
  onDeleteEvaluation: (id: string) => void;
  onClearHistory: () => void;
  onGoToEvaluator: () => void;
}

type TierFilter = 'all' | 'very-effective' | 'effective' | 'moderate' | 'less-effective' | 'partial';

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
  const reduced = useReducedMotion();

  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return history.filter((item) => {
      const full = isFullEvaluation(item) && item.overallScore !== null && item.scoreTier !== null;
      const scope = resolveEvaluationScope(item);
      const selectedAvg =
        item.selectedAverageScore ??
        computeSelectedCharacteristicsAverage(item.variables, scope.selectedVariables);
      const effLevel = full ? item.scoreTier!.level : getVariableEffectiveness(selectedAvg).level;
      const varLabels = getEvaluatedVariableList(item)
        .map((v) => v.label.toLowerCase())
        .join(' ');

      const matchesSearch =
        !q ||
        item.videoMetadata.fileName.toLowerCase().includes(q) ||
        item.context.targetPersona.toLowerCase().includes(q) ||
        item.context.campaignObjective.toLowerCase().includes(q) ||
        effLevel.toLowerCase().includes(q) ||
        varLabels.includes(q);

      if (!matchesSearch) return false;
      if (tierFilter === 'partial') return !full;
      if (tierFilter === 'very-effective') return full && (item.overallScore ?? 0) >= 17;
      if (tierFilter === 'effective')
        return full && (item.overallScore ?? 0) >= 14 && (item.overallScore ?? 0) < 17;
      if (tierFilter === 'moderate')
        return full && (item.overallScore ?? 0) >= 11 && (item.overallScore ?? 0) < 14;
      if (tierFilter === 'less-effective') return full && (item.overallScore ?? 0) < 11;
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-sky-400/15">
          <div>
            <h1 className="font-display text-xl font-bold text-white">Evaluation History</h1>
            <p className="mt-1 text-sm text-slate-200">
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
                  className="h-4 w-4 text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
                className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#070b28] border border-sky-400/20 rounded-xl self-start"
              >
                {[
                  { id: 'all', label: 'All' },
                  { id: 'very-effective', label: '17–20' },
                  { id: 'effective', label: '14–16.99' },
                  { id: 'moderate', label: '11–13.99' },
                  { id: 'less-effective', label: '8–10.99' },
                  { id: 'partial', label: 'Partial Scope' },
                ].map((opt) => {
                  const selected = tierFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTierFilter(opt.id as TierFilter)}
                      className={`relative px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                        selected ? 'text-white' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {selected && (
                        <motion.span
                          layoutId="rv-history-filter"
                          transition={reduced ? { duration: 0.01 } : RV_SPRING}
                          className="absolute inset-0 rounded-lg rv-cta-gradient shadow-xs"
                          aria-hidden="true"
                        />
                      )}
                      <span className="relative z-10">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* History Table */}
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-sky-400/20 text-xs font-semibold text-slate-300">
                    <th className="py-3 pr-4">Video</th>
                    <th className="py-3 px-4">Target Audience</th>
                    <th className="py-3 px-4 text-right">Score</th>
                    <th className="py-3 px-4">Effectiveness Level</th>
                    <th className="py-3 px-4">Evaluated</th>
                    <th className="py-3 pl-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-400/10 text-sm">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-slate-300">
                        No evaluations match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item) => {
                      const full =
                        isFullEvaluation(item) &&
                        item.overallScore !== null &&
                        item.scoreTier !== null;
                      const scope = resolveEvaluationScope(item);
                      const selectedAvg =
                        item.selectedAverageScore ??
                        computeSelectedCharacteristicsAverage(
                          item.variables,
                          scope.selectedVariables
                        );
                      const effLevel = full
                        ? item.scoreTier!.level
                        : getVariableEffectiveness(selectedAvg).level;

                      return (
                      <tr key={item.id} className="hover:bg-white/[0.04] transition-colors">
                        <td className="py-3.5 pr-4">
                          <p className="font-medium text-white truncate max-w-[220px]">
                            {item.videoMetadata.fileName}
                          </p>
                          <p className="text-xs text-slate-300 tabular-nums">
                            {formatBytes(item.videoMetadata.fileSizeBytes)} ·{' '}
                            {formatDuration(item.videoMetadata.durationSeconds)}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="text-slate-100">{item.context.targetPersona}</p>
                          <p className="text-xs text-slate-300">{item.context.campaignObjective}</p>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-cyan-300 whitespace-nowrap">
                          {full && item.overallScore !== null
                            ? `${item.overallScore.toFixed(2)} / 20`
                            : `${selectedAvg.toFixed(2)} / 5 (${scope.selectedVariables.length}/4)`}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold text-slate-100 whitespace-nowrap">
                          {full ? effLevel : `${effLevel} (Partial)`}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-300 tabular-nums whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 pl-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectEvaluation(item)}
                              aria-label={`View report for ${item.videoMetadata.fileName}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-sky-400/25 bg-[#0e154a] text-xs font-medium text-slate-100 hover:bg-[#151f64] hover:text-white active:scale-[0.97] transition-all duration-150 whitespace-nowrap cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExportMarkdown(item)}
                              aria-label={`Download Markdown report for ${item.videoMetadata.fileName}`}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg border border-sky-400/25 bg-[#0e154a] text-slate-200 hover:bg-[#151f64] hover:text-white active:scale-[0.95] transition-all duration-150 cursor-pointer"
                            >
                              <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteEvaluation(item.id)}
                              aria-label={`Delete evaluation for ${item.videoMetadata.fileName}`}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg border border-sky-400/25 bg-[#0e154a] text-slate-200 hover:bg-red-950/85 hover:text-red-200 hover:border-red-400/50 active:scale-[0.95] transition-all duration-150 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })
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
