import { useState } from 'react';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import { motion, useMotionValueEvent, useScroll } from 'motion/react';
import type { AppRoute } from '../utils/appRoute.ts';
import { ActionButton, GlassPanel, ReeViewMark } from './ui/GlassPrimitives.tsx';
import {
  BlurRevealText,
  ClipRevealHeading,
  RevealSection,
  RV_EASE,
  ScaleMaskReveal,
  ScrollDepthBackdrop,
  ScrollProgressBar,
  useMotionProfile,
} from './ui/MotionPrimitives.tsx';

interface LegalPageProps {
  page: 'privacy' | 'terms';
  onNavigateRoute: (route: AppRoute) => void;
  onNavigateAuth: (mode: 'login' | 'register') => void;
}

const EFFECTIVE_DATE = 'November 24, 2026';

export function LegalPage({
  page,
  onNavigateRoute,
  onNavigateAuth,
}: LegalPageProps) {
  const isPrivacy = page === 'privacy';
  const profile = useMotionProfile();
  const isReduced = profile.tier === 'reduced';
  const { scrollY } = useScroll();
  const [navScrolled, setNavScrolled] = useState(false);

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const next = latest > 20;
    if (next !== navScrolled) {
      setNavScrolled(next);
    }
  });

  return (
    <div className="min-h-screen rv-atmosphere text-slate-100 flex flex-col">
      <ScrollProgressBar />
      <ScrollDepthBackdrop />

      <motion.header
        initial={isReduced ? { opacity: 1 } : { opacity: 0, y: -10 * profile.distanceScale }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: isReduced ? 0.01 : 0.32 * profile.durationScale, ease: RV_EASE }}
        className={`sticky top-0 z-30 rv-glass-nav border-b ${
          navScrolled ? 'rv-glass-nav-scrolled' : ''
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                onNavigateRoute('main');
              }}
              className="group flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded-lg"
            >
              <ReeViewMark />
              <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap">
                ReeView
              </span>
            </a>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <a
              href={isPrivacy ? '/terms' : '/privacy'}
              onClick={(e) => {
                e.preventDefault();
                onNavigateRoute(isPrivacy ? 'terms' : 'privacy');
              }}
              className="text-xs sm:text-sm font-medium text-slate-300 hover:text-white transition-colors rv-link-underline whitespace-nowrap"
            >
              {isPrivacy ? 'Terms of Service' : 'Privacy Policy'}
            </a>
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={() => onNavigateRoute('main')}
            >
              <ArrowLeft
                className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5"
                aria-hidden="true"
              />
              <span>Back to Home</span>
            </ActionButton>
          </div>
        </div>
      </motion.header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-8 py-10 sm:py-14">
        <div className="space-y-6">
          <div className="space-y-3">
            <motion.div
              initial={isReduced ? { opacity: 1 } : { opacity: 0, y: 8 * profile.distanceScale }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: isReduced ? 0.01 : 0.3 * profile.durationScale, delay: 0.06, ease: RV_EASE }}
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-200"
            >
              {isPrivacy ? (
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
              ) : (
                <FileText className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
              )}
              <span>ReeView Legal &amp; Compliance</span>
            </motion.div>

            <ClipRevealHeading delay={0.12}>
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                {isPrivacy ? 'ReeView Privacy Policy' : 'ReeView Terms of Service'}
              </h1>
            </ClipRevealHeading>

            <BlurRevealText delay={0.2}>
              <p className="text-xs sm:text-sm text-slate-400">
                Effective Date: <span className="text-slate-200 font-medium">{EFFECTIVE_DATE}</span>
              </p>
            </BlurRevealText>
          </div>

          <ScaleMaskReveal delay={0.24}>
            <GlassPanel className="p-6 sm:p-8 space-y-7 text-sm text-slate-300 leading-relaxed rv-card-hover">
              {isPrivacy ? (
                <>
                  <RevealSection as="section" delay={0.04} className="space-y-2">
                    <h2 className="font-display text-lg font-semibold text-white">
                      1. Information ReeView Collects
                    </h2>
                    <p>
                      ReeView collects only the information needed to authenticate your workspace
                      and perform short-form video engagement evaluations:
                    </p>
                    <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
                      <li>
                        <strong className="text-white">Account &amp; Profile Details:</strong> Your
                        name, email address, and optional profile avatar URL provided when you sign
                        up with Email OTP or sign in via Google OpenID Connect (basic{' '}
                        <code className="font-mono text-xs text-indigo-300">openid</code>,{' '}
                        <code className="font-mono text-xs text-indigo-300">email</code>, and{' '}
                        <code className="font-mono text-xs text-indigo-300">profile</code> scopes).
                      </li>
                      <li>
                        <strong className="text-white">Uploaded Reels &amp; Context:</strong>{' '}
                        Short-form videos you upload for evaluation along with selected target
                        audience, campaign objective, and optional brand notes.
                      </li>
                      <li>
                        <strong className="text-white">Evaluation Reports:</strong> Generated 4×3
                        rubric scores, observations, and strategy recommendations saved to your
                        account history.
                      </li>
                    </ul>
                  </RevealSection>

                  <RevealSection as="section" delay={0.06} className="space-y-2">
                    <h2 className="font-display text-lg font-semibold text-white">
                      2. How Your Data &amp; Videos Are Processed
                    </h2>
                    <p>
                      Uploaded video files are temporarily staged on the ReeView server solely to
                      submit multimodal analysis requests to Google Gemini and are deleted from
                      temporary storage immediately after processing completes. ReeView does not sell
                      your personal data or uploaded creative assets to third parties.
                    </p>
                  </RevealSection>

                  <RevealSection as="section" delay={0.08} className="space-y-2">
                    <h2 className="font-display text-lg font-semibold text-white">
                      3. Authentication, Cookies &amp; Security
                    </h2>
                    <p>
                      ReeView stores HTTP-only session cookies (and signed session tokens when
                      needed) to keep you signed in securely. Passwords are hashed using salted{' '}
                      <code className="font-mono text-xs text-indigo-300">scrypt</code>, and Email
                      OTP verification codes are single-use, time-limited, and stored as salted
                      HMAC-SHA256 digests.
                    </p>
                  </RevealSection>

                  <RevealSection as="section" delay={0.1} className="space-y-2">
                    <h2 className="font-display text-lg font-semibold text-white">
                      4. Your Controls &amp; Data Deletion
                    </h2>
                    <p>
                      You may delete individual saved evaluations or clear your entire evaluation
                      history inside the History tab at any time. You can also manage connected
                      Google sign-in credentials from Account Settings.
                    </p>
                  </RevealSection>

                  <RevealSection as="section" delay={0.12} className="space-y-2">
                    <h2 className="font-display text-lg font-semibold text-white">
                      5. Contact
                    </h2>
                    <p>
                      For privacy inquiries or account assistance, contact the ReeView team at{' '}
                      <a
                        href="mailto:jaysonapoya06@gmail.com"
                        className="text-indigo-300 hover:text-indigo-200 underline underline-offset-4"
                      >
                        jaysonapoya06@gmail.com
                      </a>
                      .
                    </p>
                  </RevealSection>
                </>
              ) : (
                <>
                  <RevealSection as="section" delay={0.04} className="space-y-2">
                    <h2 className="font-display text-lg font-semibold text-white">
                      1. Acceptance of Terms
                    </h2>
                    <p>
                      By accessing or using ReeView, you agree to be bound by these Terms of
                      Service. If you do not agree with these terms, please discontinue use of the
                      platform.
                    </p>
                  </RevealSection>

                  <RevealSection as="section" delay={0.06} className="space-y-2">
                    <h2 className="font-display text-lg font-semibold text-white">
                      2. Permitted Use &amp; Content Responsibility
                    </h2>
                    <p>
                      You retain full ownership of all short-form Reels and campaign materials you
                      upload to ReeView. You represent that you hold the necessary rights to submit
                      uploaded videos for automated analysis and will not upload unlawful, abusive,
                      or infringing content.
                    </p>
                  </RevealSection>

                  <RevealSection as="section" delay={0.08} className="space-y-2">
                    <h2 className="font-display text-lg font-semibold text-white">
                      3. Empirical Rubric &amp; Advisory Nature
                    </h2>
                    <p>
                      ReeView generates AI-assisted evaluations grounded in a 4×3 Reels Marketing
                      Content and Brand Engagement rubric. Scores and strategic recommendations are
                      advisory assessments and do not guarantee specific advertising, reach, or
                      revenue outcomes.
                    </p>
                  </RevealSection>

                  <RevealSection as="section" delay={0.1} className="space-y-2">
                    <h2 className="font-display text-lg font-semibold text-white">
                      4. Account Security &amp; Availability
                    </h2>
                    <p>
                      You are responsible for maintaining the confidentiality of your account
                      credentials and Email OTP codes. ReeView may update platform models, quotas, or
                      evaluation workflows to maintain service reliability.
                    </p>
                  </RevealSection>

                  <RevealSection as="section" delay={0.12} className="space-y-2">
                    <h2 className="font-display text-lg font-semibold text-white">
                      5. Contact
                    </h2>
                    <p>
                      Questions regarding these Terms of Service can be directed to{' '}
                      <a
                        href="mailto:jaysonapoya06@gmail.com"
                        className="text-indigo-300 hover:text-indigo-200 underline underline-offset-4"
                      >
                        jaysonapoya06@gmail.com
                      </a>
                      .
                    </p>
                  </RevealSection>
                </>
              )}
            </GlassPanel>
          </ScaleMaskReveal>
        </div>
      </main>

      <footer className="border-t border-white/8 bg-[#050811]/80">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="group flex items-center gap-2.5">
            <ReeViewMark size="sm" />
            <span className="font-display font-semibold text-white">ReeView</span>
            <span aria-hidden="true">·</span>
            <span>AI Reels Marketing Content Effectiveness Platform</span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                onNavigateRoute('privacy');
              }}
              className={`transition-colors rv-link-underline ${isPrivacy ? 'text-white font-semibold' : 'hover:text-slate-200'}`}
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                onNavigateRoute('terms');
              }}
              className={`transition-colors rv-link-underline ${!isPrivacy ? 'text-white font-semibold' : 'hover:text-slate-200'}`}
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
    </div>
  );
}
