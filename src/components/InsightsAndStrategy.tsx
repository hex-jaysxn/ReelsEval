import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Compass,
  Info,
  Users,
} from 'lucide-react';
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
    areasForImprovement,
    developmentRecommendations,
    predictedAudienceResponse,
    marketingStrategyRecommendations,
  } = evaluation;

  return (
    <div className="space-y-8">
      {/* Strengths & Areas for Improvement */}
      <section
        aria-label="Strengths and Areas for Improvement"
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
            <h3 className="font-display text-base font-semibold text-slate-900">
              Areas for Improvement
            </h3>
          </div>
          <ul className="space-y-3">
            {areasForImprovement.map((item, idx) => (
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

      {/* Development Recommendations */}
      <section
        aria-label="Development Recommendations"
        className="bg-white border border-slate-200 rounded-xl p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <ArrowUpRight className="h-4 w-4 text-indigo-600 shrink-0" aria-hidden="true" />
          <h3 className="font-display text-base font-semibold text-slate-900">
            Development Recommendations
          </h3>
        </div>

        <div className="divide-y divide-slate-100">
          {developmentRecommendations.map((rec, idx) => (
            <div key={idx} className="py-4 first:pt-1 last:pb-1">
              <div className="flex flex-wrap items-center gap-2 text-xs mb-1.5">
                <span className={`font-semibold ${getPriorityStyle(rec.priority)}`}>
                  {rec.priority} Priority
                </span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="font-medium text-slate-700">{rec.targetVariable}</span>
                <span className="text-slate-300" aria-hidden="true">
                  ·
                </span>
                <span className="font-medium text-teal-700">{rec.targetDimension}</span>
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

      {/* Marketing Strategy Recommendations */}
      <section
        aria-label="Marketing Strategy Recommendations"
        className="bg-white border border-slate-200 rounded-xl p-6"
      >
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
      </section>

      {/* Page 24 Methodological Note */}
      <aside
        aria-label="Methodological Note"
        className="bg-slate-100/80 border border-slate-200 rounded-xl px-5 py-4 flex items-start gap-3 text-xs text-slate-600 leading-relaxed"
      >
        <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          <span className="font-semibold text-slate-800">Important:</span> The rubric evaluates the
          content&apos;s demonstrated characteristics and its potential to encourage Interaction,
          Participation, and Sharing. The effectiveness levels are assessment classifications
          developed from the study&apos;s findings, not proof of causal effects on actual consumer
          behavior.
        </p>
      </aside>
    </div>
  );
}
