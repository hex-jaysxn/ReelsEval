import { useState } from 'react';
import { motion } from 'motion/react';
import type { ReelEvaluation } from '../types/evaluation.ts';
import {
  STUDY_VARIABLE_META,
  getEvaluatedVariableList,
  isFullEvaluation,
} from '../utils/evaluationLogic.ts';
import { GlassPanel, ProgressBar } from './ui/GlassPrimitives.tsx';
import {
  InteractiveTiltCard,
  RV_EASE,
  ScaleMaskReveal,
  ScrollSectionBridge,
  useMotionProfile,
} from './ui/MotionPrimitives.tsx';

interface ChartsSectionProps {
  evaluation: ReelEvaluation;
}

export function ChartsSection({ evaluation }: ChartsSectionProps) {
  const { brandEngagementSummary } = evaluation;
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);
  const profile = useMotionProfile();
  const reduced = profile.tier === 'reduced';

  const full = isFullEvaluation(evaluation);
  const evaluatedVars = getEvaluatedVariableList(evaluation);

  const radarAxes = evaluatedVars.map((v) => ({
    key: v.key,
    label: STUDY_VARIABLE_META[v.key].shortLabel,
    fullLabel: v.label,
    score: v.averageScore,
    surveyMean: v.surveyMean,
  }));

  const cx = 180;
  const cy = 132;
  const maxR = 68;
  const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

  const getPoint = (value: number, axisIndex: number) => {
    const r = (Math.max(0, Math.min(5, value)) / 5) * maxR;
    return {
      x: cx + r * Math.cos(angles[axisIndex]),
      y: cy + r * Math.sin(angles[axisIndex]),
    };
  };

  const polygonPoints = full
    ? radarAxes
        .map((axis, idx) => {
          const pt = getPoint(axis.score, idx);
          return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
        })
        .join(' ')
    : '';

  const benchmarkPoints = full
    ? radarAxes
        .map((axis, idx) => {
          const pt = getPoint(axis.surveyMean, idx);
          return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
        })
        .join(' ')
    : '';

  const allBars = [
    ...evaluatedVars.map((v) => ({
      label: v.label,
      group: `r = ${v.correlationLabel.split(' ')[0]}`,
      score: v.averageScore,
      colorClass: 'bg-gradient-to-r from-violet-500 to-indigo-400',
    })),
    {
      label: 'Interaction',
      group: 'Dimension Mean',
      score: brandEngagementSummary.interactionMean,
      colorClass: 'bg-gradient-to-r from-blue-500 to-cyan-400',
    },
    {
      label: 'Participation',
      group: 'Dimension Mean',
      score: brandEngagementSummary.participationMean,
      colorClass: 'bg-gradient-to-r from-blue-500 to-cyan-400',
    },
    {
      label: 'Sharing',
      group: 'Dimension Mean',
      score: brandEngagementSummary.sharingMean,
      colorClass: 'bg-gradient-to-r from-blue-500 to-cyan-400',
    },
  ];

  return (
    <ScrollSectionBridge accent="sky" className="pt-2">
      <div
        aria-label="Score Visualization Charts"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Chart 1: 4-Variable Radar (Full Evaluation) OR Selected Characteristics vs. Study Mean */}
        <ScaleMaskReveal inView>
          <InteractiveTiltCard>
            <GlassPanel className="p-6 h-full rv-card-hover">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                <h3 className="font-display text-base font-semibold text-white">
                  {full
                    ? 'Reels Content Profile vs. Study Mean'
                    : 'Selected Content vs. Study Mean'}
                </h3>
                <div className="flex items-center gap-3 text-xs text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-xs bg-cyan-400" aria-hidden="true" />
                    This Reel
                  </span>
                  <span className="flex items-center gap-1.5">
                    {full ? (
                      <svg className="h-2 w-5 shrink-0" viewBox="0 0 20 8" aria-hidden="true">
                        <line
                          x1="1"
                          y1="4"
                          x2="19"
                          y2="4"
                          stroke="#CBD5E1"
                          strokeWidth="1.75"
                          strokeDasharray="4 3"
                        />
                      </svg>
                    ) : (
                      <span className="inline-block h-2.5 w-2.5 rounded-xs bg-slate-400/70" aria-hidden="true" />
                    )}
                    Study Mean
                  </span>
                </div>
              </div>

              {full && radarAxes.length === 4 ? (
                <div className="flex flex-col items-center gap-4">
                  <svg
                    viewBox="0 0 360 264"
                    className="w-full max-w-[340px] h-auto shrink-0"
                    role="img"
                    aria-label="Radar chart comparing Informational, Entertainment, Trendiness, and Relatable scores against study survey means"
                  >
                    {[1, 2, 3, 4, 5].map((level) => {
                      const pts = angles
                        .map((_, idx) => {
                          const p = getPoint(level, idx);
                          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                        })
                        .join(' ');
                      return (
                        <polygon
                          key={level}
                          points={pts}
                          fill="none"
                          stroke={level === 5 ? 'rgba(56, 189, 248, 0.35)' : 'rgba(148, 163, 184, 0.18)'}
                          strokeWidth="1"
                        />
                      );
                    })}

                    {angles.map((_, idx) => {
                      const outer = getPoint(5, idx);
                      return (
                        <line
                          key={idx}
                          x1={cx}
                          y1={cy}
                          x2={outer.x}
                          y2={outer.y}
                          stroke="rgba(148, 163, 184, 0.2)"
                          strokeWidth="1"
                        />
                      );
                    })}

                    <polygon
                      points={benchmarkPoints}
                      fill="none"
                      stroke="#CBD5E1"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      strokeLinejoin="round"
                    />

                    <motion.polygon
                      points={polygonPoints}
                      fill="rgba(34, 211, 238, 0.22)"
                      stroke="#22D3EE"
                      strokeWidth="2.2"
                      strokeLinejoin="round"
                      style={{ transformOrigin: `${cx}px ${cy}px` }}
                      initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.72 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: reduced ? 0.01 : 0.45, ease: RV_EASE }}
                    />

                    {radarAxes.map((axis, idx) => {
                      const pt = getPoint(axis.score, idx);
                      const isHovered = hoveredAxis === axis.key;
                      return (
                        <circle
                          key={axis.key}
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 5.5 : 4}
                          fill="#22D3EE"
                          stroke="#060922"
                          strokeWidth="1.5"
                          onMouseEnter={() => setHoveredAxis(axis.key)}
                          onMouseLeave={() => setHoveredAxis(null)}
                          className="cursor-pointer transition-all duration-150"
                        />
                      );
                    })}

                    <text x={cx} y={36} textAnchor="middle" className="fill-slate-100 text-[11px] font-medium">
                      Informational ({radarAxes[0].score.toFixed(2)})
                    </text>
                    <text x={cx + maxR + 10} y={cy + 4} textAnchor="start" className="fill-slate-100 text-[11px] font-medium">
                      Entertain ({radarAxes[1].score.toFixed(2)})
                    </text>
                    <text x={cx} y={cy + maxR + 24} textAnchor="middle" className="fill-slate-100 text-[11px] font-medium">
                      Trendiness ({radarAxes[2].score.toFixed(2)})
                    </text>
                    <text x={cx - maxR - 10} y={cy + 4} textAnchor="end" className="fill-slate-100 text-[11px] font-medium">
                      Relatable ({radarAxes[3].score.toFixed(2)})
                    </text>
                  </svg>

                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-3 border-t border-sky-400/15">
                    {radarAxes.map((axis) => (
                      <div
                        key={axis.key}
                        onMouseEnter={() => setHoveredAxis(axis.key)}
                        onMouseLeave={() => setHoveredAxis(null)}
                        className={`flex items-center justify-between gap-3 py-1.5 px-2.5 rounded-lg transition-colors ${
                          hoveredAxis === axis.key ? 'bg-cyan-500/15' : ''
                        }`}
                      >
                        <span className="text-xs font-medium text-slate-100 truncate">
                          {axis.label}
                          <span className="text-slate-300 font-normal"> · Mean {axis.surveyMean.toFixed(2)}</span>
                        </span>
                        <span className="font-mono text-xs font-semibold tabular-nums text-white whitespace-nowrap shrink-0">
                          {axis.score.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-5 mt-2">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Comparing only the {radarAxes.length} evaluated characteristic{radarAxes.length > 1 ? 's' : ''} against the published study survey mean (scale 2.00–5.00).
                  </p>
                  {radarAxes.map((axis) => {
                    const delta = axis.score - axis.surveyMean;
                    const deltaLabel = `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} vs Mean`;
                    return (
                      <div key={axis.key} className="space-y-2 rounded-xl border border-sky-400/15 bg-[#070b28]/65 p-3.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                          <span className="font-semibold text-white">{axis.fullLabel}</span>
                          <span
                            className={`font-mono font-semibold tabular-nums ${
                              delta >= 0 ? 'text-emerald-300' : 'text-amber-300'
                            }`}
                          >
                            {deltaLabel}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-200">
                            <span>This Reel</span>
                            <span className="font-mono font-semibold tabular-nums text-cyan-300">
                              {axis.score.toFixed(2)} / 5.00
                            </span>
                          </div>
                          <ProgressBar
                            value={axis.score}
                            max={5}
                            colorClass="bg-gradient-to-r from-blue-500 to-cyan-400"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-300">
                            <span>Study Survey Mean</span>
                            <span className="font-mono tabular-nums text-slate-200">
                              {axis.surveyMean.toFixed(2)} / 5.00
                            </span>
                          </div>
                          <ProgressBar
                            value={axis.surveyMean}
                            max={5}
                            colorClass="bg-slate-400/70"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassPanel>
          </InteractiveTiltCard>
        </ScaleMaskReveal>

        {/* Chart 2: Evaluated Content Variables vs Brand Engagement Dimension Means */}
        <ScaleMaskReveal inView delay={0.08}>
          <InteractiveTiltCard>
            <GlassPanel className="p-6 h-full rv-card-hover">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                <h3 className="font-display text-base font-semibold text-white">
                  Variable Averages &amp; Engagement Means
                </h3>
                <div className="flex items-center gap-4 text-xs text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-xs bg-violet-500" aria-hidden="true" />
                    Content Variables
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-xs bg-cyan-400" aria-hidden="true" />
                    Engagement Means
                  </span>
                </div>
              </div>

              <div className="space-y-3.5 mt-2">
                {allBars.map((bar) => (
                  <div key={bar.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-medium text-slate-100 truncate">
                        {bar.label}
                        <span className="text-slate-300 font-normal"> · {bar.group}</span>
                      </span>
                      <span className="font-mono font-semibold tabular-nums text-white whitespace-nowrap shrink-0">
                        {bar.score.toFixed(2)} / 5.00
                      </span>
                    </div>
                    <ProgressBar value={bar.score} max={5} colorClass={bar.colorClass} />
                  </div>
                ))}
              </div>
            </GlassPanel>
          </InteractiveTiltCard>
        </ScaleMaskReveal>
      </div>
    </ScrollSectionBridge>
  );
}
