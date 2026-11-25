import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Check, Loader2 } from 'lucide-react';
import { ElevatedGlassPanel, ProgressBar, SkeletonCard } from './ui/GlassPrimitives.tsx';
import { RV_SPRING } from './ui/MotionPrimitives.tsx';

interface ProcessingStateProps {
  fileName: string;
}

const STEPS = [
  'Uploading video stream to ReeView evaluation server',
  'Inspecting visual frames, audio pacing, and on-screen cues via Gemini',
  'Scoring 4×3 Content & Engagement matrix (Interaction, Participation, Sharing)',
  'Calculating 8.00–20.00 effectiveness score & development recommendations',
];

export function ProcessingState({ fileName }: ProcessingStateProps) {
  const [activeStep, setActiveStep] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 2600);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 rv-animate-in">
      <ElevatedGlassPanel
        as="section"
        ariaLabel="Analyzing video"
        className="p-6 lg:p-8"
      >
        <div aria-live="polite" className="max-w-2xl space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-cyan-400 animate-spin shrink-0" aria-hidden="true" />
              <h2 className="font-display text-lg font-semibold text-white">
                Running Multimodal Video Analysis
              </h2>
            </div>
            <span className="font-mono text-xs text-cyan-300 tabular-nums">
              Step {activeStep + 1} / {STEPS.length}
            </span>
          </div>

          <p className="text-sm text-slate-200">
            Evaluating <span className="font-medium text-white">{fileName}</span> with Google Gemini Free Tier. Larger clips may take 15–30 seconds.
          </p>

          <ProgressBar
            value={activeStep + 1}
            max={STEPS.length}
            colorClass="bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-400"
            label="Analysis progress"
          />

          <ol className="pt-2 space-y-3">
            {STEPS.map((label, idx) => {
              const done = idx < activeStep;
              const current = idx === activeStep;
              return (
                <li key={label} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-mono shrink-0 transition-colors duration-200 ${
                      done
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/45'
                        : current
                          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50'
                          : 'bg-[#090e30] text-slate-300 border border-sky-400/20'
                    }`}
                  >
                    {done ? (
                      <motion.span
                        initial={reduced ? { scale: 1 } : { scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={reduced ? { duration: 0.01 } : RV_SPRING}
                        className="inline-flex"
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      </motion.span>
                    ) : (
                      <span className={current && !reduced ? 'animate-pulse' : ''}>{idx + 1}</span>
                    )}
                  </span>
                  <span
                    className={`transition-colors duration-200 ${
                      done
                        ? 'text-slate-300'
                        : current
                          ? 'font-medium text-white'
                          : 'text-slate-400'
                    }`}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </ElevatedGlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-hidden="true">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
    </div>
  );
}
