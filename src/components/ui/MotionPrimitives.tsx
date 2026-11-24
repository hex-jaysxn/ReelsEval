import {
  useEffect,
  useMemo,
  useRef,
  useState,
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
import { computeMotionProfile, type MotionProfile } from '../../utils/motionConfig.ts';

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

export function useMotionProfile(): MotionProfile {
  const reducedMotion = Boolean(useReducedMotion());
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const [coarsePointer, setCoarsePointer] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize, { passive: true });

    let pointerMq: MediaQueryList | null = null;
    const onPointerChange = (e: MediaQueryListEvent) => setCoarsePointer(e.matches);

    if (typeof window.matchMedia === 'function') {
      pointerMq = window.matchMedia('(pointer: coarse)');
      setCoarsePointer(pointerMq.matches);
      if (typeof pointerMq.addEventListener === 'function') {
        pointerMq.addEventListener('change', onPointerChange);
      }
    }

    return () => {
      window.removeEventListener('resize', onResize);
      if (pointerMq && typeof pointerMq.removeEventListener === 'function') {
        pointerMq.removeEventListener('change', onPointerChange);
      }
    };
  }, []);

  return useMemo(() => {
    const next = computeMotionProfile({
      reducedMotion,
      viewportWidth,
      coarsePointer,
    });
    return next;
  }, [reducedMotion, viewportWidth, coarsePointer]);
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
      className="fixed top-0 left-0 right-0 h-[2px] z-50 bg-gradient-to-r from-indigo-500 via-sky-400 to-teal-400 pointer-events-none"
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
          background: 'radial-gradient(closest-side, rgba(99, 102, 241, 0.14), transparent 74%)',
        }}
        className="absolute -top-24 left-[4%] w-[42rem] h-[28rem] rounded-full"
      />
      {profile.tier === 'desktop' && (
        <motion.div
          style={{
            y: orbMidY,
            background: 'radial-gradient(closest-side, rgba(14, 165, 233, 0.1), transparent 74%)',
          }}
          className="absolute top-[34%] right-[2%] w-[34rem] h-[26rem] rounded-full"
        />
      )}
      <motion.div
        style={{
          y: orbBottomY,
          background: 'radial-gradient(closest-side, rgba(20, 184, 166, 0.09), transparent 74%)',
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
  const duration = isReduced ? 0.01 : 0.24 * profile.durationScale;
  const yOffset = 10 * profile.distanceScale;

  return (
    <motion.div
      key={routeKey}
      initial={
        isReduced
          ? { opacity: 1 }
          : {
              opacity: 0,
              y: yOffset,
              scale: 0.994,
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
    ? { opacity: 0, y: 16 * profile.distanceScale, clipPath: 'inset(0% 0% 100% 0%)' }
    : { opacity: 0, y: 12 * profile.distanceScale };

  const visibleState = profile.enableClipMask
    ? { opacity: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)' }
    : { opacity: 1, y: 0 };

  const transition = {
    duration: 0.42 * profile.durationScale,
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
    filter: profile.enableBlur ? 'blur(2px)' : 'none',
  };

  const visibleState = {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
  };

  const transition = {
    duration: 0.34 * profile.durationScale,
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
        scale: 0.96,
        y: 14 * profile.distanceScale,
        clipPath: 'inset(6% 2% 8% 2% round 16px)',
      }
    : {
        opacity: 0,
        scale: 0.97,
        y: 12 * profile.distanceScale,
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
    duration: 0.48 * profile.durationScale,
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
  const bridgeOpacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.15, 0.85, 0.85, 0.2]);
  const sectionY = useTransform(
    scrollYProgress,
    [0, 0.22, 0.82, 1],
    [16 * profile.parallaxMultiplier, 0, 0, -10 * profile.parallaxMultiplier]
  );
  const sectionScale = useTransform(
    scrollYProgress,
    [0, 0.2, 0.85, 1],
    [1 - 0.015 * profile.parallaxMultiplier, 1, 1, 1 - 0.008 * profile.parallaxMultiplier]
  );

  const seamColor =
    accent === 'teal'
      ? 'from-transparent via-teal-400/55 to-transparent'
      : accent === 'sky'
        ? 'from-transparent via-sky-400/55 to-transparent'
        : 'from-transparent via-indigo-400/55 to-transparent';

  return (
    <section ref={ref} id={id} className={`relative ${className}`}>
      {!isReduced && (
        <motion.div
          aria-hidden="true"
          style={{ scaleX: bridgeScaleX, opacity: bridgeOpacity }}
          className={`pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-px w-[min(92%,56rem)] bg-gradient-to-r ${seamColor}`}
        />
      )}
      <motion.div style={isReduced ? undefined : { y: sectionY, scale: sectionScale }}>
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
        y: 18 * profile.distanceScale,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{ once: true, amount: profile.scrollRevealAmount }}
      transition={{
        duration: 0.42 * profile.durationScale,
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
  staggerDelay = 0.055,
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
            duration: 0.32 * profile.durationScale,
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
  offset = 16,
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
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  const springRotateX = useSpring(rotateX, { stiffness: 260, damping: 24 });
  const springRotateY = useSpring(rotateY, { stiffness: 260, damping: 24 });
  const sheen = useMotionTemplate`radial-gradient(280px circle at ${pointerX}% ${pointerY}%, rgba(129, 140, 248, 0.11), transparent 70%)`;

  function handleMouseMove(e: ReactMouseEvent<HTMLDivElement>) {
    if (!profile.enable3DTilt || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    pointerX.set(px);
    pointerY.set(py);
    rotateY.set(((px - 50) / 50) * 2.2);
    rotateX.set((-(py - 50) / 50) * 2.2);
  }

  function handleMouseLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  if (profile.tier === 'reduced') {
    return <div className={className}>{children}</div>;
  }

  return (
    <div style={profile.enable3DTilt ? { perspective: 1000 } : undefined} className="h-full">
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={
          profile.enable3DTilt
            ? {
                rotateX: springRotateX,
                rotateY: springRotateY,
                transformStyle: 'preserve-3d',
              }
            : undefined
        }
        whileHover={profile.enable3DTilt ? { y: -3 } : undefined}
        whileTap={{ scale: 0.986 }}
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
    </div>
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
