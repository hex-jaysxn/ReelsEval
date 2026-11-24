import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_VIDEO_SIZE_BYTES,
  buildReportMarkdown,
  buildVariableAssessment,
  clampDimensionRating,
  computeEngagementSummary,
  computeOverallScore,
  computeVariableAverage,
  getScoreTier,
  getVariableEffectiveness,
  parseEvaluationApiResponse,
  resolveVideoMimeType,
  validateVideoMetadata,
} from './evaluationLogic.ts';
import type { ReelEvaluation } from '../types/evaluation.ts';

test('validateVideoMetadata and resolveVideoMimeType handle valid and invalid files', () => {
  assert.deepEqual(
    validateVideoMetadata({ name: 'reel.mp4', type: 'video/mp4', size: 5_000_000 }),
    { valid: true }
  );
  assert.equal(
    validateVideoMetadata({ name: 'brief.pdf', type: 'application/pdf', size: 1024 }).errorCode,
    'UNSUPPORTED_VIDEO'
  );
  assert.equal(
    validateVideoMetadata({
      name: 'huge.mp4',
      type: 'video/mp4',
      size: MAX_VIDEO_SIZE_BYTES + 1,
    }).errorCode,
    'FILE_TOO_LARGE'
  );
  assert.equal(resolveVideoMimeType('clip.mp4', 'application/octet-stream'), 'video/mp4');
  assert.equal(resolveVideoMimeType('clip.webm', ''), 'video/webm');
});

test('clampDimensionRating enforces integer 2-5 rubric bounds', () => {
  assert.equal(clampDimensionRating(1), 2);
  assert.equal(clampDimensionRating(0), 2);
  assert.equal(clampDimensionRating(6.8), 5);
  assert.equal(clampDimensionRating(3.6), 4);
  assert.equal(clampDimensionRating(Number.NaN), 2);
});

test('PDF Section III example calculation produces exact 16.33 / 20 Effective score', () => {
  const informational = buildVariableAssessment({
    key: 'informational',
    interaction: { score: 4, rationale: 'Relevant details.' },
    participation: { score: 4, rationale: 'Clear prompts.' },
    sharing: { score: 4, rationale: 'Worth saving.' },
    observedCues: ['Product spec card'],
  });
  const entertainment = buildVariableAssessment({
    key: 'entertainment',
    interaction: { score: 5, rationale: 'Strong hook.' },
    participation: { score: 4, rationale: 'Fun activity.' },
    sharing: { score: 4, rationale: 'Shareable moments.' },
    observedCues: ['Fast transitions'],
  });
  const trendiness = buildVariableAssessment({
    key: 'trendiness',
    interaction: { score: 4, rationale: 'Recognizable trend.' },
    participation: { score: 3, rationale: 'Limited participation hook.' },
    sharing: { score: 4, rationale: 'Popular format.' },
    observedCues: ['Trending audio'],
  });
  const relatable = buildVariableAssessment({
    key: 'relatable',
    interaction: { score: 5, rationale: 'Highly relatable scenario.' },
    participation: { score: 4, rationale: 'Encourages response.' },
    sharing: { score: 4, rationale: 'Peer shareable.' },
    observedCues: ['Morning commute scene'],
  });

  assert.equal(informational.averageScore, 4.0);
  assert.equal(entertainment.averageScore, 4.33);
  assert.equal(trendiness.averageScore, 3.67);
  assert.equal(relatable.averageScore, 4.33);

  const variables = { informational, entertainment, trendiness, relatable };
  const overall = computeOverallScore(variables);
  assert.equal(overall, 16.33);

  const tier = getScoreTier(overall);
  assert.equal(tier.level, 'Effective');
});

test('Section IV variable effectiveness thresholds classify boundary scores accurately', () => {
  assert.equal(getVariableEffectiveness(4.25).level, 'Very Effective');
  assert.equal(getVariableEffectiveness(4.24).level, 'Effective');
  assert.equal(getVariableEffectiveness(3.5).level, 'Effective');
  assert.equal(getVariableEffectiveness(3.49).level, 'Moderately Effective');
  assert.equal(getVariableEffectiveness(2.75).level, 'Moderately Effective');
  assert.equal(getVariableEffectiveness(2.74).level, 'Less Effective');
  assert.equal(getVariableEffectiveness(2.0).level, 'Less Effective');
});

test('Section V overall effectiveness thresholds classify 8.00-20.00 boundaries accurately', () => {
  assert.equal(getScoreTier(17.0).level, 'Very Effective');
  assert.equal(getScoreTier(16.99).level, 'Effective');
  assert.equal(getScoreTier(14.0).level, 'Effective');
  assert.equal(getScoreTier(13.99).level, 'Moderately Effective');
  assert.equal(getScoreTier(11.0).level, 'Moderately Effective');
  assert.equal(getScoreTier(10.99).level, 'Less Effective');
  assert.equal(getScoreTier(8.0).level, 'Less Effective');
});

test('computeVariableAverage and computeEngagementSummary compute dimension means accurately', () => {
  assert.equal(computeVariableAverage(2, 2, 2), 2.0);
  assert.equal(computeVariableAverage(5, 5, 5), 5.0);

  const variables = {
    informational: buildVariableAssessment({
      key: 'informational',
      interaction: { score: 4, rationale: '' },
      participation: { score: 3, rationale: '' },
      sharing: { score: 2, rationale: '' },
      observedCues: [],
    }),
    entertainment: buildVariableAssessment({
      key: 'entertainment',
      interaction: { score: 5, rationale: '' },
      participation: { score: 3, rationale: '' },
      sharing: { score: 4, rationale: '' },
      observedCues: [],
    }),
    trendiness: buildVariableAssessment({
      key: 'trendiness',
      interaction: { score: 4, rationale: '' },
      participation: { score: 2, rationale: '' },
      sharing: { score: 3, rationale: '' },
      observedCues: [],
    }),
    relatable: buildVariableAssessment({
      key: 'relatable',
      interaction: { score: 5, rationale: '' },
      participation: { score: 4, rationale: '' },
      sharing: { score: 3, rationale: '' },
      observedCues: [],
    }),
  };

  const summary = computeEngagementSummary(variables);
  assert.equal(summary.interactionMean, 4.5);
  assert.equal(summary.participationMean, 3.0);
  assert.equal(summary.sharingMean, 3.0);
  assert.equal(summary.dominantDriver, 'Interaction');
});

test('buildReportMarkdown outputs 4x3 rubric matrix and 16.33 / 20 example cleanly', () => {
  const variables = {
    informational: buildVariableAssessment({
      key: 'informational',
      interaction: { score: 4, rationale: 'Good.' },
      participation: { score: 4, rationale: 'Good.' },
      sharing: { score: 4, rationale: 'Good.' },
      observedCues: ['Text overlay'],
    }),
    entertainment: buildVariableAssessment({
      key: 'entertainment',
      interaction: { score: 5, rationale: 'Great.' },
      participation: { score: 4, rationale: 'Good.' },
      sharing: { score: 4, rationale: 'Good.' },
      observedCues: ['Hook'],
    }),
    trendiness: buildVariableAssessment({
      key: 'trendiness',
      interaction: { score: 4, rationale: 'Good.' },
      participation: { score: 3, rationale: 'Limited.' },
      sharing: { score: 4, rationale: 'Good.' },
      observedCues: ['Audio'],
    }),
    relatable: buildVariableAssessment({
      key: 'relatable',
      interaction: { score: 5, rationale: 'Great.' },
      participation: { score: 4, rationale: 'Good.' },
      sharing: { score: 4, rationale: 'Good.' },
      observedCues: ['Scene'],
    }),
  };

  const overallScore = computeOverallScore(variables);
  const sample: ReelEvaluation = {
    schemaVersion: 2,
    id: 'eval-pdf-1',
    createdAt: '2026-11-23T22:35:00.000Z',
    modelUsed: 'gemini-4-hydrogen',
    videoMetadata: {
      fileName: 'commute-reel.mp4',
      fileSizeBytes: 2_000_000,
      mimeType: 'video/mp4',
      durationSeconds: 24,
    },
    context: {
      targetPersona: 'Gen Z Consumers',
      campaignObjective: 'Brand Awareness',
    },
    executiveSummary: 'Effective Reel with strong entertainment and relatable storytelling.',
    overallScore,
    scoreTier: getScoreTier(overallScore),
    variables,
    brandEngagementSummary: computeEngagementSummary(variables),
    strengths: ['Entertainment Content (4.33) and Relatable Content (4.33) drive strong reactions.'],
    areasForImprovement: ['Trendiness Participation (3) offers limited co-creation opportunities.'],
    developmentRecommendations: [
      {
        priority: 'High',
        targetVariable: 'Trendiness',
        targetDimension: 'Participation',
        recommendation: 'Add a remix or comment challenge prompt at 0:15.',
        expectedImpact: 'Raises Trendiness Participation from 3 to 4–5.',
      },
    ],
    predictedAudienceResponse: [
      {
        segment: 'Gen Z Consumers',
        predictedSentiment: 'Highly Receptive',
        responseSummary: 'Relatable commute situation encourages tagging peers.',
        likelyAction: 'Share via DM',
      },
    ],
    marketingStrategyRecommendations: [
      {
        pillar: 'Relatability Amplification',
        recommendation: 'Keep relatable narrative hooks (r=0.554 Moderate).',
        researchRationale: 'Relatable Content shows the strongest brand engagement correlation in the rubric study.',
        executionStep: 'Create a 3-part commuter series.',
      },
    ],
  };

  const md = buildReportMarkdown(sample);
  assert.match(md, /^# ReeView — Reels Marketing Content Effectiveness Assessment/);
  assert.match(md, /Overall Effectiveness Score: 16\.33 \/ 20 — Effective/);
  assert.match(md, /Informational Content \| 4 \| 4 \| 4 \| 4\.00 \| Effective/);
  assert.match(md, /Entertainment Content \| 5 \| 4 \| 4 \| 4\.33 \| Very Effective/);
  assert.match(md, /not proof of causal effects on actual consumer behavior/);
});

test('parseEvaluationApiResponse diagnoses status 200 HTML/empty/malformed and valid JSON responses', () => {
  const htmlRes = parseEvaluationApiResponse({
    ok: true,
    status: 200,
    contentType: 'text/html; charset=utf-8',
    redirected: true,
    rawBody: '<!doctype html><html><body>Auth</body></html>',
  });
  assert.equal(htmlRes.ok, false);
  if (htmlRes.ok === false) {
    assert.equal(htmlRes.error.code, 'SESSION_OR_PROXY_HTML');
  }

  const emptyRes = parseEvaluationApiResponse({
    ok: true,
    status: 200,
    contentType: 'application/json',
    redirected: false,
    rawBody: '',
  });
  assert.equal(emptyRes.ok, false);
  if (emptyRes.ok === false) {
    assert.match(emptyRes.error.message, /empty response \(HTTP 200\)/);
  }

  const apiErrRes = parseEvaluationApiResponse({
    ok: false,
    status: 401,
    contentType: 'application/json',
    redirected: false,
    rawBody: JSON.stringify({
      error: { code: 'INVALID_API_KEY', message: 'Invalid key' },
    }),
  });
  assert.equal(apiErrRes.ok, false);
  if (apiErrRes.ok === false) {
    assert.equal(apiErrRes.error.code, 'INVALID_API_KEY');
  }
});
