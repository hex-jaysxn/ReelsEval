import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_VIDEO_SIZE_BYTES,
  buildReportMarkdown,
  clampScore,
  computeEngagementSummary,
  computeOverallScore,
  formatBytes,
  formatDuration,
  getScoreTier,
  resolveVideoMimeType,
  validateVideoMetadata,
} from './evaluationLogic.ts';
import type { ReelEvaluation } from '../types/evaluation.ts';

test('resolveVideoMimeType normalizes octet-stream and preserves video MIME types', () => {
  assert.equal(resolveVideoMimeType('clip.mp4', 'application/octet-stream'), 'video/mp4');
  assert.equal(resolveVideoMimeType('clip.webm', ''), 'video/webm');
  assert.equal(resolveVideoMimeType('clip.mov', 'video/quicktime;codecs=h264'), 'video/quicktime');
});

test('validateVideoMetadata accepts valid MP4, WebM, and MOV videos within size limit', () => {
  assert.deepEqual(
    validateVideoMetadata({ name: 'product-reel.mp4', type: 'video/mp4', size: 5_000_000 }),
    { valid: true }
  );
  assert.deepEqual(
    validateVideoMetadata({ name: 'demo.webm', type: 'video/webm;codecs=vp8', size: 1_200_000 }),
    { valid: true }
  );
  assert.deepEqual(
    validateVideoMetadata({ name: 'iphone-clip.MOV', type: 'video/quicktime', size: 12_000_000 }),
    { valid: true }
  );
});

test('validateVideoMetadata rejects empty, unsupported, and oversized files', () => {
  const empty = validateVideoMetadata({ name: 'empty.mp4', type: 'video/mp4', size: 0 });
  assert.equal(empty.valid, false);
  assert.equal(empty.errorCode, 'INVALID_FILE');

  const pdf = validateVideoMetadata({ name: 'brief.pdf', type: 'application/pdf', size: 1024 });
  assert.equal(pdf.valid, false);
  assert.equal(pdf.errorCode, 'UNSUPPORTED_VIDEO');

  const huge = validateVideoMetadata({
    name: '4k-master.mp4',
    type: 'video/mp4',
    size: MAX_VIDEO_SIZE_BYTES + 1,
  });
  assert.equal(huge.valid, false);
  assert.equal(huge.errorCode, 'FILE_TOO_LARGE');
});

test('clampScore and computeOverallScore strictly enforce 0-5 per category and 0-20 total', () => {
  assert.equal(clampScore(7.4), 5);
  assert.equal(clampScore(-2), 0);
  assert.equal(clampScore(3.74), 3.5);
  assert.equal(clampScore(Number.NaN), 0);

  const total = computeOverallScore({
    relatedContent: { score: 4.5, rationale: '', observedCues: [] },
    entertainmentContent: { score: 4, rationale: '', observedCues: [] },
    informational: { score: 3.5, rationale: '', observedCues: [] },
    trendiness: { score: 5, rationale: '', observedCues: [] },
  });
  assert.equal(total, 17);
});

test('computeEngagementSummary calculates total out of 15, percentage, and dominant driver', () => {
  const summary = computeEngagementSummary({
    interaction: { score: 3, rationale: '', observedCues: [] },
    sharing: { score: 4.5, rationale: '', observedCues: [] },
    participation: { score: 4.5, rationale: '', observedCues: [] },
  });
  assert.equal(summary.totalOutOf15, 12);
  assert.equal(summary.percentage, 80);
  assert.equal(summary.dominantDriver, 'Sharing');
});

test('getScoreTier classifies all score bands accurately', () => {
  assert.equal(getScoreTier(18).label, 'High Viral & Brand Impact');
  assert.equal(getScoreTier(14.5).label, 'Strong Performance');
  assert.equal(getScoreTier(10).label, 'Moderate Potential');
  assert.equal(getScoreTier(6).label, 'Needs Restructuring');
});

test('formatBytes and formatDuration format display strings cleanly', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatDuration(75), '1:15');
  assert.equal(formatDuration(undefined), 'Unknown');
});

test('buildReportMarkdown outputs complete structured report with 0-20 score', () => {
  const sample: ReelEvaluation = {
    id: 'eval-1',
    createdAt: '2026-11-23T22:00:00.000Z',
    modelUsed: 'gemini-4-hydrogen',
    videoMetadata: {
      fileName: 'launch-reel.mp4',
      fileSizeBytes: 3_145_728,
      mimeType: 'video/mp4',
      durationSeconds: 28,
    },
    context: {
      targetPersona: 'Gen Z Consumers',
      campaignObjective: 'Product Conversion',
    },
    executiveSummary: 'Strong opening hook with clear product demonstration.',
    overallScore: 16,
    scoreTier: getScoreTier(16),
    reelsMarketingScores: {
      relatedContent: { score: 4, rationale: 'Matches lifestyle context.', observedCues: ['Desk setup'] },
      entertainmentContent: { score: 4.5, rationale: 'Fast pacing.', observedCues: ['0:02 beat drop'] },
      informational: { score: 4, rationale: 'Clear benefit.', observedCues: ['On-screen text'] },
      trendiness: { score: 3.5, rationale: 'Current transition style.', observedCues: ['Match cut'] },
    },
    brandEngagementScores: {
      interaction: { score: 4, rationale: 'Prompts comment debate.', observedCues: ['Open question'] },
      sharing: { score: 4, rationale: 'Relatable pain point.', observedCues: ['Before/after'] },
      participation: { score: 3, rationale: 'Could add duet prompt.', observedCues: ['End CTA'] },
    },
    brandEngagementSummary: {
      totalOutOf15: 11,
      percentage: 73,
      dominantDriver: 'Interaction',
    },
    strengths: ['Immediate 2-second visual hook'],
    weaknesses: ['CTA appears too late at 0:26'],
    improvementRecommendations: [
      {
        priority: 'High',
        targetVariable: 'Participation',
        recommendation: 'Add a stitch/duet prompt at 0:18.',
        expectedImpact: '+15% comment & remix rate',
        timestampHint: '0:18',
      },
    ],
    predictedAudienceResponse: [
      {
        segment: 'Gen Z Consumers',
        predictedSentiment: 'Highly Receptive',
        responseSummary: 'Fast pacing aligns with native feed expectations.',
        likelyAction: 'Save or share via DM',
      },
    ],
    marketingStrategyRecommendations: [
      {
        pillar: 'Hook Testing',
        recommendation: 'Run 2 alternate 1.5s opening frames.',
        researchRationale: 'Retention drop-off concentrates in the first 3 seconds.',
        executionStep: 'Publish organic split test over 48 hours.',
      },
    ],
    researchRecommendations: ['Measure 3-second hold rate vs 50% completion rate.'],
  };

  const md = buildReportMarkdown(sample);
  assert.match(md, /Overall Score: 16 \/ 20/);
  assert.match(md, /Related Content \| 4 \/ 5/);
  assert.match(md, /launch-reel\.mp4/);
  assert.match(md, /Gen Z Consumers/);
});
