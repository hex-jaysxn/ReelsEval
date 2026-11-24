import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Compass,
  Info,
  Users,
} from 'lucide-react';
import type { AudienceSegmentPrediction, ReelEvaluation } from '../types/evaluation.ts';
import { GlassPanel } from './ui/GlassPrimitives.tsx';
import {
  InteractiveTiltCard,
  RevealSection,
  ScaleMaskReveal,
  ScrollSectionBridge,
} from './ui/MotionPrimitives.tsx';

interface InsightsAndStrategyProps {
  evaluation: ReelEvaluation;
}

function getSentimentColor(sentiment: AudienceSegmentPrediction['predictedSentiment']): string {
  switch (sentiment) {
    case 'Highly Receptive':
      return 'text-emerald-300';
    case 'Moderately Receptive':
      return 'text-indigo-300';
    case 'Mixed':
      return 'text-amber-300';
    case 'Low Resonance':
      return 'text-red-300';
  }
}

function getPriorityStyle(priority: 'High' | 'Medium' | 'Low'): string {
  switch (priority) {
    case 'High':
      return 'text-red-300';
    case 'Medium':
      return 'text-amber-300';
    case 'Low':
      return 'text-slate-300';
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
      <ScrollSectionBridge accent="teal" className="pt-2">
        <div
          aria-label="Strengths and Areas for Improvement"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <ScaleMaskReveal inView>
            <InteractiveTiltCard>
              <GlassPanel className="p-6 h-full rv-card-hover">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
                  <h3 className="font-display text-base font-semibold text-white">Strengths</h3>
                </div>
                <ul className="space-y-3">
                  {strengths.map((item, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-slate-200 leading-relaxed pb-3 border-b border-white/8 last:border-b-0 last:pb-0"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </GlassPanel>
            </InteractiveTiltCard>
          </ScaleMaskReveal>

          <ScaleMaskReveal inView delay={0.08}>
            <InteractiveTiltCard>
              <GlassPanel className="p-6 h-full rv-card-hover">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
                  <h3 className="font-display text-base font-semibold text-white">
                    Areas for Improvement
                  </h3>
                </div>
                <ul className="space-y-3">
                  {areasForImprovement.map((item, idx) => (
                    <li
                      key={idx}
                      className="text-sm text-slate-200 leading-relaxed pb-3 border-b border-white/8 last:border-b-0 last:pb-0"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </GlassPanel>
            </InteractiveTiltCard>
          </ScaleMaskReveal>
        </div>
      </ScrollSectionBridge>

      {/* Development Recommendations */}
      <ScrollSectionBridge accent="indigo" className="pt-2">
        <RevealSection>
          <GlassPanel as="section" ariaLabel="Development Recommendations" className="p-6 rv-card-hover">
            <div className="flex items-center gap-2 mb-4">
              <ArrowUpRight className="h-4 w-4 text-indigo-400 shrink-0" aria-hidden="true" />
              <h3 className="font-display text-base font-semibold text-white">
                Development Recommendations
              </h3>
            </div>

            <div className="divide-y divide-white/8">
              {developmentRecommendations.map((rec, idx) => (
                <div key={idx} className="py-4 first:pt-1 last:pb-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs mb-1.5">
                    <span className={`font-semibold ${getPriorityStyle(rec.priority)}`}>
                      {rec.priority} Priority
                    </span>
                    <span className="text-slate-600" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-medium text-slate-200">{rec.targetVariable}</span>
                    <span className="text-slate-600" aria-hidden="true">
                      ·
                    </span>
                    <span className="font-medium text-teal-300">{rec.targetDimension}</span>
                    {rec.timestampHint && (
                      <>
                        <span className="text-slate-600" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono text-slate-400">{rec.timestampHint}</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm font-medium text-white leading-relaxed">
                    {rec.recommendation}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Expected Impact: <span className="text-slate-200">{rec.expectedImpact}</span>
                  </p>
                </div>
              ))}
            </div>
          </GlassPanel>
        </RevealSection>
      </ScrollSectionBridge>

      {/* Predicted Audience Response */}
      <ScrollSectionBridge accent="sky" className="pt-2">
        <RevealSection>
          <GlassPanel as="section" ariaLabel="Predicted Audience Response" className="p-6 rv-card-hover">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-indigo-400 shrink-0" aria-hidden="true" />
              <h3 className="font-display text-base font-semibold text-white">
                Predicted Audience Response
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {predictedAudienceResponse.map((aud, idx) => (
                <div
                  key={idx}
                  className="pt-4 border-t border-white/8 first:border-t-0 md:nth-2:border-t-0 md:first:pt-0 md:nth-2:pt-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="font-display text-sm font-semibold text-white">{aud.segment}</h4>
                    <span className={`text-xs font-semibold ${getSentimentColor(aud.predictedSentiment)}`}>
                      {aud.predictedSentiment}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">{aud.responseSummary}</p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Likely Action: <span className="font-medium text-slate-200">{aud.likelyAction}</span>
                  </p>
                </div>
              ))}
            </div>
          </GlassPanel>
        </RevealSection>
      </ScrollSectionBridge>

      {/* Marketing Strategy Recommendations */}
      <ScrollSectionBridge accent="teal" className="pt-2">
        <RevealSection>
          <GlassPanel as="section" ariaLabel="Marketing Strategy Recommendations" className="p-6 rv-card-hover">
            <div className="flex items-center gap-2 mb-4">
              <Compass className="h-4 w-4 text-indigo-400 shrink-0" aria-hidden="true" />
              <h3 className="font-display text-base font-semibold text-white">
                Marketing Strategy Recommendations
              </h3>
            </div>

            <div className="divide-y divide-white/8">
              {marketingStrategyRecommendations.map((item, idx) => (
                <div key={idx} className="py-4 first:pt-1 last:pb-1">
                  <p className="text-xs font-semibold text-indigo-300">{item.pillar}</p>
                  <p className="mt-1 text-sm font-medium text-white">{item.recommendation}</p>
                  <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">
                    {item.researchRationale}
                  </p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Next Step: <span className="font-medium text-slate-200">{item.executionStep}</span>
                  </p>
                </div>
              ))}
            </div>
          </GlassPanel>
        </RevealSection>
      </ScrollSectionBridge>

      {/* Page 24 Methodological Note */}
      <aside
        aria-label="Methodological Note"
        className="rounded-2xl border border-white/10 bg-slate-900/70 px-5 py-4 flex items-start gap-3 text-xs text-slate-300 leading-relaxed"
      >
        <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          <span className="font-semibold text-white">Important:</span> The rubric evaluates the
          content&apos;s demonstrated characteristics and its potential to encourage Interaction,
          Participation, and Sharing. The effectiveness levels are assessment classifications
          developed from the study&apos;s findings, not proof of causal effects on actual consumer
          behavior.
        </p>
      </aside>
    </div>
  );
}
