import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

interface ProcessingStateProps {
  fileName: string;
}

const STEPS = [
  'Uploading video stream to evaluation server',
  'Inspecting visual frames, audio pacing, and on-screen cues via Gemini',
  'Scoring 4 Reels Marketing Content & 3 Brand Engagement variables',
  'Generating audience predictions & research recommendations',
];

export function ProcessingState({ fileName }: ProcessingStateProps) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 2600);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <section
      aria-live="polite"
      aria-label="Analyzing video"
      className="bg-white border border-slate-200 rounded-xl p-6 lg:p-8"
    >
      <div className="max-w-2xl">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-indigo-600 animate-spin shrink-0" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Running Multimodal Video Analysis
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-slate-500">
          Evaluating <span className="font-medium text-slate-700">{fileName}</span> with Google Gemini Free Tier. Larger clips may take 15–30 seconds.
        </p>

        <ol className="mt-6 space-y-3">
          {STEPS.map((label, idx) => {
            const done = idx < activeStep;
            const current = idx === activeStep;
            return (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-mono shrink-0 ${
                    done
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : current
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'bg-slate-50 text-slate-400 border border-slate-200'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : idx + 1}
                </span>
                <span
                  className={
                    done
                      ? 'text-slate-500'
                      : current
                        ? 'font-medium text-slate-900'
                        : 'text-slate-400'
                  }
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
