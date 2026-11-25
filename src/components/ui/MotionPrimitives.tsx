import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import {
  animate,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  areMotionProfilesEqual,
  computeMotionProfile,
  type MotionProfile,
} from '../../utils/motionConfig.ts';

export const RV_EASE = [0.16, 1, 0.3, 1] as const;
export const RV_EASE_EMPHASIS = [0.22, 1, 0.36, 1] as const;

export const RV_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 34,
  mass: 0.8,
};

export const RV_SPRING_TACTILE = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 32,
  mass: 0.6,
};

interface ViewportSnapshot {
  width: number;
  coarsePointer: boolean;
}

let cachedViewport: ViewportSnapshot = {
  width: typeof window !== 'undefined' ? window.innerWidth : 1280,
  coarsePointer:
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false,
};

const viewportListeners = new Set<() => void>();
let globalListenersAttached = false;

function refreshViewportSnapshot() {
  if (typeof window === 'undefined') return;
  const nextWidth = window.innerWidth;
  const nextCoarse =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
  if (
    nextWidth !== cachedViewport.width ||
    nextCoarse !== cachedViewport.coarsePointer
  ) {
    cachedViewport = { width: nextWidth, coarsePointer: nextCoarse };
    viewportListeners.forEach((cb) => cb());
  }
}

function subscribeViewport(callback: () => void): () => void {
  viewportListeners.add(callback);
  if (!globalListenersAttached && typeof window !== 'undefined') {
    globalListenersAttached = true;
    window.addEventListener('resize', refreshViewportSnapshot, { passive: true });
    if (typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(pointer: coarse)');
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', refreshViewportSnapshot);
      }
    }
  }
  return () => {
    viewportListeners.delete(callback);
  };
}

function getViewportSnapshot(): ViewportSnapshot {
  return cachedViewport;
}

const SERVER_SNAPSHOT: ViewportSnapshot = { width: 1280, coarsePointer: false };

export function useMotionProfile(): MotionProfile {
  const reducedMotion = Boolean(useReducedMotion());
  const viewport = useSyncExternalStore(
    subscribeViewport,
    getViewportSnapshot,
    () => SERVER_SNAPSHOT
  );

  const profileRef = useRef<MotionProfile | null>(null);
  const candidate = computeMotionProfile({
    reducedMotion,
    viewportWidth: viewport.width,
    coarsePointer: viewport.coarsePointer,
  });

  if (!profileRef.current || !areMotionProfilesEqual(profileRef.current, candidate)) {
    profileRef.current = candidate;
  }

  return profileRef.current;
}

export function ScrollProgressBar() {
  const profile = useMotionProfile();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 240,
    damping: 32,
    restDelta: 0.001,
  });

  if (profile.tier === 'reduced') return null;

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX, transformOrigin: '0% 50%' }}
      className="fixed top-0 left-0 right-0 h-[2px] z-50 bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-400 pointer-events-none"
    />
  );
}

export function ScrollDepthBackdrop() {
  const profile = useMotionProfile();
  const { scrollYProgress } = useScroll();

  const orbTopY = useTransform(
    scrollYProgress,
    [0, 1],
    [0, -90 * profile.parallaxMultiplier]
  );
  const orbMidY = useTransform(
    scrollYProgress,
    [0, 1],
    [40 * profile.parallaxMultiplier, -110 * profile.parallaxMultiplier]
  );
  const orbBottomY = useTransform(
    scrollYProgress,
    [0, 1],
    [60 * profile.parallaxMultiplier, -60 * profile.parallaxMultiplier]
  );
  const orbOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.85, 1, 0.78]);

  if (profile.tier === 'reduced') return null;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 -z-10 overflow-hidden pointer-events-none select-none"
    >
      <motion.div
        style={{
          y: orbTopY,
          opacity: orbOpacity,
          background: 'radial-gradient(closest-side, rgba(139, 92, 246, 0.16), transparent 74%)',
        }}
        className="absolute -top-24 left-[4%] w-[42rem] h-[28rem] rounded-full"
      />
      {profile.tier === 'desktop' && (
        <motion.div
          style={{
            y: orbMidY,
            background: 'radial-gradient(closest-side, rgba(6, 182, 212, 0.12), transparent 74%)',
          }}
          className="absolute top-[34%] right-[2%] w-[34rem] h-[26rem] rounded-full"
        />
      )}
      <motion.div
        style={{
          y: orbBottomY,
          background: 'radial-gradient(closest-side, rgba(37, 99, 235, 0.13), transparent 74%)',
        }}
        className="absolute bottom-[4%] left-[32%] w-[36rem] h-[24rem] rounded-full"
      />
    </div>
  );
}

interface PageTransitionProps {
  routeKey: string;
  children: ReactNode;
  className?: string;
}

export function PageTransition({ routeKey, children, className = '' }: PageTransitionProps) {
  const profile = useMotionProfile();
  const isReduced = profile.tier === 'reduced';
  const duration = isReduced ? 0.01 : 0.22 * profile.durationScale;
  const yOffset = 8 * profile.distanceScale;

  return (
    <motion.div
      key={routeKey}
      initial={
        isReduced
          ? { opacity: 1 }
          : {
              opacity: 0,
              y: yOffset,
              scale: 0.995,
            }
      }
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      exit={
        isReduced
          ? { opacity: 0 }
          : {
              opacity: 0,
              y: -yOffset * 0.6,
              scale: 0.996,
            }
      }
      transition={{ duration, ease: RV_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface ClipRevealHeadingProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  inView?: boolean;
}

export function ClipRevealHeading({
  children,
  className = '',
  delay = 0,
  inView = false,
}: ClipRevealHeadingProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const profile = useMotionProfile();
  const isReduced = profile.tier === 'reduced';
  const isInView = useInView(ref, { once: true, amount: 0.02 });
  const shouldReveal = !inView || isInView;

  if (isReduced) {
    return <div className={className}>{children}</div>;
  }

  const initialState = profile.enableClipMask
    ? { opacity: 0, y: 14 * profile.distanceScale, clipPath: 'inset(0% 0% 100% 0%)' }
    : { opacity: 0, y: 10 * profile.distanceScale };

  const visibleState = profile.enableClipMask
    ? { opacity: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)' }
    : { opacity: 1, y: 0 };

  const transition = {
    duration: 0.38 * profile.durationScale,
    delay: delay * profile.durationScale,
    ease: RV_EASE_EMPHASIS,
  };

  return (
    <div ref={ref} className={className}>
      <motion.div
        initial={initialState}
        animate={shouldReveal ? visibleState : initialState}
        transition={transition}
      >
        {children}
      </motion.div>
    </div>
  );
}

interface BlurRevealTextProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  inView?: boolean;
}

export function BlurRevealText({
  children,
  className = '',
  delay = 0,
  inView = false,
}: BlurRevealTextProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const profile = useMotionProfile();
  const isReduced = profile.tier === 'reduced';
  const isInView = useInView(ref, { once: true, amount: 0.02 });
  const shouldReveal = !inView || isInView;

  if (isReduced) {
    return <div className={className}>{children}</div>;
  }

  const initialState = {
    opacity: 0,
    y: 10 * profile.distanceScale,
  };

  const visibleState = {
    opacity: 1,
    y: 0,
  };

  const transition = {
    duration: 0.32 * profile.durationScale,
    delay: delay * profile.durationScale,
    ease: RV_EASE,
  };

  return (
    <div ref={ref} className={className}>
      <motion.div
        initial={initialState}
        animate={shouldReveal ? visibleState : initialState}
        transition={transition}
      >
        {children}
      </motion.div>
    </div>
  );
}

interface ScaleMaskRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  inView?: boolean;
}

export function ScaleMaskReveal({
  children,
  className = '',
  delay = 0,
  inView = false,
}: ScaleMaskRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const profile = useMotionProfile();
  const isReduced = profile.tier === 'reduced';
  const isInView = useInView(ref, { once: true, amount: 0.02 });
  const shouldReveal = !inView || isInView;

  if (isReduced) {
    return <div className={className}>{children}</div>;
  }

  const initialState = profile.enableClipMask
    ? {
        opacity: 0,
        scale: 0.965,
        y: 12 * profile.distanceScale,
        clipPath: 'inset(4% 1% 6% 1% round 16px)',
      }
    : {
        opacity: 0,
        scale: 0.975,
        y: 10 * profile.distanceScale,
      };

  const visibleState = profile.enableClipMask
    ? {
        opacity: 1,
        scale: 1,
        y: 0,
        clipPath: 'inset(0% 0% 0% 0% round 16px)',
      }
    : {
        opacity: 1,
        scale: 1,
        y: 0,
      };

  const transition = {
    duration: 0.42 * profile.durationScale,
    delay: delay * profile.durationScale,
    ease: RV_EASE,
  };

  return (
    <div ref={ref} className={className}>
      <motion.div
        initial={initialState}
        animate={shouldReveal ? visibleState : initialState}
        transition={transition}
      >
        {children}
      </motion.div>
    </div>
  );
}

interface ScrollSectionBridgeProps {
  children: ReactNode;
  id?: string;
  className?: string;
  accent?: 'indigo' | 'sky' | 'teal';
}

export function ScrollSectionBridge({
  children,
  id,
  className = '',
  accent = 'indigo',
}: ScrollSectionBridgeProps) {
  const ref = useRef<HTMLElement | null>(null);
  const profile = useMotionProfile();
  const isReduced = profile.tier === 'reduced';

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const bridgeScaleX = useTransform(scrollYProgress, [0, 0.25, 0.75, 1], [0.25, 1, 1, 0.5]);
  const bridgeOpacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.15, 0.9, 0.9, 0.2]);
  const sectionY = useTransform(
    scrollYProgress,
    [0, 0.22, 0.82, 1],
    [14 * profile.parallaxMultiplier, 0, 0, -8 * profile.parallaxMultiplier]
  );

  const seamColor =
    accent === 'teal'
      ? 'from-transparent via-cyan-400/60 to-transparent'
      : accent === 'sky'
        ? 'from-transparent via-blue-400/60 to-transparent'
        : 'from-transparent via-violet-400/60 to-transparent';

  return (
    <section ref={ref} id={id} className={`relative ${className}`}>
      {!isReduced && (
        <motion.div
          aria-hidden="true"
          style={{ scaleX: bridgeScaleX, opacity: bridgeOpacity }}
          className={`pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-px w-[min(92%,56rem)] bg-gradient-to-r ${seamColor}`}
        />
      )}
      <motion.div style={isReduced ? undefined : { y: sectionY }}>
        {children}
      </motion.div>
    </section>
  );
}

interface RevealSectionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  id?: string;
  as?: 'div' | 'section';
}

export function RevealSection({
  children,
  className = '',
  delay = 0,
  id,
  as = 'div',
}: RevealSectionProps) {
  const profile = useMotionProfile();
  const Component = as === 'section' ? motion.section : motion.div;

  if (profile.tier === 'reduced') {
    return (
      <Component id={id} className={className}>
        {children}
      </Component>
    );
  }

  return (
    <Component
      id={id}
      initial={{
        opacity: 0,
        y: 16 * profile.distanceScale,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{ once: true, amount: profile.scrollRevealAmount }}
      transition={{
        duration: 0.38 * profile.durationScale,
        delay: delay * profile.durationScale,
        ease: RV_EASE,
      }}
      className={className}
    >
      {children}
    </Component>
  );
}

interface StaggerGroupProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
  delayChildren?: number;
  inView?: boolean;
  id?: string;
}

export function StaggerGroup({
  children,
  className = '',
  staggerDelay = 0.05,
  delayChildren = 0.02,
  inView = false,
  id,
}: StaggerGroupProps) {
  const profile = useMotionProfile();

  if (profile.tier === 'reduced') {
    return (
      <div id={id} className={className}>
        {children}
      </div>
    );
  }

  const variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: staggerDelay * profile.durationScale,
        delayChildren: delayChildren * profile.durationScale,
      },
    },
  };

  if (inView) {
    return (
      <motion.div
        id={id}
        variants={variants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.02 }}
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      id={id}
      variants={variants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = '',
  xOffset = 0,
}: {
  children: ReactNode;
  className?: string;
  xOffset?: number;
}) {
  const profile = useMotionProfile();

  if (profile.tier === 'reduced') {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={{
        hidden: {
          opacity: 0,
          y: 12 * profile.distanceScale,
          x: xOffset * profile.distanceScale,
          scale: 0.985,
        },
        visible: {
          opacity: 1,
          y: 0,
          x: 0,
          scale: 1,
          transition: {
            duration: 0.3 * profile.durationScale,
            ease: RV_EASE,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ParallaxOffset({
  children,
  className = '',
  offset = 14,
}: {
  children: ReactNode;
  className?: string;
  offset?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const profile = useMotionProfile();
  const effectiveOffset = offset * profile.parallaxMultiplier;

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [effectiveOffset, -effectiveOffset]);

  return (
    <motion.div
      ref={ref}
      style={profile.tier === 'reduced' ? undefined : { y }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function InteractiveTiltCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const profile = useMotionProfile();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const pointerX = useMotionValue(50);
  const pointerY = useMotionValue(50);
  const sheen = useMotionTemplate`radial-gradient(280px circle at ${pointerX}% ${pointerY}%, rgba(6, 182, 212, 0.1), rgba(139, 92, 246, 0.04) 45%, transparent 72%)`;

  function handleMouseMove(e: ReactMouseEvent<HTMLDivElement>) {
    if (!profile.enable3DTilt || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    pointerX.set(px);
    pointerY.set(py);
  }

  if (profile.tier === 'reduced') {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      whileHover={profile.enable3DTilt ? { y: -2 } : undefined}
      whileTap={{ scale: 0.99 }}
      transition={RV_SPRING_TACTILE}
      className={`relative h-full group ${className}`}
    >
      {profile.enable3DTilt && (
        <motion.div
          aria-hidden="true"
          style={{ backgroundImage: sheen }}
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
        />
      )}
      {children}
    </motion.div>
  );
}

export function AnimatedNumber({
  value,
  decimals = 2,
  duration = 0.65,
  inViewOnly = false,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  inViewOnly?: boolean;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const profile = useMotionProfile();
  const isReduced = profile.tier === 'reduced';
  const isInView = useInView(ref, { once: true, amount: 0.35 });
  const shouldRun = !inViewOnly || isInView;

  const [display, setDisplay] = useState(isReduced ? value : 0);
  const prevValueRef = useRef(0);

  useEffect(() => {
    if (isReduced) {
      setDisplay(value);
      prevValueRef.current = value;
      return;
    }

    if (!shouldRun) return;

    const from = prevValueRef.current;
    const controls = animate(from, value, {
      duration: duration * profile.durationScale,
      ease: RV_EASE,
      onUpdate: (latest) => setDisplay(latest),
      onComplete: () => {
        prevValueRef.current = value;
      },
    });

    return () => {
      controls.stop();
      prevValueRef.current = value;
    };
  }, [value, duration, isReduced, shouldRun, profile.durationScale]);

  return <span ref={ref}>{display.toFixed(decimals)}</span>;
}

export function MagneticWrapper({
  children,
  className = '',
  strength = 0.22,
  maxOffsetX = 6,
  maxOffsetY = 5,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
  maxOffsetX?: number;
  maxOffsetY?: number;
}) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const profile = useMotionProfile();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const springX = useSpring(rawX, { stiffness: 280, damping: 22, mass: 0.55 });
  const springY = useSpring(rawY, { stiffness: 280, damping: 22, mass: 0.55 });

  if (profile.tier !== 'desktop') {
    return <div className={`inline-flex ${className}`}>{children}</div>;
  }

  function handleMouseMove(e: ReactMouseEvent<HTMLDivElement>) {
    if (!outerRef.current) return;
    const rect = outerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = Math.max(-maxOffsetX, Math.min(maxOffsetX, (e.clientX - centerX) * strength));
    const dy = Math.max(-maxOffsetY, Math.min(maxOffsetY, (e.clientY - centerY) * strength));
    rawX.set(dx);
    rawY.set(dy);
  }

  function handleMouseLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <div
      ref={outerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative inline-flex p-3 -m-3 ${className}`}
    >
      <motion.div
        data-magnetic-target="true"
        style={{ x: springX, y: springY }}
        className="inline-flex"
      >
        {children}
      </motion.div>
    </div>
  );
}
