import type { ReelEvaluation } from '../types/evaluation.ts';

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
      stroke: '#16A34A',
      labelColor: 'text-emerald-700',
    },
    moderate: {
      stroke: '#4F46E5',
      labelColor: 'text-indigo-700',
    },
    caution: {
      stroke: '#D97706',
      labelColor: 'text-amber-700',
    },
    critical: {
      stroke: '#DC2626',
      labelColor: 'text-red-700',
    },
  }[scoreTier.tone];

  return (
    <section
      aria-label="Overall Score Summary"
      className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8"
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
                stroke="#E2E8F0"
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
              <span className="font-mono text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
                {overallScore.toFixed(2)}
              </span>
              <span className="font-mono text-xs text-slate-500 tabular-nums">out of 20</span>
            </div>
          </div>

          <div className="md:hidden">
            <p className={`text-sm font-semibold ${toneStyles.labelColor}`}>{scoreTier.level}</p>
            <p className="mt-1 text-xs text-slate-500">Scale: 8.00–20.00</p>
          </div>
        </div>

        {/* Executive Summary & Engagement Dimension Means */}
        <div className="flex-1 min-w-0">
          <div className="hidden md:flex items-baseline gap-2.5">
            <h2 className={`font-display text-xl font-bold ${toneStyles.labelColor}`}>
              {scoreTier.level}
            </h2>
            <span className="text-xs text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className="text-xs font-medium text-slate-500 tabular-nums">
              Overall Effectiveness ({overallScore.toFixed(2)} / 20.00 · Rubric Range 8.00–20.00)
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-700 leading-relaxed">{executiveSummary}</p>
          <p className="mt-1.5 text-xs text-slate-500">{scoreTier.summary}</p>

          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-5">
            <div>
              <p className="text-xs font-medium text-slate-500">Interaction Mean</p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {brandEngagementSummary.interactionMean.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-400">/ 5</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Participation Mean</p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {brandEngagementSummary.participationMean.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-400">/ 5</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Sharing Mean</p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {brandEngagementSummary.sharingMean.toFixed(2)}{' '}
                <span className="text-xs font-normal text-slate-400">/ 5</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Focus Opportunity</p>
              <p className="mt-1 font-display text-base font-semibold text-indigo-700">
                {brandEngagementSummary.lowestDriver}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
