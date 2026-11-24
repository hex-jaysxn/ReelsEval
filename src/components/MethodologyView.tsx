export function MethodologyView() {
  const reelsVariables = [
    {
      name: '01. Related Content (0–5 Points)',
      description:
        'Measures how closely the video’s subject matter, visual environment, and narrative fit the target audience’s lived interests and the brand’s positioning.',
      criteria: 'Audience relevance, contextual authenticity, niche resonance, and brand-message alignment.',
    },
    {
      name: '02. Entertainment Content (0–5 Points)',
      description:
        'Evaluates hook velocity within the first 1–3 seconds, pacing, storytelling arc, audio-visual rhythm, and watch-through retention appeal.',
      criteria: 'Opening hook strength, scene transitions, emotional/humor payoff, and pacing momentum.',
    },
    {
      name: '03. Informational (0–5 Points)',
      description:
        'Assesses whether the viewer walks away with a clear value proposition, product benefit, tutorial takeaway, or concrete insight.',
      criteria: 'Clarity of on-screen captions/voiceover, demonstrable product proof, and concise takeaway.',
    },
    {
      name: '04. Trendiness (0–5 Points)',
      description:
        'Tracks alignment with contemporary short-form visual grammar, cultural moments, audio cues, and native Reels/TikTok editing styles.',
      criteria: 'Format currency, pacing cadence, sound/caption conventions, and native platform feel.',
    },
  ];

  const engagementVariables = [
    {
      name: 'Interaction (0–5)',
      description:
        'Predicts propensity to generate likes, comments, saves, and direct replies via questions, hot takes, or relatable pain points.',
    },
    {
      name: 'Sharing (0–5)',
      description:
        'Measures DM send-to-friend value, social currency, and utility worth reposting to Stories or team channels.',
    },
    {
      name: 'Participation (0–5)',
      description:
        'Evaluates remix/duet prompts, user-generated challenge hooks, and clear call-to-action follow-through.',
    },
  ];

  return (
    <section aria-label="Scoring Methodology and Rubric" className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8">
        <h1 className="font-display text-xl font-bold text-slate-900">
          Reels Marketing & Brand Engagement Framework
        </h1>
        <p className="mt-2 text-sm text-slate-600 max-w-3xl leading-relaxed">
          ReelsEvaluator pairs four 5-point Reels Marketing Content dimensions (20-point overall score) with three Brand Engagement pillars to diagnose both creative execution and predicted audience behavior.
        </p>

        <div className="mt-8">
          <h2 className="font-display text-base font-semibold text-slate-900 mb-4">
            Characteristics of Reels Marketing Content (20 Points Total)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {reelsVariables.map((item) => (
              <div key={item.name} className="border border-slate-200 rounded-xl p-5">
                <h3 className="font-display text-sm font-semibold text-indigo-700">{item.name}</h3>
                <p className="mt-2 text-sm text-slate-700 leading-relaxed">{item.description}</p>
                <p className="mt-2.5 text-xs text-slate-500">
                  Evaluated Cues: <span className="text-slate-700">{item.criteria}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200">
          <h2 className="font-display text-base font-semibold text-slate-900 mb-4">
            Characteristics of Brand Engagement (15-Point Behavioral Index)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {engagementVariables.map((item) => (
              <div key={item.name} className="border border-slate-200 rounded-xl p-5">
                <h3 className="font-display text-sm font-semibold text-teal-700">{item.name}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200">
          <h2 className="font-display text-base font-semibold text-slate-900 mb-2">
            Google Gemini Free Tier Optimization
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
            All evaluations run server-side using the Gemini Free Tier multimodal model (<span className="font-mono text-xs text-slate-800">gemini-4-hydrogen</span>) with structured JSON schema enforcement. Videos up to 14 MB are transmitted directly as inline media to minimize round-trips; videos between 14 MB and 45 MB use the Gemini Files API with automatic post-evaluation cleanup.
          </p>
        </div>
      </div>
    </section>
  );
}
