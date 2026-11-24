import test from 'node:test';
import assert from 'node:assert/strict';
import { areMotionProfilesEqual, computeMotionProfile } from './motionConfig';

test('computeMotionProfile disables parallax, 3D tilt, and blur when reducedMotion is enabled', () => {
  const profile = computeMotionProfile({
    reducedMotion: true,
    viewportWidth: 1440,
    coarsePointer: false,
  });

  assert.equal(profile.tier, 'reduced');
  assert.equal(profile.parallaxMultiplier, 0);
  assert.equal(profile.distanceScale, 0);
  assert.equal(profile.enable3DTilt, false);
  assert.equal(profile.enableBlur, false);
  assert.equal(profile.enableClipMask, false);
});

test('computeMotionProfile optimizes timing, distance, and heavy effects for mobile and touch devices', () => {
  const mobileViewport = computeMotionProfile({
    reducedMotion: false,
    viewportWidth: 390,
    coarsePointer: false,
  });
  assert.equal(mobileViewport.tier, 'mobile');
  assert.ok(mobileViewport.parallaxMultiplier > 0 && mobileViewport.parallaxMultiplier < 0.5);
  assert.ok(mobileViewport.durationScale < 1);
  assert.ok(mobileViewport.distanceScale < 1);
  assert.equal(mobileViewport.enable3DTilt, false);
  assert.equal(mobileViewport.enableBlur, false);

  const coarseDevice = computeMotionProfile({
    reducedMotion: false,
    viewportWidth: 1024,
    coarsePointer: true,
  });
  assert.equal(coarseDevice.tier, 'mobile');
  assert.equal(coarseDevice.enable3DTilt, false);
});

test('computeMotionProfile enables full layered choreography on desktop', () => {
  const desktop = computeMotionProfile({
    reducedMotion: false,
    viewportWidth: 1440,
    coarsePointer: false,
  });

  assert.equal(desktop.tier, 'desktop');
  assert.equal(desktop.parallaxMultiplier, 1);
  assert.equal(desktop.durationScale, 1);
  assert.equal(desktop.distanceScale, 1);
  assert.equal(desktop.enable3DTilt, true);
  assert.equal(desktop.enableBlur, true);
  assert.equal(desktop.enableClipMask, true);
});

test('areMotionProfilesEqual ignores within-tier resizes and detects tier changes', () => {
  const desktopWide = computeMotionProfile({
    reducedMotion: false,
    viewportWidth: 1440,
    coarsePointer: false,
  });
  const desktopNarrow = computeMotionProfile({
    reducedMotion: false,
    viewportWidth: 1024,
    coarsePointer: false,
  });
  const mobile = computeMotionProfile({
    reducedMotion: false,
    viewportWidth: 390,
    coarsePointer: false,
  });

  assert.equal(areMotionProfilesEqual(desktopWide, desktopNarrow), true);
  assert.equal(areMotionProfilesEqual(desktopWide, mobile), false);
});
