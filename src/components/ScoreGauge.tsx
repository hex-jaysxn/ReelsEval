import type { ReelEvaluation } from '../types/evaluation.ts';
import { ElevatedGlassPanel, StatusBadge } from './ui/GlassPrimitives.tsx';

interface ScoreGaugeProps {
  evaluation: ReelEvaluation;
}

export function ScoreGauge({ evaluation }: ScoreGaugeProps) {
  const { overallScore, scoreTier, executiveSummary, brandEngagementSummary } = evaluation;
  const maxScore = 20;
  const ratio = Math.max(0, Math.min(1, overallScore / maxScore));

  // SVG Arc geometry
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - ratio);

  const toneStyles = {
    positive: {
      stroke: '#34D399',
      labelColor: 'text-emerald-300',
    },
    moderate: {
      stroke: '#818CF8',
      labelColor: 'text-indigo-300',
    },
    caution: {
      stroke: '#FBBF24',
      labelColor: 'text-amber-300',
    },
    critical: {
      stroke: '#F87171',
      labelColor: 'text-red-300',
    },
  }[scoreTier.tone];

  return (
    <ElevatedGlassPanel
      as="section"
      ariaLabel="Overall Score Summary"
      className="p-6 lg:p-8 rv-animate-in"
    >
      <div className="flex flex-col md:flex-row md:items-center gap-8">
        {/* Radial 8.00 - 20.00 Score Gauge */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="relative h-40 w-40 flex items-center justify-center">
            <svg
              viewBox="0 0 160 160"
              className="h-full w-full -rotate-90"
              role="img"
              aria-label={`Overall effectiveness score ${overallScore.toFixed(2)} out of 20`}
            >
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="rgba(148, 163, 184, 0.18)"
                strokeWidth="12"
              />
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={toneStyles.stroke}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-[stroke-dashoffset] duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-mono text-2xl font-bold tracking-tight text-white tabular-nums">
                {overallScore.toFixed(2)}
              </span>
              <span className="font-mono text-xs text-slate-400 tabular-nums">out of 20</span>
            </div>
          </div>

          <div className="md:hidden">
            <StatusBadge tone={scoreTier.tone}>{scoreTier.level}</StatusBadge>
            <p className="mt-2 text-xs text-slate-400">Scale: 8.00–20.00</p>
          </div>
        </div>

        {/* Executive Summary & Engagement Dimension Means */}
        <div className="flex-1 min-w-0">
          <div className="hidden md:flex flex-wrap items-center gap-3">
            <h2 className={`font-display text-xl font-bold ${toneStyles.labelColor}`}>
              {scoreTier.level}
            </h2>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-xs font-medium text-slate-300 tabular-nums">
              Overall Effectiveness ({overallScore.toFixed(2)} / 20.00 · Rubric Range 8.00–20.00)
            </span>
          </div>

          <p className="mt-2.5 text-sm text-slate-200 leading-relaxed">{executiveSummary}</p>
          <p className="mt-1.5 text-xs text-slate-400">{scoreTier.summary}</p>

          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-5">
            <div>
              <p className="text-xs font-medium text-slate-400">Interaction Mean</p>
              <p className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                {brandEngagementSummary.interactionMean.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-400">/ 5</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Participation Mean</p>
              <p className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                {brandEngagementSummary.participationMean.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-400">/ 5</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Sharing Mean</p>
              <p className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                {brandEngagementSummary.sharingMean.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-400">/ 5</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400">Focus Opportunity</p>
              <p className="mt-1 font-display text-base font-semibold text-indigo-300">
                {brandEngagementSummary.lowestDriver}
              </p>
            </div>
          </div>
        </div>
      </div>
    </ElevatedGlassPanel>
  );
}
