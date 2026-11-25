import type { EffectivenessLevel, ReelEvaluation, VariableAssessment } from '../types/evaluation.ts';
import { GlassPanel, ProgressBar } from './ui/GlassPrimitives.tsx';
import {
  ClipRevealHeading,
  InteractiveTiltCard,
  ScaleMaskReveal,
  ScrollSectionBridge,
  StaggerGroup,
  StaggerItem,
} from './ui/MotionPrimitives.tsx';

interface CategoryScoreCardsProps {
  evaluation: ReelEvaluation;
}

function getEffectivenessTextClass(level: EffectivenessLevel): string {
  switch (level) {
    case 'Very Effective':
      return 'text-emerald-300';
    case 'Effective':
      return 'text-cyan-300';
    case 'Moderately Effective':
      return 'text-amber-300';
    case 'Less Effective':
      return 'text-red-300';
  }
}

function VariableCard({ variable }: { variable: VariableAssessment }) {
  const dimensions = [
    { name: 'Interaction', data: variable.interaction },
    { name: 'Participation', data: variable.participation },
    { name: 'Sharing', data: variable.sharing },
  ];

  return (
    <InteractiveTiltCard>
      <GlassPanel as="article" className="p-5 flex flex-col justify-between h-full rv-card-hover">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-display text-sm font-semibold text-white">{variable.label}</h4>
              <p className={`text-xs font-semibold mt-0.5 ${getEffectivenessTextClass(variable.effectivenessLevel)}`}>
                {variable.effectivenessLevel}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono text-base font-bold tabular-nums text-white">
                {variable.averageScore.toFixed(2)}
                <span className="text-xs font-normal text-slate-300">/5</span>
              </span>
            </div>
          </div>

          <p className="mt-1.5 text-[11px] text-slate-300 tabular-nums">
            Survey Mean {variable.surveyMean.toFixed(2)} · r = {variable.correlationLabel}
          </p>

          <div className="mt-3">
            <ProgressBar
              value={variable.averageScore}
              max={5}
              colorClass="bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-400"
            />
          </div>

          <p className="mt-3 text-xs text-slate-200 leading-relaxed">
            {variable.effectivenessInterpretation}
          </p>

          {/* 3 Engagement Dimension Breakdowns (2-5) */}
          <div className="mt-4 pt-3 border-t border-sky-400/15 space-y-3">
            {dimensions.map((dim) => (
              <div key={dim.name}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-100">{dim.name}</span>
                  <span className="font-mono font-semibold tabular-nums text-cyan-300">
                    {dim.data.score} / 5
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-300 leading-relaxed">{dim.data.rationale}</p>
              </div>
            ))}
          </div>
        </div>

        {variable.observedCues && variable.observedCues.length > 0 && (
          <div className="mt-4 pt-3 border-t border-sky-400/15">
            <p className="text-[11px] font-semibold text-slate-300 mb-1.5">Observed Video Cues</p>
            <ul className="space-y-1">
              {variable.observedCues.map((cue, idx) => (
                <li key={idx} className="text-xs text-slate-200 flex items-start gap-1.5">
                  <span className="text-cyan-400 select-none" aria-hidden="true">
                    ·
                  </span>
                  <span>{cue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </GlassPanel>
    </InteractiveTiltCard>
  );
}

export function CategoryScoreCards({ evaluation }: CategoryScoreCardsProps) {
  const { variables, brandEngagementSummary, overallScore, scoreTier } = evaluation;
  const variableList = [
    variables.informational,
    variables.entertainment,
    variables.trendiness,
    variables.relatable,
  ];

  return (
    <div className="space-y-8">
      {/* Section III Scoring & Computation Matrix Table */}
      <ScrollSectionBridge accent="indigo" className="pt-2">
        <ScaleMaskReveal inView>
          <GlassPanel
            as="section"
            ariaLabel="4x3 Scoring and Computation Matrix"
            className="p-6 rv-card-hover"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <h3 className="font-display text-base font-semibold text-white">
                Reels Content × Brand Engagement Matrix
              </h3>
              <span className="font-mono text-xs text-slate-300 tabular-nums">
                Formula: (Interaction + Participation + Sharing) ÷ 3 · Scale 2–5
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-sky-400/20 text-xs font-semibold text-slate-300">
                    <th className="py-2.5 pr-4">Reels Marketing Content Variable</th>
                    <th className="py-2.5 px-3 text-right">Interaction</th>
                    <th className="py-2.5 px-3 text-right">Participation</th>
                    <th className="py-2.5 px-3 text-right">Sharing</th>
                    <th className="py-2.5 px-3 text-right">Average</th>
                    <th className="py-2.5 pl-4">Effectiveness Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-400/10 text-sm">
                  {variableList.map((v) => (
                    <tr key={v.key} className="hover:bg-white/[0.04] transition-colors">
                      <td className="py-3 pr-4">
                        <span className="font-medium text-white">{v.label}</span>
                        <span className="ml-2 text-xs text-slate-300 tabular-nums">
                          (Mean {v.surveyMean.toFixed(2)})
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-100">
                        {v.interaction.score}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-100">
                        {v.participation.score}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-100">
                        {v.sharing.score}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums text-cyan-300">
                        {v.averageScore.toFixed(2)}
                      </td>
                      <td className={`py-3 pl-4 text-xs font-semibold ${getEffectivenessTextClass(v.effectivenessLevel)}`}>
                        {v.effectivenessLevel}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-sky-400/20 bg-[#070b28]/80 text-sm font-semibold">
                    <td className="py-3 pr-4 text-white">Total / Dimension Means</td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-cyan-300">
                      {brandEngagementSummary.interactionMean.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-cyan-300">
                      {brandEngagementSummary.participationMean.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-cyan-300">
                      {brandEngagementSummary.sharingMean.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-white">
                      {overallScore.toFixed(2)} / 20
                    </td>
                    <td className={`py-3 pl-4 text-xs font-semibold ${getEffectivenessTextClass(scoreTier.level)}`}>
                      {scoreTier.level}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </GlassPanel>
        </ScaleMaskReveal>
      </ScrollSectionBridge>

      {/* Individual Variable Detail Cards */}
      <ScrollSectionBridge accent="sky" className="pt-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <ClipRevealHeading inView>
            <h3 className="font-display text-lg font-bold text-white">
              Variable-by-Variable Assessment
            </h3>
          </ClipRevealHeading>
          <span className="font-mono text-xs font-medium text-slate-300 tabular-nums">
            4 Variables · 2.00–5.00 Each · {overallScore.toFixed(2)} / 20.00 Total
          </span>
        </div>
        <StaggerGroup inView staggerDelay={0.08} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {variableList.map((v) => (
            <StaggerItem key={v.key} className="h-full">
              <VariableCard variable={v} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      </ScrollSectionBridge>
    </div>
  );
}
