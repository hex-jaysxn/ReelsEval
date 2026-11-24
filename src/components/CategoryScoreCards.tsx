import type { EffectivenessLevel, ReelEvaluation, VariableAssessment } from '../types/evaluation.ts';

interface CategoryScoreCardsProps {
  evaluation: ReelEvaluation;
}

function getEffectivenessTextClass(level: EffectivenessLevel): string {
  switch (level) {
    case 'Very Effective':
      return 'text-emerald-700';
    case 'Effective':
      return 'text-indigo-700';
    case 'Moderately Effective':
      return 'text-amber-700';
    case 'Less Effective':
      return 'text-red-700';
  }
}

function VariableCard({ variable }: { variable: VariableAssessment }) {
  const pct = Math.max(0, Math.min(100, (variable.averageScore / 5) * 100));

  const dimensions = [
    { name: 'Interaction', data: variable.interaction },
    { name: 'Participation', data: variable.participation },
    { name: 'Sharing', data: variable.sharing },
  ];

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-display text-sm font-semibold text-slate-900">{variable.label}</h4>
            <p className={`text-xs font-semibold mt-0.5 ${getEffectivenessTextClass(variable.effectivenessLevel)}`}>
              {variable.effectivenessLevel}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="font-mono text-base font-bold tabular-nums text-slate-900">
              {variable.averageScore.toFixed(2)}
              <span className="text-xs font-normal text-slate-400">/5</span>
            </span>
          </div>
        </div>

        <p className="mt-1.5 text-[11px] text-slate-400 tabular-nums">
          Survey Mean {variable.surveyMean.toFixed(2)} · r = {variable.correlationLabel}
        </p>

        <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
        </div>

        <p className="mt-3 text-xs text-slate-500 leading-relaxed">
          {variable.effectivenessInterpretation}
        </p>

        {/* 3 Engagement Dimension Breakdowns (2-5) */}
        <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
          {dimensions.map((dim) => (
            <div key={dim.name}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-800">{dim.name}</span>
                <span className="font-mono font-semibold tabular-nums text-teal-700">
                  {dim.data.score} / 5
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-600 leading-relaxed">{dim.data.rationale}</p>
            </div>
          ))}
        </div>
      </div>

      {variable.observedCues && variable.observedCues.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Observed Video Cues</p>
          <ul className="space-y-1">
            {variable.observedCues.map((cue, idx) => (
              <li key={idx} className="text-xs text-slate-600 flex items-start gap-1.5">
                <span className="text-slate-400 select-none" aria-hidden="true">
                  ·
                </span>
                <span>{cue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
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
      <section
        aria-label="4x3 Scoring and Computation Matrix"
        className="bg-white border border-slate-200 rounded-xl p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Reels Content × Brand Engagement Matrix
          </h3>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            Formula: (Interaction + Participation + Sharing) ÷ 3 · Scale 2–5
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                <th className="py-2.5 pr-4">Reels Marketing Content Variable</th>
                <th className="py-2.5 px-3 text-right">Interaction</th>
                <th className="py-2.5 px-3 text-right">Participation</th>
                <th className="py-2.5 px-3 text-right">Sharing</th>
                <th className="py-2.5 px-3 text-right">Average</th>
                <th className="py-2.5 pl-4">Effectiveness Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {variableList.map((v) => (
                <tr key={v.key} className="hover:bg-slate-50/70">
                  <td className="py-3 pr-4">
                    <span className="font-medium text-slate-900">{v.label}</span>
                    <span className="ml-2 text-xs text-slate-400 tabular-nums">
                      (Mean {v.surveyMean.toFixed(2)})
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                    {v.interaction.score}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                    {v.participation.score}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                    {v.sharing.score}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums text-indigo-700">
                    {v.averageScore.toFixed(2)}
                  </td>
                  <td className={`py-3 pl-4 text-xs font-semibold ${getEffectivenessTextClass(v.effectivenessLevel)}`}>
                    {v.effectivenessLevel}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/60 text-sm font-semibold">
                <td className="py-3 pr-4 text-slate-900">Total / Dimension Means</td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-teal-700">
                  {brandEngagementSummary.interactionMean.toFixed(2)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-teal-700">
                  {brandEngagementSummary.participationMean.toFixed(2)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-teal-700">
                  {brandEngagementSummary.sharingMean.toFixed(2)}
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900">
                  {overallScore.toFixed(2)} / 20
                </td>
                <td className={`py-3 pl-4 text-xs font-semibold ${getEffectivenessTextClass(scoreTier.level)}`}>
                  {scoreTier.level}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Individual Variable Detail Cards */}
      <section aria-label="Reels Marketing Content Variable Details">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="font-display text-lg font-bold text-slate-900">
            Variable-by-Variable Assessment
          </h3>
          <span className="font-mono text-xs font-medium text-slate-500 tabular-nums">
            4 Variables · 2.00–5.00 Each · {overallScore.toFixed(2)} / 20.00 Total
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {variableList.map((v) => (
            <VariableCard key={v.key} variable={v} />
          ))}
        </div>
      </section>
    </div>
  );
}
