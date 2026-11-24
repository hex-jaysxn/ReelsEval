import { useState } from 'react';
import type { ReelEvaluation } from '../types/evaluation.ts';
import { GlassPanel, ProgressBar } from './ui/GlassPrimitives.tsx';

interface ChartsSectionProps {
  evaluation: ReelEvaluation;
}

export function ChartsSection({ evaluation }: ChartsSectionProps) {
  const { variables, brandEngagementSummary } = evaluation;
  const [hoveredAxis, setHoveredAxis] = useState<string | null>(null);

  const radarAxes = [
    {
      key: 'informational',
      label: 'Informational',
      score: variables.informational.averageScore,
      surveyMean: variables.informational.surveyMean,
    },
    {
      key: 'entertainment',
      label: 'Entertainment',
      score: variables.entertainment.averageScore,
      surveyMean: variables.entertainment.surveyMean,
    },
    {
      key: 'trendiness',
      label: 'Trendiness',
      score: variables.trendiness.averageScore,
      surveyMean: variables.trendiness.surveyMean,
    },
    {
      key: 'relatable',
      label: 'Relatable',
      score: variables.relatable.averageScore,
      surveyMean: variables.relatable.surveyMean,
    },
  ];

  // Radar Geometry (4 axes: Top, Right, Bottom, Left)
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

  const polygonPoints = radarAxes
    .map((axis, idx) => {
      const pt = getPoint(axis.score, idx);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(' ');

  const benchmarkPoints = radarAxes
    .map((axis, idx) => {
      const pt = getPoint(axis.surveyMean, idx);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(' ');

  const allBars = [
    {
      label: 'Informational Content',
      group: 'r = 0.372',
      score: variables.informational.averageScore,
      colorClass: 'bg-indigo-500',
    },
    {
      label: 'Entertainment Content',
      group: 'r = 0.463',
      score: variables.entertainment.averageScore,
      colorClass: 'bg-indigo-500',
    },
    {
      label: 'Trendiness',
      group: 'r = 0.306',
      score: variables.trendiness.averageScore,
      colorClass: 'bg-indigo-500',
    },
    {
      label: 'Relatable Content',
      group: 'r = 0.554',
      score: variables.relatable.averageScore,
      colorClass: 'bg-indigo-500',
    },
    {
      label: 'Interaction',
      group: 'Dimension Mean',
      score: brandEngagementSummary.interactionMean,
      colorClass: 'bg-teal-400',
    },
    {
      label: 'Participation',
      group: 'Dimension Mean',
      score: brandEngagementSummary.participationMean,
      colorClass: 'bg-teal-400',
    },
    {
      label: 'Sharing',
      group: 'Dimension Mean',
      score: brandEngagementSummary.sharingMean,
      colorClass: 'bg-teal-400',
    },
  ];

  return (
    <section
      aria-label="Score Visualization Charts"
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      {/* Chart 1: 4-Variable Reels Marketing Content Radar + Study Survey Mean */}
      <GlassPanel className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="font-display text-base font-semibold text-white">
            Reels Content Profile vs. Study Mean
          </h3>
          <div className="flex items-center gap-3 text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-indigo-400" aria-hidden="true" />
              This Reel
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-2 w-5 shrink-0" viewBox="0 0 20 8" aria-hidden="true">
                <line
                  x1="1"
                  y1="4"
                  x2="19"
                  y2="4"
                  stroke="#94A3B8"
                  strokeWidth="1.75"
                  strokeDasharray="4 3"
                />
              </svg>
              Study Mean
            </span>
          </div>
        </div>

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
                  stroke={level === 5 ? 'rgba(148, 163, 184, 0.35)' : 'rgba(148, 163, 184, 0.16)'}
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
                  stroke="rgba(148, 163, 184, 0.18)"
                  strokeWidth="1"
                />
              );
            })}

            <polygon
              points={benchmarkPoints}
              fill="none"
              stroke="#94A3B8"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              strokeLinejoin="round"
            />

            <polygon
              points={polygonPoints}
              fill="rgba(99, 102, 241, 0.28)"
              stroke="#818CF8"
              strokeWidth="2.2"
              strokeLinejoin="round"
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
                  fill="#818CF8"
                  stroke="#0F172A"
                  strokeWidth="1.5"
                  onMouseEnter={() => setHoveredAxis(axis.key)}
                  onMouseLeave={() => setHoveredAxis(null)}
                  className="cursor-pointer transition-all"
                />
              );
            })}

            <text x={cx} y={36} textAnchor="middle" className="fill-slate-200 text-[11px] font-medium">
              Informational ({radarAxes[0].score.toFixed(2)})
            </text>
            <text x={cx + maxR + 10} y={cy + 4} textAnchor="start" className="fill-slate-200 text-[11px] font-medium">
              Entertain ({radarAxes[1].score.toFixed(2)})
            </text>
            <text x={cx} y={cy + maxR + 24} textAnchor="middle" className="fill-slate-200 text-[11px] font-medium">
              Trendiness ({radarAxes[2].score.toFixed(2)})
            </text>
            <text x={cx - maxR - 10} y={cy + 4} textAnchor="end" className="fill-slate-200 text-[11px] font-medium">
              Relatable ({radarAxes[3].score.toFixed(2)})
            </text>
          </svg>

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 pt-3 border-t border-white/10">
            {radarAxes.map((axis) => (
              <div
                key={axis.key}
                onMouseEnter={() => setHoveredAxis(axis.key)}
                onMouseLeave={() => setHoveredAxis(null)}
                className={`flex items-center justify-between gap-3 py-1.5 px-2.5 rounded-lg transition-colors ${
                  hoveredAxis === axis.key ? 'bg-indigo-500/15' : ''
                }`}
              >
                <span className="text-xs font-medium text-slate-200 truncate">
                  {axis.label}
                  <span className="text-slate-400 font-normal"> · Mean {axis.surveyMean.toFixed(2)}</span>
                </span>
                <span className="font-mono text-xs font-semibold tabular-nums text-white whitespace-nowrap shrink-0">
                  {axis.score.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </GlassPanel>

      {/* Chart 2: Content Variables vs Brand Engagement Dimension Means */}
      <GlassPanel className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="font-display text-base font-semibold text-white">
            Variable Averages &amp; Engagement Means
          </h3>
          <div className="flex items-center gap-4 text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-indigo-500" aria-hidden="true" />
              Content Variables
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-teal-400" aria-hidden="true" />
              Engagement Means
            </span>
          </div>
        </div>

        <div className="space-y-3.5 mt-2">
          {allBars.map((bar) => (
            <div key={bar.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="font-medium text-slate-200 truncate">
                  {bar.label}
                  <span className="text-slate-400 font-normal"> · {bar.group}</span>
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
    </section>
  );
}
