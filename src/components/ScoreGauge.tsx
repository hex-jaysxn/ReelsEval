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
        {/* Radial 0-20 Score Gauge */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="relative h-40 w-40 flex items-center justify-center">
            <svg
              viewBox="0 0 160 160"
              className="h-full w-full -rotate-90"
              role="img"
              aria-label={`Overall score ${overallScore} out of 20`}
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
              <span className="font-mono text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {overallScore}
              </span>
              <span className="font-mono text-xs text-slate-500 tabular-nums">out of 20</span>
            </div>
          </div>

          <div className="md:hidden">
            <p className={`text-sm font-semibold ${toneStyles.labelColor}`}>{scoreTier.label}</p>
            <p className="mt-1 text-xs text-slate-500">Reels Marketing Index</p>
          </div>
        </div>

        {/* Executive Summary & Engagement KPI */}
        <div className="flex-1 min-w-0">
          <div className="hidden md:flex items-baseline gap-2.5">
            <h2 className={`font-display text-xl font-bold ${toneStyles.labelColor}`}>
              {scoreTier.label}
            </h2>
            <span className="text-xs text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className="text-xs font-medium text-slate-500">
              {Math.round(ratio * 100)}% Content Rubric Achievement
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-700 leading-relaxed">{executiveSummary}</p>
          <p className="mt-1.5 text-xs text-slate-500">{scoreTier.summary}</p>

          <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <p className="text-xs font-medium text-slate-500">Brand Engagement Total</p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {brandEngagementSummary.totalOutOf15}{' '}
                <span className="text-xs font-normal text-slate-400">/ 15</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Engagement Potential</p>
              <p className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {brandEngagementSummary.percentage}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Dominant Engagement Driver</p>
              <p className="mt-1 font-display text-base font-semibold text-indigo-700">
                {brandEngagementSummary.dominantDriver}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
