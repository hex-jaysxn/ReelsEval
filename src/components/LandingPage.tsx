import { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Film,
  Layers,
  Lock,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { motion, useMotionValueEvent, useScroll } from 'motion/react';
import type { AppRoute } from '../utils/appRoute.ts';
import {
  ActionButton,
  ElevatedGlassPanel,
  GlassPanel,
  ReeViewMark,
  StatusBadge,
} from './ui/GlassPrimitives.tsx';
import {
  AnimatedNumber,
  BlurRevealText,
  ClipRevealHeading,
  InteractiveTiltCard,
  ParallaxOffset,
  RevealSection,
  RV_EASE,
  ScaleMaskReveal,
  ScrollDepthBackdrop,
  ScrollProgressBar,
  ScrollSectionBridge,
  StaggerGroup,
  StaggerItem,
  useMotionProfile,
} from './ui/MotionPrimitives.tsx';

interface LandingPageProps {
  onNavigateAuth: (mode: 'login' | 'register') => void;
  onNavigateRoute: (route: AppRoute) => void;
}

const PREVIEW_VARIABLES = [
  { label: 'Informational Content', score: 4.0, mean: '3.40', r: '0.372', pct: 80 },
  { label: 'Entertainment Content', score: 4.33, mean: '3.19', r: '0.463', pct: 86.6 },
  { label: 'Trendiness', score: 3.67, mean: '3.43', r: '0.306', pct: 73.4 },
  { label: 'Relatable Content', score: 4.33, mean: '3.31', r: '0.554', pct: 86.6 },
];

const RUBRIC_ROWS = [
  { name: 'A. Informational Content', mean: '3.40', corr: '0.372 (Weak)', corrClass: 'text-slate-300' },
  { name: 'B. Entertainment Content', mean: '3.19', corr: '0.463 (Moderate)', corrClass: 'text-indigo-300' },
  { name: 'C. Trendiness', mean: '3.43', corr: '0.306 (Weak)', corrClass: 'text-slate-300' },
  { name: 'D. Relatable Content', mean: '3.31', corr: '0.554 (Moderate)', corrClass: 'text-teal-300' },
];

export function LandingPage({ onNavigateAuth, onNavigateRoute }: LandingPageProps) {
  const profile = useMotionProfile();
  const isReduced = profile.tier === 'reduced';
  const { scrollY } = useScroll();
  const [navScrolled, setNavScrolled] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const next = latest > 24;
    if (next !== navScrolled) {
      setNavScrolled(next);
    }
  });

  const previewRadius = 56;
  const previewCircumference = 2 * Math.PI * previewRadius;
  const previewTargetOffset = previewCircumference * (1 - 16.33 / 20);

  return (
    <div className="min-h-screen rv-atmosphere text-slate-100 flex flex-col">
      <ScrollProgressBar />
      <ScrollDepthBackdrop />

      {/* Choreographed Top Navigation Bar (morphs cleanly on scroll) */}
      <motion.header
        initial={isReduced ? { opacity: 1 } : { opacity: 0, y: -12 * profile.distanceScale }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: isReduced ? 0.01 : 0.36 * profile.durationScale,
          delay: isReduced ? 0 : 0.06,
          ease: RV_EASE,
        }}
        className={`sticky top-0 z-30 rv-glass-nav border-b ${
          navScrolled ? 'rv-glass-nav-scrolled' : ''
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <a
            href="#top"
            className="group flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg"
          >
            <ReeViewMark />
            <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
              ReeView
            </span>
          </a>

          <nav aria-label="Landing navigation" className="hidden md:flex items-center gap-7 text-sm text-slate-300">
            <a href="#workflow" className="hover:text-white transition-colors rv-link-underline whitespace-nowrap">
              Workflow
            </a>
            <a href="#rubric" className="hover:text-white transition-colors rv-link-underline whitespace-nowrap">
              4×3 Rubric
            </a>
            <a href="#analytics" className="hover:text-white transition-colors rv-link-underline whitespace-nowrap">
              Analytics
            </a>
            <a href="#auth-security" className="hover:text-white transition-colors rv-link-underline whitespace-nowrap">
              Authentication
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <ActionButton
              variant="ghost"
              size="sm"
              onClick={() => onNavigateAuth('login')}
            >
              Sign In
            </ActionButton>
            <ActionButton
              variant="primary"
              size="sm"
              onClick={() => onNavigateAuth('register')}
            >
              <span>Get Started</span>
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </ActionButton>
          </div>
        </div>
      </motion.header>

      <main id="top" className="flex-1">
        {/* Hero Section: Background -> Nav -> Visual & Eyebrow -> Heading -> Text -> CTAs -> Metrics */}
        <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-12 pb-14 lg:pt-16 lg:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <motion.div
                initial={isReduced ? { opacity: 1 } : { opacity: 0, y: 10 * profile.distanceScale, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: isReduced ? 0.01 : 0.36 * profile.durationScale,
                  delay: isReduced ? 0 : 0.12,
                  ease: RV_EASE,
                }}
              >
                <div className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400 shrink-0" aria-hidden="true" />
                  <span>ReeView Multimodal Reels Evaluation Platform</span>
                </div>
              </motion.div>

              <ClipRevealHeading delay={0.18}>
                <h1 className="font-display text-[clamp(2.25rem,4vw,3.5rem)] font-bold tracking-tight text-white leading-[1.08] text-balance">
                  Evaluate short-form Reels against empirical brand engagement criteria.
                </h1>
              </ClipRevealHeading>

              <BlurRevealText delay={0.28}>
                <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                  ReeView analyzes your vertical video frames, pacing, and messaging with Google Gemini
                  to score Informational, Entertainment, Trendiness, and Relatable performance across
                  Interaction, Participation, and Sharing.
                </p>
              </BlurRevealText>

              <motion.div
                initial={isReduced ? { opacity: 1 } : { opacity: 0, y: 14 * profile.distanceScale }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: isReduced ? 0.01 : 0.42 * profile.durationScale,
                  delay: isReduced ? 0 : 0.38,
                  ease: RV_EASE,
                }}
                className="flex flex-wrap items-center gap-3.5 pt-2"
              >
                <ActionButton
                  variant="primary"
                  size="lg"
                  onClick={() => onNavigateAuth('register')}
                >
                  <span>Start Evaluating Reels</span>
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </ActionButton>
                <a
                  href="#rubric"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[46px] rounded-xl bg-slate-900/80 border border-slate-700/80 text-sm font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-500/80 hover:text-white hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] transition-all duration-180 ease-out whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  Explore 4×3 Rubric
                </a>
              </motion.div>

              <StaggerGroup
                delayChildren={0.44}
                staggerDelay={0.07}
                className="pt-4 border-t border-white/10 grid grid-cols-3 gap-4 max-w-lg"
              >
                <StaggerItem>
                  <p className="font-mono text-lg font-bold text-white tabular-nums">
                    <AnimatedNumber value={8} decimals={2} duration={0.55} />–
                    <AnimatedNumber value={20} decimals={2} duration={0.65} />
                  </p>
                  <p className="text-xs text-slate-400">Overall Score Range</p>
                </StaggerItem>
                <StaggerItem>
                  <p className="font-mono text-lg font-bold text-white tabular-nums">4 × 3</p>
                  <p className="text-xs text-slate-400">Content × Engagement Grid</p>
                </StaggerItem>
                <StaggerItem>
                  <p className="font-mono text-lg font-bold text-white tabular-nums">2–5</p>
                  <p className="text-xs text-slate-400">Integer Dimension Scale</p>
                </StaggerItem>
              </StaggerGroup>
            </div>

            {/* Product Preview Panel (Scale-Mask Reveal + Depth Parallax + 3D Tilt) */}
            <div className="lg:col-span-6">
              <ParallaxOffset offset={18}>
                <ScaleMaskReveal delay={0.14}>
                  <InteractiveTiltCard>
                    <ElevatedGlassPanel className="p-6 sm:p-7 space-y-6 rv-card-hover">
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                        <div>
                          <p className="text-xs font-medium text-slate-400">Sample Report Preview</p>
                          <p className="font-display text-sm font-semibold text-white">
                            commute-launch-reel.mp4 · Gen Z Consumers
                          </p>
                        </div>
                        <StatusBadge tone="moderate">Effective · 16.33 / 20</StatusBadge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                        {/* Compact Animated Score Ring Preview */}
                        <div className="sm:col-span-5 flex flex-col items-center justify-center py-2">
                          <div className="relative h-36 w-36 flex items-center justify-center">
                            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90" aria-hidden="true">
                              <circle
                                cx="70"
                                cy="70"
                                r={previewRadius}
                                fill="none"
                                stroke="rgba(148,163,184,0.18)"
                                strokeWidth="10"
                              />
                              <motion.circle
                                cx="70"
                                cy="70"
                                r={previewRadius}
                                fill="none"
                                stroke="#6366F1"
                                strokeWidth="10"
                                strokeLinecap="round"
                                strokeDasharray={previewCircumference}
                                initial={
                                  isReduced
                                    ? { strokeDashoffset: previewTargetOffset }
                                    : { strokeDashoffset: previewCircumference }
                                }
                                animate={{ strokeDashoffset: previewTargetOffset }}
                                transition={{
                                  duration: isReduced ? 0.01 : 0.9 * profile.durationScale,
                                  delay: isReduced ? 0 : 0.28,
                                  ease: RV_EASE,
                                }}
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                              <span className="font-mono text-2xl font-bold text-white tabular-nums">
                                <AnimatedNumber value={16.33} decimals={2} duration={0.8} />
                              </span>
                              <span className="font-mono text-[11px] text-slate-400">/ 20.00</span>
                            </div>
                          </div>
                          <p className="mt-2 text-xs font-medium text-indigo-300">
                            Section V Classification: Effective
                          </p>
                        </div>

                        {/* Variable Bars Preview */}
                        <div className="sm:col-span-7 space-y-3">
                          {PREVIEW_VARIABLES.map((v, idx) => (
                            <div key={v.label} className="space-y-1">
                              <div className="flex items-center justify-between text-xs gap-2">
                                <span className="font-medium text-slate-200 truncate">{v.label}</span>
                                <span className="font-mono font-semibold text-white tabular-nums shrink-0">
                                  {v.score.toFixed(2)} / 5
                                </span>
                              </div>
                              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                                <motion.div
                                  initial={isReduced ? { width: `${v.pct}%` } : { width: 0 }}
                                  animate={{ width: `${v.pct}%` }}
                                  transition={{
                                    duration: isReduced ? 0.01 : 0.7 * profile.durationScale,
                                    delay: isReduced ? 0 : 0.26 + idx * 0.08,
                                    ease: RV_EASE,
                                  }}
                                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400"
                                />
                              </div>
                              <p className="text-[11px] text-slate-400 tabular-nums">
                                Study Mean {v.mean} · r = {v.r}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/10 grid grid-cols-3 gap-3 text-center">
                        <div className="py-2 rounded-xl bg-slate-900/70 border border-white/8 transition-colors hover:border-teal-400/35">
                          <p className="text-[11px] text-slate-400">Interaction</p>
                          <p className="font-mono text-sm font-semibold text-teal-300 tabular-nums mt-0.5">
                            <AnimatedNumber value={4.5} decimals={2} duration={0.65} /> / 5
                          </p>
                        </div>
                        <div className="py-2 rounded-xl bg-slate-900/70 border border-white/8 transition-colors hover:border-teal-400/35">
                          <p className="text-[11px] text-slate-400">Participation</p>
                          <p className="font-mono text-sm font-semibold text-teal-300 tabular-nums mt-0.5">
                            <AnimatedNumber value={3.75} decimals={2} duration={0.7} /> / 5
                          </p>
                        </div>
                        <div className="py-2 rounded-xl bg-slate-900/70 border border-white/8 transition-colors hover:border-teal-400/35">
                          <p className="text-[11px] text-slate-400">Sharing</p>
                          <p className="font-mono text-sm font-semibold text-teal-300 tabular-nums mt-0.5">
                            <AnimatedNumber value={4.0} decimals={2} duration={0.75} /> / 5
                          </p>
                        </div>
                      </div>
                    </ElevatedGlassPanel>
                  </InteractiveTiltCard>
                </ScaleMaskReveal>
              </ParallaxOffset>
            </div>
          </div>
        </section>

        {/* Workflow Section: Scroll-Linked Bridge -> Heading Mask -> Supporting Blur-to-Sharp -> Staggered Tilt Cards */}
        <ScrollSectionBridge
          id="workflow"
          accent="indigo"
          className="max-w-7xl mx-auto px-4 sm:px-8 py-12 lg:py-16"
        >
          <div className="max-w-2xl mb-10 space-y-2.5">
            <ClipRevealHeading inView>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Three-stage Reel intelligence workflow
              </h2>
            </ClipRevealHeading>
            <BlurRevealText inView delay={0.08}>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Move directly from raw vertical MP4/MOV video files to deterministic scoring and
                audience strategy without manual spreadsheets.
              </p>
            </BlurRevealText>
          </div>

          <StaggerGroup inView className="grid grid-cols-1 md:grid-cols-3 gap-6" staggerDelay={0.055}>
            <StaggerItem>
              <InteractiveTiltCard>
                <GlassPanel className="p-6 space-y-3 h-full rv-card-hover">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 border border-indigo-400/25 text-indigo-300 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
                    <UploadCloud className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="font-mono text-xs text-indigo-300">01. Upload &amp; Context</p>
                  <h3 className="font-display text-lg font-semibold text-white">
                    Configure audience &amp; objective
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Drop MP4, WebM, or MOV creatives up to 45 MB, select your target persona and campaign
                    goal, and attach optional brand positioning notes.
                  </p>
                </GlassPanel>
              </InteractiveTiltCard>
            </StaggerItem>

            <StaggerItem>
              <InteractiveTiltCard>
                <GlassPanel className="p-6 space-y-3 h-full rv-card-hover">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 border border-sky-400/25 text-sky-300 transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3">
                    <Film className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="font-mono text-xs text-sky-300">02. AI Multimodal Analysis</p>
                  <h3 className="font-display text-lg font-semibold text-white">
                    Frame, audio &amp; cue inspection
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Server-side Google Gemini evaluation inspects visual storytelling, captions, audio
                    pacing, and call-to-action mechanics across all 12 rubric cells.
                  </p>
                </GlassPanel>
              </InteractiveTiltCard>
            </StaggerItem>

            <StaggerItem>
              <InteractiveTiltCard>
                <GlassPanel className="p-6 space-y-3 h-full rv-card-hover">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 border border-teal-400/25 text-teal-300 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
                    <BarChart3 className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <p className="font-mono text-xs text-teal-300">03. Insights &amp; Export</p>
                  <h3 className="font-display text-lg font-semibold text-white">
                    Actionable edits &amp; reports
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Review radar benchmarks, dimension means, prioritized development recommendations,
                    and export clean Markdown or JSON reports anytime.
                  </p>
                </GlassPanel>
              </InteractiveTiltCard>
            </StaggerItem>
          </StaggerGroup>
        </ScrollSectionBridge>

        {/* Empirical 4x3 Rubric Section: Scroll Bridge -> Editorial Mask + Checklist -> Parallax Benchmark Table */}
        <ScrollSectionBridge
          id="rubric"
          accent="sky"
          className="max-w-7xl mx-auto px-4 sm:px-8 py-12 lg:py-16"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-4">
              <ClipRevealHeading inView>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Grounded in the 4×3 Brand Engagement Rubric
                </h2>
              </ClipRevealHeading>
              <BlurRevealText inView delay={0.08}>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                  Every Reel is graded from 2 to 5 across Interaction, Participation, and Sharing for
                  each content variable. Variable averages sum directly into the 8.00–20.00 Overall
                  Effectiveness Score.
                </p>
              </BlurRevealText>
              <StaggerGroup inView staggerDelay={0.08} delayChildren={0.12} className="space-y-2.5 pt-2 text-sm text-slate-300">
                <StaggerItem xOffset={-10}>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Deterministic scoring bounds prevent score inflation or out-of-range outputs.</span>
                  </div>
                </StaggerItem>
                <StaggerItem xOffset={-10}>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Direct comparison against empirical study survey means and correlation weights.</span>
                  </div>
                </StaggerItem>
                <StaggerItem xOffset={-10}>
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>Includes full Section IV &amp; V threshold tables inside the workspace.</span>
                  </div>
                </StaggerItem>
              </StaggerGroup>
            </div>

            <div className="lg:col-span-7">
              <ParallaxOffset offset={12}>
                <ScaleMaskReveal inView delay={0.1}>
                  <InteractiveTiltCard>
                    <GlassPanel className="p-6 rv-card-hover">
                      <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-indigo-400 transition-transform duration-200 group-hover:rotate-6" aria-hidden="true" />
                          <h3 className="font-display text-base font-semibold text-white">
                            Study Benchmarks &amp; Engagement Correlations
                          </h3>
                        </div>
                        <span className="font-mono text-xs text-slate-400 tabular-nums">Scale 2.00–5.00</span>
                      </div>

                      <div className="overflow-x-auto mt-3">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-white/10 text-xs font-semibold text-slate-400">
                              <th className="py-2.5 pr-4">Content Variable</th>
                              <th className="py-2.5 px-3 text-right">Study Mean</th>
                              <th className="py-2.5 pl-4 text-right">Correlation (r)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/8">
                            {RUBRIC_ROWS.map((row) => (
                              <tr key={row.name} className="hover:bg-white/[0.04] transition-colors">
                                <td className="py-3 pr-4 font-medium text-white">{row.name}</td>
                                <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-200">
                                  {row.mean}
                                </td>
                                <td className={`py-3 pl-4 text-right font-mono tabular-nums ${row.corrClass}`}>
                                  {row.corr}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </GlassPanel>
                  </InteractiveTiltCard>
                </ScaleMaskReveal>
              </ParallaxOffset>
            </div>
          </div>
        </ScrollSectionBridge>

        {/* Analytics & Auth Section: Counter-Balanced Cards + Conversion Reveal */}
        <ScrollSectionBridge
          id="analytics"
          accent="teal"
          className="max-w-7xl mx-auto px-4 sm:px-8 py-12 lg:py-16"
        >
          <StaggerGroup inView id="auth-security" className="grid grid-cols-1 lg:grid-cols-2 gap-6" staggerDelay={0.06}>
            <StaggerItem xOffset={-14}>
              <InteractiveTiltCard>
                <GlassPanel className="p-7 space-y-4 h-full rv-card-hover">
                  <div className="flex items-center gap-2.5 text-indigo-300">
                    <BarChart3 className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Command Center</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">
                    Persistent evaluation archive &amp; comparison
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Every analyzed creative is saved to your ReeView workspace history. Filter previous
                    Reels by effectiveness tier, inspect historical cue breakdowns, and export Markdown
                    or JSON deliverables cleanly.
                  </p>
                </GlassPanel>
              </InteractiveTiltCard>
            </StaggerItem>

            <StaggerItem xOffset={14}>
              <InteractiveTiltCard>
                <GlassPanel className="p-7 space-y-4 h-full rv-card-hover">
                  <div className="flex items-center gap-2.5 text-teal-300">
                    <ShieldCheck className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Unified Authentication</span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-white">
                    Sign in with Google or Email
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    ReeView verifies Google OpenID Connect sessions server-side, safely links verified
                    emails across providers, and keeps all API secrets on the server.
                  </p>
                </GlassPanel>
              </InteractiveTiltCard>
            </StaggerItem>
          </StaggerGroup>

          {/* Final Conversion Panel */}
          <ScaleMaskReveal inView delay={0.08}>
            <InteractiveTiltCard>
              <ElevatedGlassPanel className="mt-10 p-8 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6 rv-card-hover">
                <div className="space-y-2 max-w-xl">
                  <div className="inline-flex items-center gap-2 text-xs font-medium text-indigo-300">
                    <Lock className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-6" aria-hidden="true" />
                    <span>Ready for your next campaign creative</span>
                  </div>
                  <h2 className="font-display text-2xl font-bold text-white">
                    Launch your ReeView evaluation workspace
                  </h2>
                  <p className="text-sm text-slate-300">
                    Create an account or continue with Google to evaluate your first Reel.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <ActionButton
                    variant="secondary"
                    size="lg"
                    onClick={() => onNavigateAuth('login')}
                  >
                    Sign In
                  </ActionButton>
                  <ActionButton
                    variant="primary"
                    size="lg"
                    onClick={() => onNavigateAuth('register')}
                  >
                    <span>Create Free Account</span>
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </ActionButton>
                </div>
              </ElevatedGlassPanel>
            </InteractiveTiltCard>
          </ScaleMaskReveal>
        </ScrollSectionBridge>
      </main>

      {/* Footer */}
      <RevealSection as="div" className="border-t border-white/8 bg-[#050811]/80">
        <footer>
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <div className="group flex items-center gap-2.5">
              <ReeViewMark size="sm" />
              <span className="font-display font-semibold text-white">ReeView</span>
              <span aria-hidden="true">·</span>
              <span>AI Reels Marketing Content Effectiveness Platform</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-5">
              <a href="#workflow" className="hover:text-slate-200 transition-colors rv-link-underline">Workflow</a>
              <a href="#rubric" className="hover:text-slate-200 transition-colors rv-link-underline">Rubric</a>
              <a
                href="/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigateRoute('privacy');
                }}
                className="hover:text-slate-200 transition-colors rv-link-underline"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigateRoute('terms');
                }}
                className="hover:text-slate-200 transition-colors rv-link-underline"
              >
                Terms of Service
              </a>
              <button
                type="button"
                onClick={() => onNavigateAuth('login')}
                className="hover:text-slate-200 transition-colors rv-link-underline cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </div>
        </footer>
      </RevealSection>
    </div>
  );
}
