export type MotionTier = 'reduced' | 'mobile' | 'desktop';

export interface MotionProfileInput {
  reducedMotion: boolean;
  viewportWidth: number;
  coarsePointer: boolean;
}

export interface MotionProfile {
  tier: MotionTier;
  parallaxMultiplier: number;
  durationScale: number;
  distanceScale: number;
  enable3DTilt: boolean;
  enableBlur: boolean;
  enableClipMask: boolean;
  scrollRevealAmount: number;
}

export function computeMotionProfile({
  reducedMotion,
  viewportWidth,
  coarsePointer,
}: MotionProfileInput): MotionProfile {
  if (reducedMotion) {
    return {
      tier: 'reduced',
      parallaxMultiplier: 0,
      durationScale: 0.05,
      distanceScale: 0,
      enable3DTilt: false,
      enableBlur: false,
      enableClipMask: false,
      scrollRevealAmount: 0.05,
    };
  }

  if (viewportWidth < 768 || coarsePointer) {
    return {
      tier: 'mobile',
      parallaxMultiplier: 0.32,
      durationScale: 0.72,
      distanceScale: 0.55,
      enable3DTilt: false,
      enableBlur: false,
      enableClipMask: true,
      scrollRevealAmount: 0.04,
    };
  }

  return {
    tier: 'desktop',
    parallaxMultiplier: 1,
    durationScale: 1,
    distanceScale: 1,
    enable3DTilt: true,
    enableBlur: true,
    enableClipMask: true,
    scrollRevealAmount: 0.06,
  };
}

export function areMotionProfilesEqual(a: MotionProfile, b: MotionProfile): boolean {
  return (
    a.tier === b.tier &&
    a.parallaxMultiplier === b.parallaxMultiplier &&
    a.durationScale === b.durationScale &&
    a.distanceScale === b.distanceScale &&
    a.enable3DTilt === b.enable3DTilt &&
    a.enableBlur === b.enableBlur &&
    a.enableClipMask === b.enableClipMask &&
    a.scrollRevealAmount === b.scrollRevealAmount
  );
}
