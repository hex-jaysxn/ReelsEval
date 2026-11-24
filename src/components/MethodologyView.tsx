import { useState } from 'react';

type RubricVariableTab = 'informational' | 'entertainment' | 'trendiness' | 'relatable';

const RUBRIC_DATA: Record<
  RubricVariableTab,
  {
    title: string;
    surveyMean: string;
    correlation: string;
    rows: { rating: number; interaction: string; participation: string; sharing: string }[];
  }
> = {
  informational: {
    title: 'A. Informational Content',
    surveyMean: '3.40',
    correlation: '0.372 (Weak)',
    rows: [
      {
        rating: 5,
        interaction:
          'The Reel presents clear and useful product information that encourages viewers to react, comment, or ask questions.',
        participation:
          'The Reel provides understandable information that encourages viewers to participate in discussions or respond to product-related questions.',
        sharing:
          'The Reel presents valuable product details that viewers would want to save or share with others.',
      },
      {
        rating: 4,
        interaction:
          'The Reel provides relevant product information that encourages viewers to express their reactions.',
        participation:
          'The Reel explains the product sufficiently to encourage viewers to respond to its message or prompts.',
        sharing:
          'The Reel provides useful information that viewers may share with friends or save for future reference.',
      },
      {
        rating: 3,
        interaction:
          'The Reel provides basic product information but does little to encourage viewers to react or comment.',
        participation:
          'The Reel presents information but offers limited opportunities for viewers to participate.',
        sharing:
          'The Reel contains some useful details, but its information gives viewers little reason to share or save it.',
      },
      {
        rating: 2,
        interaction:
          'The Reel presents unclear or insufficient product information, resulting in little encouragement for viewer interaction.',
        participation:
          'The Reel provides confusing or incomplete information that makes viewer participation difficult.',
        sharing:
          'The Reel lacks useful product details that would motivate viewers to share or save the content.',
      },
    ],
  },
  entertainment: {
    title: 'B. Entertainment Content',
    surveyMean: '3.19',
    correlation: '0.463 (Moderate)',
    rows: [
      {
        rating: 5,
        interaction:
          "The Reel uses highly entertaining elements that capture viewers' attention and encourage them to like, comment, or react.",
        participation:
          'The Reel uses enjoyable and engaging activities that encourage viewers to join challenges or participate.',
        sharing:
          'The Reel provides an entertaining experience that makes viewers want to share it with friends or post it on their stories.',
      },
      {
        rating: 4,
        interaction:
          'The Reel uses enjoyable content that encourages viewers to express their reactions.',
        participation:
          'The Reel includes entertaining elements that invite viewers to participate in its activities or prompts.',
        sharing:
          'The Reel contains entertaining moments that viewers may want to share with others.',
      },
      {
        rating: 3,
        interaction:
          'The Reel has some entertaining elements but does not consistently encourage viewers to interact.',
        participation:
          'The Reel provides limited entertainment that generates little interest in participating.',
        sharing:
          'The Reel is somewhat enjoyable but does not strongly motivate viewers to share it.',
      },
      {
        rating: 2,
        interaction:
          'The Reel lacks entertaining elements that could encourage viewers to like, comment, or react.',
        participation:
          'The Reel is unengaging and provides little motivation for viewers to participate.',
        sharing:
          'The Reel offers little entertainment value, giving viewers minimal reason to share it with others.',
      },
    ],
  },
  trendiness: {
    title: 'C. Trendiness',
    surveyMean: '3.43',
    correlation: '0.306 (Weak)',
    rows: [
      {
        rating: 5,
        interaction:
          'The Reel effectively incorporates current social media trends in a way that encourages viewers to react, comment, or share their opinions.',
        participation:
          'The Reel adapts popular trends into interactive activities that encourage viewers to join or create their own content.',
        sharing:
          'The Reel uses relevant and popular trends that encourage viewers to share or repost the content with others.',
      },
      {
        rating: 4,
        interaction:
          'The Reel incorporates recognizable trends that encourage viewers to express their reactions.',
        participation:
          'The Reel includes trending elements that provide opportunities for viewers to participate.',
        sharing:
          'The Reel uses popular topics or formats that viewers may find worth sharing.',
      },
      {
        rating: 3,
        interaction:
          'The Reel includes trending elements but does not effectively use them to encourage interaction.',
        participation:
          'The Reel follows current trends but provides limited opportunities for viewer participation.',
        sharing:
          'The Reel uses familiar trends but does not create a strong reason for viewers to share the content.',
      },
      {
        rating: 2,
        interaction:
          'The Reel uses outdated or irrelevant trends that fail to encourage viewer reactions.',
        participation:
          'The Reel does not effectively incorporate trends that could motivate viewers to participate.',
        sharing:
          'The Reel lacks relevant trending elements that could encourage viewers to share or repost it.',
      },
    ],
  },
  relatable: {
    title: 'D. Relatable Content',
    surveyMean: '3.31',
    correlation: '0.554 (Moderate)',
    rows: [
      {
        rating: 5,
        interaction:
          'The Reel presents relatable situations and experiences that encourage viewers to comment, react, and share their personal opinions.',
        participation:
          'The Reel features experiences that viewers can identify with, encouraging them to participate by sharing their own stories or experiences.',
        sharing:
          'The Reel reflects the interests and everyday experiences of its target audience, making viewers want to share it with friends or peers.',
      },
      {
        rating: 4,
        interaction:
          'The Reel presents familiar situations that encourage viewers to express their reactions or opinions.',
        participation:
          'The Reel includes relatable experiences that encourage viewers to respond or participate in its activities.',
        sharing:
          'The Reel contains situations that viewers may relate to and consider sharing with others.',
      },
      {
        rating: 3,
        interaction:
          'The Reel contains some relatable elements but does not strongly encourage viewers to interact.',
        participation:
          'The Reel presents familiar situations but provides limited motivation for viewers to participate or share their experiences.',
        sharing:
          'The Reel has some relatable content but does not create a strong connection that encourages sharing.',
      },
      {
        rating: 2,
        interaction:
          'The Reel presents situations that are difficult for its target audience to relate to, resulting in little interaction.',
        participation:
          'The Reel lacks relatable experiences that could encourage viewers to participate.',
        sharing:
          'The Reel does not reflect the interests or experiences of its target audience, giving them little reason to share it.',
      },
    ],
  },
};

export function MethodologyView() {
  const [selectedVar, setSelectedVar] = useState<RubricVariableTab>('informational');
  const current = RUBRIC_DATA[selectedVar];

  return (
    <section aria-label="Scoring Methodology and Rubric" className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8 space-y-8">
        <div>
          <h1 className="font-display text-xl font-bold text-slate-900">
            Reels Marketing Content Effectiveness Assessment Rubric
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-3xl leading-relaxed">
            Each of the four Reels Marketing Content variables is scored from <span className="font-mono font-semibold text-slate-800">2</span> to <span className="font-mono font-semibold text-slate-800">5</span> across three Brand Engagement dimensions (<span className="font-medium text-slate-800">Interaction</span>, <span className="font-medium text-slate-800">Participation</span>, <span className="font-medium text-slate-800">Sharing</span>). Each variable&apos;s average is summed to form the <span className="font-mono font-semibold text-slate-800">8.00–20.00</span> Overall Effectiveness Score.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Scoring Guide: 5 – Very Effective · 4 – Effective · 3 – Moderately Effective · 2 – Less Effective
          </p>
        </div>

        {/* Section I-II: Interactive Rubric Matrix by Variable */}
        <div className="pt-6 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Criteria by Content Characteristic
            </h2>

            <div
              role="tablist"
              aria-label="Select Reels marketing content variable"
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start"
            >
              {(
                [
                  { id: 'informational', label: 'A. Informational' },
                  { id: 'entertainment', label: 'B. Entertainment' },
                  { id: 'trendiness', label: 'C. Trendiness' },
                  { id: 'relatable', label: 'D. Relatable' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedVar === tab.id}
                  onClick={() => setSelectedVar(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    selectedVar === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-baseline gap-3 text-xs text-slate-500">
            <span className="font-display text-sm font-semibold text-indigo-700">
              {current.title}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">Survey Mean: {current.surveyMean}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              Correlation with Overall Brand Engagement: {current.correlation}
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 w-20">Rating</th>
                  <th className="py-3 px-4">Interaction</th>
                  <th className="py-3 px-4">Participation</th>
                  <th className="py-3 px-4">Sharing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 leading-relaxed">
                {current.rows.map((row) => (
                  <tr key={row.rating}>
                    <td className="py-3.5 px-4 align-top font-mono font-bold text-slate-900 tabular-nums">
                      {row.rating}
                    </td>
                    <td className="py-3.5 px-4 align-top">{row.interaction}</td>
                    <td className="py-3.5 px-4 align-top">{row.participation}</td>
                    <td className="py-3.5 px-4 align-top">{row.sharing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section III: Scoring & Computation */}
        <div className="pt-6 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              III. Scoring & Computation Formulas
            </h2>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-medium text-slate-900">Variable Score:</span>{' '}
                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                  (Interaction + Participation + Sharing) ÷ 3
                </span>
              </p>
              <p>
                <span className="font-medium text-slate-900">Overall Score:</span>{' '}
                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                  Informational + Entertainment + Trendiness + Relatable
                </span>
              </p>
              <p className="text-xs text-slate-500 pt-1 tabular-nums">
                Maximum Score: 20.00 points · Minimum Score: 8.00 points
              </p>
            </div>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900 mb-2">
              Example Scoring Matrix (16.33 / 20 — Effective)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <th className="py-2 px-3">Variable</th>
                    <th className="py-2 px-2 text-right">Int</th>
                    <th className="py-2 px-2 text-right">Part</th>
                    <th className="py-2 px-2 text-right">Shar</th>
                    <th className="py-2 px-3 text-right">Average</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums font-mono">
                  <tr>
                    <td className="py-2 px-3 font-sans font-medium text-slate-800">Informational</td>
                    <td className="py-2 px-2 text-right">4</td>
                    <td className="py-2 px-2 text-right">4</td>
                    <td className="py-2 px-2 text-right">4</td>
                    <td className="py-2 px-3 text-right font-semibold">4.00</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans font-medium text-slate-800">Entertainment</td>
                    <td className="py-2 px-2 text-right">5</td>
                    <td className="py-2 px-2 text-right">4</td>
                    <td className="py-2 px-2 text-right">4</td>
                    <td className="py-2 px-3 text-right font-semibold">4.33</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans font-medium text-slate-800">Trendiness</td>
                    <td className="py-2 px-2 text-right">4</td>
                    <td className="py-2 px-2 text-right">3</td>
                    <td className="py-2 px-2 text-right">4</td>
                    <td className="py-2 px-3 text-right font-semibold">3.67</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans font-medium text-slate-800">Relatable</td>
                    <td className="py-2 px-2 text-right">5</td>
                    <td className="py-2 px-2 text-right">4</td>
                    <td className="py-2 px-2 text-right">4</td>
                    <td className="py-2 px-3 text-right font-semibold">4.33</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 font-mono font-semibold">
                    <td colSpan={4} className="py-2 px-3 font-sans text-slate-900">
                      Total
                    </td>
                    <td className="py-2 px-3 text-right text-indigo-700">16.33 / 20</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Sections IV & V: Interpretation Tables */}
        <div className="pt-6 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 mb-3">
              IV. Per-Variable Effectiveness Levels
            </h2>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <th className="py-2.5 px-3">Average</th>
                    <th className="py-2.5 px-3">Level</th>
                    <th className="py-2.5 px-3">Interpretation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">4.25–5.00</td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-700 whitespace-nowrap">Very Effective</td>
                    <td className="py-2.5 px-3">Highly effective in encouraging brand engagement.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">3.50–4.24</td>
                    <td className="py-2.5 px-3 font-semibold text-indigo-700 whitespace-nowrap">Effective</td>
                    <td className="py-2.5 px-3">Effective in encouraging brand engagement.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">2.75–3.49</td>
                    <td className="py-2.5 px-3 font-semibold text-amber-700 whitespace-nowrap">Moderately Effective</td>
                    <td className="py-2.5 px-3">Moderate effectiveness; needs improvement.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">2.00–2.74</td>
                    <td className="py-2.5 px-3 font-semibold text-red-700 whitespace-nowrap">Less Effective</td>
                    <td className="py-2.5 px-3">Limited effectiveness in encouraging engagement.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 mb-3">
              V. Overall Reels Effectiveness Levels
            </h2>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <th className="py-2.5 px-3">Total Score</th>
                    <th className="py-2.5 px-3">Level</th>
                    <th className="py-2.5 px-3">Interpretation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">17.00–20.00</td>
                    <td className="py-2.5 px-3 font-semibold text-emerald-700 whitespace-nowrap">Very Effective</td>
                    <td className="py-2.5 px-3">Effectively incorporates all four characteristics.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">14.00–16.99</td>
                    <td className="py-2.5 px-3 font-semibold text-indigo-700 whitespace-nowrap">Effective</td>
                    <td className="py-2.5 px-3">Good effectiveness across content characteristics.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">11.00–13.99</td>
                    <td className="py-2.5 px-3 font-semibold text-amber-700 whitespace-nowrap">Moderately Effective</td>
                    <td className="py-2.5 px-3">Requires improvement in some characteristics.</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono tabular-nums whitespace-nowrap">8.00–10.99</td>
                    <td className="py-2.5 px-3 font-semibold text-red-700 whitespace-nowrap">Less Effective</td>
                    <td className="py-2.5 px-3">Requires significant content improvement.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200 text-xs text-slate-600 leading-relaxed">
          <p>
            <span className="font-semibold text-slate-800">Methodological Note:</span> The rubric
            evaluates the content&apos;s demonstrated characteristics and its potential to encourage
            Interaction, Participation, and Sharing. The effectiveness levels are assessment
            classifications developed from the study&apos;s findings, not proof of causal effects on
            actual consumer behavior.
          </p>
        </div>
      </div>
    </section>
  );
}
