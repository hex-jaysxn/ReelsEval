import { motion } from 'motion/react';
import type { ReelEvaluation } from '../types/evaluation.ts';
import {
  computeSelectedCharacteristicsAverage,
  getEvaluatedVariableList,
  getVariableEffectiveness,
  getVariableTone,
  isFullEvaluation,
  resolveEvaluationScope,
} from '../utils/evaluationLogic.ts';
import { ElevatedGlassPanel, StatusBadge } from './ui/GlassPrimitives.tsx';
import {
  AnimatedNumber,
  RV_EASE,
  ScaleMaskReveal,
  useMotionProfile,
} from './ui/MotionPrimitives.tsx';

interface ScoreGaugeProps {
  evaluation: ReelEvaluation;
}

export function ScoreGauge({ evaluation }: ScoreGaugeProps) {
  const { overallScore, scoreTier, executiveSummary, brandEngagementSummary } = evaluation;
  const profile = useMotionProfile();
  const isReduced = profile.tier === 'reduced';

  const full = isFullEvaluation(evaluation) && overallScore !== null && scoreTier !== null;
  const scope = resolveEvaluationScope(evaluation);
  const evaluatedVars = getEvaluatedVariableList(evaluation);
  const selectedAverage =
    evaluation.selectedAverageScore ??
    computeSelectedCharacteristicsAverage(evaluation.variables, scope.selectedVariables);
  const selectedEff = getVariableEffectiveness(selectedAverage);

  const displayScore = full ? overallScore : selectedAverage;
  const maxScore = full ? 20 : 5;
  const ratio = Math.max(0, Math.min(1, displayScore / maxScore));
  const activeTone = full ? scoreTier.tone : getVariableTone(selectedEff.level);
  const activeLevel = full ? scoreTier.level : selectedEff.level;

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - ratio);

  const toneStyles = {
    positive: {
      stroke: '#34D399',
      labelColor: 'text-emerald-300',
    },
    moderate: {
      stroke: '#22D3EE',
      labelColor: 'text-cyan-300',
    },
    caution: {
      stroke: '#FBBF24',
      labelColor: 'text-amber-300',
    },
    critical: {
      stroke: '#F87171',
      labelColor: 'text-red-300',
    },
  }[activeTone];

  const partialLabel =
    evaluatedVars.length === 1
      ? `${evaluatedVars[0].label} Score`
      : 'Selected Characteristics Average';

  return (
    <ScaleMaskReveal>
      <ElevatedGlassPanel
        as="section"
        ariaLabel={full ? 'Overall Score Summary' : 'Selected Content Evaluation Summary'}
        className="p-6 lg:p-8 rv-card-hover"
      >
        <div className="flex flex-col md:flex-row md:items-center gap-8">
          {/* Radial Score Gauge (8-20 for Full Evaluation, 2-5 for Partial) */}
          <div className="flex items-center gap-6 shrink-0">
            <div className="relative h-40 w-40 flex items-center justify-center">
              <svg
                viewBox="0 0 160 160"
                className="h-full w-full -rotate-90"
                role="img"
                aria-label={
                  full
                    ? `Overall effectiveness score ${displayScore.toFixed(2)} out of 20`
                    : `${partialLabel} ${displayScore.toFixed(2)} out of 5`
                }
              >
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.18)"
                  strokeWidth="12"
                />
                <motion.circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={toneStyles.stroke}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={isReduced ? { strokeDashoffset } : { strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{
                    duration: isReduced ? 0.01 : 0.8 * profile.durationScale,
                    delay: isReduced ? 0 : 0.12,
                    ease: RV_EASE,
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono text-2xl font-bold tracking-tight text-white tabular-nums">
                  <AnimatedNumber value={displayScore} decimals={2} duration={0.7} />
                </span>
                <span className="font-mono text-xs text-slate-300 tabular-nums">
                  {full ? 'out of 20' : 'out of 5'}
                </span>
              </div>
            </div>

            <div className="md:hidden">
              <StatusBadge tone={activeTone}>{activeLevel}</StatusBadge>
              <p className="mt-2 text-xs text-slate-300">
                {full
                  ? 'Scale: 8.00–20.00'
                  : `${evaluatedVars.length} of 4 evaluated · Scale: 2.00–5.00`}
              </p>
            </div>
          </div>

          {/* Executive Summary & Engagement Dimension Means */}
          <div className="flex-1 min-w-0">
            <div className="hidden md:flex flex-wrap items-center gap-3">
              <h2 className={`font-display text-xl font-bold ${toneStyles.labelColor}`}>
                {full ? activeLevel : `Selected Content Evaluation · ${activeLevel}`}
              </h2>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className="text-xs font-medium text-slate-200 tabular-nums">
                {full
                  ? `Overall Effectiveness (${displayScore.toFixed(2)} / 20.00 · Rubric Range 8.00–20.00)`
                  : `${partialLabel}: ${displayScore.toFixed(2)} / 5.00 (${evaluatedVars.length} of 4 content characteristics evaluated)`}
              </span>
            </div>

            <p className="mt-2.5 text-sm text-slate-100 leading-relaxed">{executiveSummary}</p>
            <p className="mt-1.5 text-xs text-slate-300">
              {full
                ? scoreTier.summary
                : `${selectedEff.interpretation} Partial-scope summary only — the official 20-point overall score requires evaluating all four content characteristics.`}
            </p>

            <div className="mt-6 pt-5 border-t border-sky-400/15 grid grid-cols-2 sm:grid-cols-4 gap-5">
              <div>
                <p className="text-xs font-medium text-slate-300">Interaction Mean</p>
                <p className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                  <AnimatedNumber value={brandEngagementSummary.interactionMean} decimals={2} duration={0.55} />{' '}
                  <span className="text-xs font-normal text-slate-300">/ 5</span>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-300">Participation Mean</p>
                <p className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                  <AnimatedNumber value={brandEngagementSummary.participationMean} decimals={2} duration={0.6} />{' '}
                  <span className="text-xs font-normal text-slate-300">/ 5</span>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-300">Sharing Mean</p>
                <p className="mt-1 font-mono text-lg font-semibold text-white tabular-nums">
                  <AnimatedNumber value={brandEngagementSummary.sharingMean} decimals={2} duration={0.65} />{' '}
                  <span className="text-xs font-normal text-slate-300">/ 5</span>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-300">Focus Opportunity</p>
                <p className="mt-1 font-display text-base font-semibold text-cyan-300">
                  {brandEngagementSummary.lowestDriver}
                </p>
              </div>
            </div>
          </div>
        </div>
      </ElevatedGlassPanel>
    </ScaleMaskReveal>
  );
}
