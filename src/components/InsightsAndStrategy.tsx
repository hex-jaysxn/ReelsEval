import { AlertTriangle, ArrowUpRight, CheckCircle2, Compass, Lightbulb, Users } from 'lucide-react';
import type { AudienceSegmentPrediction, ReelEvaluation } from '../types/evaluation.ts';

interface InsightsAndStrategyProps {
  evaluation: ReelEvaluation;
}

function getSentimentColor(sentiment: AudienceSegmentPrediction['predictedSentiment']): string {
  switch (sentiment) {
    case 'Highly Receptive':
      return 'text-emerald-700';
    case 'Moderately Receptive':
      return 'text-indigo-700';
    case 'Mixed':
      return 'text-amber-700';
    case 'Low Resonance':
      return 'text-red-700';
  }
}

function getPriorityStyle(priority: 'High' | 'Medium' | 'Low'): string {
  switch (priority) {
    case 'High':
      return 'text-red-700';
    case 'Medium':
      return 'text-amber-700';
    case 'Low':
      return 'text-slate-600';
  }
}

export function InsightsAndStrategy({ evaluation }: InsightsAndStrategyProps) {
  const {
    strengths,
    weaknesses,
    improvementRecommendations,
    predictedAudienceResponse,
    marketingStrategyRecommendations,
    researchRecommendations,
  } = evaluation;

  return (
    <div className="space-y-8">
      {/* Strengths & Weaknesses */}
      <section
        aria-label="Strengths and Weaknesses"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-slate-900">Strengths</h3>
          </div>
          <ul className="space-y-3">
            {strengths.map((item, idx) => (
              <li
                key={idx}
                className="text-sm text-slate-700 leading-relaxed pb-3 border-b border-slate-100 last:border-b-0 last:pb-0"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-slate-900">Weaknesses</h3>
          </div>
          <ul className="space-y-3">
            {weaknesses.map((item, idx) => (
              <li
                key={idx}
                className="text-sm text-slate-700 leading-relaxed pb-3 border-b border-slate-100 last:border-b-0 last:pb-0"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Specific Improvement Recommendations */}
      <section
        aria-label="Specific Improvement Recommendations"
        className="bg-white border border-slate-200 rounded-xl p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <ArrowUpRight className="h-4 w-4 text-indigo-600 shrink-0" aria-hidden="true" />
          <h3 className="font-display text-base font-semibold text-slate-900">
            Specific Improvement Recommendations
          </h3>
        </div>

        <div className="divide-y divide-slate-100">
          {improvementRecommendations.map((rec, idx) => (
            <div key={idx} className="py-4 first:pt-1 last:pb-1">
              <div className="flex flex-wrap items-center gap-2 text-xs mb-1.5">
                <span className={`font-semibold ${getPriorityStyle(rec.priority)}`}>
                  {rec.priority} Priority
                </span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="font-medium text-slate-700">{rec.targetVariable}</span>
                {rec.timestampHint && (
                  <>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-mono text-slate-500">{rec.timestampHint}</span>
                  </>
                )}
              </div>
              <p className="text-sm font-medium text-slate-900 leading-relaxed">
                {rec.recommendation}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Expected Impact: <span className="text-slate-700">{rec.expectedImpact}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Predicted Audience Response */}
      <section
        aria-label="Predicted Audience Response"
        className="bg-white border border-slate-200 rounded-xl p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-indigo-600 shrink-0" aria-hidden="true" />
          <h3 className="font-display text-base font-semibold text-slate-900">
            Predicted Audience Response
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {predictedAudienceResponse.map((aud, idx) => (
            <div
              key={idx}
              className="pt-4 border-t border-slate-100 first:border-t-0 md:nth-2:border-t-0 md:first:pt-0 md:nth-2:pt-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="font-display text-sm font-semibold text-slate-900">{aud.segment}</h4>
                <span className={`text-xs font-semibold ${getSentimentColor(aud.predictedSentiment)}`}>
                  {aud.predictedSentiment}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{aud.responseSummary}</p>
              <p className="mt-1.5 text-xs text-slate-500">
                Likely Action: <span className="font-medium text-slate-700">{aud.likelyAction}</span>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Marketing Strategy & Research Recommendations */}
      <section
        aria-label="Marketing Strategy and Research Recommendations"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Compass className="h-4 w-4 text-indigo-600 shrink-0" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-slate-900">
              Marketing Strategy Recommendations
            </h3>
          </div>

          <div className="divide-y divide-slate-100">
            {marketingStrategyRecommendations.map((item, idx) => (
              <div key={idx} className="py-4 first:pt-1 last:pb-1">
                <p className="text-xs font-semibold text-indigo-700">{item.pillar}</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{item.recommendation}</p>
                <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                  {item.researchRationale}
                </p>
                <p className="mt-1.5 text-xs text-slate-500">
                  Next Step: <span className="font-medium text-slate-800">{item.executionStep}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-4 w-4 text-indigo-600 shrink-0" aria-hidden="true" />
            <h3 className="font-display text-base font-semibold text-slate-900">
              Research Recommendations
            </h3>
          </div>
          <ul className="space-y-3.5">
            {researchRecommendations.map((rec, idx) => (
              <li
                key={idx}
                className="text-sm text-slate-700 leading-relaxed pb-3.5 border-b border-slate-100 last:border-b-0 last:pb-0"
              >
                <span className="font-mono text-xs font-semibold text-indigo-600 mr-2">
                  0{idx + 1}.
                </span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
