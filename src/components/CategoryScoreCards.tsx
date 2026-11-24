import type { CategoryScoreDetail, ReelEvaluation } from '../types/evaluation.ts';

interface CategoryScoreCardsProps {
  evaluation: ReelEvaluation;
}

interface VariableCardConfig {
  title: string;
  subtitle: string;
  detail: CategoryScoreDetail;
  accentBarClass: string;
}

function ScoreCard({ title, subtitle, detail, accentBarClass }: VariableCardConfig) {
  const pct = Math.max(0, Math.min(100, (detail.score / 5) * 100));

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-display text-sm font-semibold text-slate-900">{title}</h4>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          <span className="font-mono text-base font-bold tabular-nums text-slate-900 shrink-0">
            {detail.score.toFixed(1)}
            <span className="text-xs font-normal text-slate-400">/5</span>
          </span>
        </div>

        <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full ${accentBarClass}`} style={{ width: `${pct}%` }} />
        </div>

        <p className="mt-3.5 text-sm text-slate-600 leading-relaxed">{detail.rationale}</p>
      </div>

      {detail.observedCues && detail.observedCues.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-[11px] font-semibold text-slate-500 mb-1.5">Observed Video Cues</p>
          <ul className="space-y-1">
            {detail.observedCues.map((cue, idx) => (
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
  const { reelsMarketingScores, brandEngagementScores } = evaluation;

  const reelsVariables: VariableCardConfig[] = [
    {
      title: 'Related Content',
      subtitle: 'Audience & brand context fit',
      detail: reelsMarketingScores.relatedContent,
      accentBarClass: 'bg-indigo-600',
    },
    {
      title: 'Entertainment Content',
      subtitle: 'Hook strength, pacing & visual pull',
      detail: reelsMarketingScores.entertainmentContent,
      accentBarClass: 'bg-indigo-600',
    },
    {
      title: 'Informational',
      subtitle: 'Value clarity & practical takeaways',
      detail: reelsMarketingScores.informational,
      accentBarClass: 'bg-indigo-600',
    },
    {
      title: 'Trendiness',
      subtitle: 'Format, audio & cultural alignment',
      detail: reelsMarketingScores.trendiness,
      accentBarClass: 'bg-indigo-600',
    },
  ];

  const engagementVariables: VariableCardConfig[] = [
    {
      title: 'Interaction',
      subtitle: 'Likes, comments, saves & reply triggers',
      detail: brandEngagementScores.interaction,
      accentBarClass: 'bg-teal-600',
    },
    {
      title: 'Sharing',
      subtitle: 'DM send-to-friend & repost value',
      detail: brandEngagementScores.sharing,
      accentBarClass: 'bg-teal-600',
    },
    {
      title: 'Participation',
      subtitle: 'Remixes, UGC & CTA follow-through',
      detail: brandEngagementScores.participation,
      accentBarClass: 'bg-teal-600',
    },
  ];

  return (
    <div className="space-y-8">
      <section aria-label="Reels Marketing Content Scores">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="font-display text-lg font-bold text-slate-900">
            Characteristics of Reels Marketing Content
          </h3>
          <span className="font-mono text-xs font-medium text-slate-500 tabular-nums">
            4 Variables · 5 Points Each · {evaluation.overallScore} / 20 Total
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {reelsVariables.map((item) => (
            <ScoreCard key={item.title} {...item} />
          ))}
        </div>
      </section>

      <section aria-label="Brand Engagement Scores">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
          <h3 className="font-display text-lg font-bold text-slate-900">
            Characteristics of Brand Engagement
          </h3>
          <span className="font-mono text-xs font-medium text-slate-500 tabular-nums">
            3 Engagement Pillars · {evaluation.brandEngagementSummary.totalOutOf15} / 15 Index
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {engagementVariables.map((item) => (
            <ScoreCard key={item.title} {...item} />
          ))}
        </div>
      </section>
    </div>
  );
}
