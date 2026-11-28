import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_SCOPE_VALIDATION_MESSAGE,
  MAX_VIDEO_SIZE_BYTES,
  buildReportMarkdown,
  buildVariableAssessment,
  clampDimensionRating,
  computeEngagementSummary,
  computeOverallScore,
  computeSelectedCharacteristicsAverage,
  computeVariableAverage,
  createFullEvaluationScope,
  getScoreTier,
  getVariableEffectiveness,
  isFullEvaluation,
  normalizeEvaluationScope,
  parseEvaluationApiResponse,
  parseEvaluationScopePayload,
  resolveEvaluationScope,
  resolveVideoMimeType,
  sanitizeEvaluationByScope,
  toggleEvaluationVariable,
  validateEvaluationScope,
  validateVideoMetadata,
} from './evaluationLogic.ts';
import { buildEvaluationPromptAndSchema } from '../server/geminiService.ts';
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

test('selective evaluation scope helpers handle defaults, toggling, canonical ordering, and empty validation', () => {
  const full = createFullEvaluationScope();
  assert.deepEqual(full.selectedVariables, [
    'informational',
    'entertainment',
    'trendiness',
    'relatable',
  ]);
  assert.equal(full.fullEvaluation, true);

  // Deselecting 1 from Full Evaluation turns off fullEvaluation and keeps remaining 3
  const afterDeselectOne = toggleEvaluationVariable(full, 'relatable');
  assert.equal(afterDeselectOne.fullEvaluation, false);
  assert.deepEqual(afterDeselectOne.selectedVariables, [
    'informational',
    'entertainment',
    'trendiness',
  ]);

  // Re-selecting the 4th automatically marks fullEvaluation: true
  const afterReselect = toggleEvaluationVariable(afterDeselectOne, 'relatable');
  assert.equal(afterReselect.fullEvaluation, true);
  assert.equal(afterReselect.selectedVariables.length, 4);

  // Empty selection fails with exact validation message
  const emptyCheck = validateEvaluationScope({ selectedVariables: [], fullEvaluation: false });
  assert.equal(emptyCheck.valid, false);
  assert.equal(emptyCheck.errorMessage, EMPTY_SCOPE_VALIDATION_MESSAGE);

  // Payload parser accepts both selectedVariables and variables alias, and rejects empty array
  const aliasParsed = parseEvaluationScopePayload(
    JSON.stringify({ variables: ['relatable', 'entertainment', 'relatable'], fullEvaluation: false })
  );
  assert.equal(aliasParsed.valid, true);
  assert.deepEqual(aliasParsed.scope, {
    selectedVariables: ['entertainment', 'relatable'],
    fullEvaluation: false,
  });

  const emptyPayload = parseEvaluationScopePayload(
    JSON.stringify({ selectedVariables: [], fullEvaluation: false })
  );
  assert.equal(emptyPayload.valid, false);
  assert.equal(emptyPayload.errorMessage, EMPTY_SCOPE_VALIDATION_MESSAGE);

  const normalizedMixed = normalizeEvaluationScope({
    selectedVariables: ['trendiness', 'entertainment'],
    fullEvaluation: true,
  });
  assert.equal(normalizedMixed.fullEvaluation, false);
});

test('partial evaluations (1, 2, 3 variables) strip unselected fields and omit /20 official score', () => {
  const informational = buildVariableAssessment({
    key: 'informational',
    interaction: { score: 4, rationale: 'Good.' },
    participation: { score: 4, rationale: 'Good.' },
    sharing: { score: 4, rationale: 'Good.' },
    observedCues: ['Specs'],
  });
  const entertainment = buildVariableAssessment({
    key: 'entertainment',
    interaction: { score: 4, rationale: 'Fun.' },
    participation: { score: 5, rationale: 'Challenge.' },
    sharing: { score: 4, rationale: 'Shareable.' },
    observedCues: ['Hook'],
  });
  const trendiness = buildVariableAssessment({
    key: 'trendiness',
    interaction: { score: 4, rationale: 'Current.' },
    participation: { score: 3, rationale: 'Moderate.' },
    sharing: { score: 4, rationale: 'Popular.' },
    observedCues: ['Audio'],
  });
  const relatable = buildVariableAssessment({
    key: 'relatable',
    interaction: { score: 4, rationale: 'Familiar.' },
    participation: { score: 3, rationale: 'Some prompts.' },
    sharing: { score: 4, rationale: 'Relatable.' },
    observedCues: ['Scene'],
  });

  // Scenario 1: 1 variable (Entertainment only) with rogue AI field present
  const singleEval = sanitizeEvaluationByScope({
    schemaVersion: 2,
    id: 'single-1',
    createdAt: '2026-11-28T00:00:00.000Z',
    modelUsed: 'gemini-4-hydrogen',
    videoMetadata: { fileName: 'fun.mp4', fileSizeBytes: 1_000_000, mimeType: 'video/mp4' },
    context: { targetPersona: 'Gen Z Consumers', campaignObjective: 'Brand Awareness' },
    evaluationScope: { selectedVariables: ['entertainment'], fullEvaluation: false },
    executiveSummary: 'Strong entertainment hook.',
    overallScore: 15, // Should be wiped to null!
    scoreTier: getScoreTier(15), // Should be wiped to null!
    variables: { entertainment, informational }, // informational should be stripped!
    brandEngagementSummary: computeEngagementSummary({ entertainment }),
    strengths: ['Entertaining opening'],
    areasForImprovement: ['Slightly sharper punchline'],
    developmentRecommendations: [
      {
        priority: 'High',
        targetVariable: 'Entertainment Content',
        targetDimension: 'Interaction',
        recommendation: 'Tighten beat timing.',
        expectedImpact: 'Boosts reactions.',
      },
      {
        priority: 'Low',
        targetVariable: 'Informational Content', // Unselected: must be stripped!
        targetDimension: 'Sharing',
        recommendation: 'Add specs.',
        expectedImpact: 'More saves.',
      },
    ],
    predictedAudienceResponse: [],
    marketingStrategyRecommendations: [],
  });

  assert.equal(isFullEvaluation(singleEval), false);
  assert.equal(singleEval.overallScore, null);
  assert.equal(singleEval.scoreTier, null);
  assert.equal(singleEval.selectedAverageScore, 4.33);
  assert.equal(singleEval.selectedEffectivenessLevel, 'Very Effective');
  assert.equal(singleEval.variables.entertainment?.averageScore, 4.33);
  assert.equal(singleEval.variables.informational, undefined);
  assert.equal(singleEval.developmentRecommendations.length, 1);
  assert.equal(singleEval.developmentRecommendations[0].targetVariable, 'Entertainment Content');

  const singleMd = buildReportMarkdown(singleEval);
  assert.match(singleMd, /1 of 4 content characteristics evaluated/);
  assert.match(singleMd, /Selected Characteristics Average: 4\.33 \/ 5\.00/);
  assert.doesNotMatch(singleMd, /\/ 20/);

  // Scenario 2: 2 variables (Entertainment 4.33 + Relatable 3.67 => 4.00)
  const twoVarAvg = computeSelectedCharacteristicsAverage(
    { entertainment, relatable },
    ['entertainment', 'relatable']
  );
  assert.equal(twoVarAvg, 4.0);
  const twoSummary = computeEngagementSummary(
    { entertainment, relatable },
    ['entertainment', 'relatable']
  );
  assert.equal(twoSummary.interactionMean, 4.0);
  assert.equal(twoSummary.participationMean, 4.0);
  assert.equal(twoSummary.sharingMean, 4.0);

  // Scenario 3: 3 variables (Informational 4.00 + Entertainment 4.33 + Trendiness 3.67 => 4.00)
  const threeVarAvg = computeSelectedCharacteristicsAverage(
    { informational, entertainment, trendiness },
    ['informational', 'entertainment', 'trendiness']
  );
  assert.equal(threeVarAvg, 4.0);

  // Legacy Full Evaluation compatibility (no evaluationScope property)
  const legacyFull: ReelEvaluation = {
    schemaVersion: 2,
    id: 'legacy-1',
    createdAt: '2026-11-23T00:00:00.000Z',
    modelUsed: 'gemini-4-hydrogen',
    videoMetadata: { fileName: 'legacy.mp4', fileSizeBytes: 1_000_000, mimeType: 'video/mp4' },
    context: { targetPersona: 'General Audience', campaignObjective: 'Brand Awareness' },
    executiveSummary: 'Full legacy evaluation.',
    overallScore: computeOverallScore({ informational, entertainment, trendiness, relatable }),
    scoreTier: getScoreTier(15.67),
    variables: { informational, entertainment, trendiness, relatable },
    brandEngagementSummary: computeEngagementSummary({
      informational,
      entertainment,
      trendiness,
      relatable,
    }),
    strengths: [],
    areasForImprovement: [],
    developmentRecommendations: [],
    predictedAudienceResponse: [],
    marketingStrategyRecommendations: [],
  };
  assert.deepEqual(resolveEvaluationScope(legacyFull), createFullEvaluationScope());
  assert.equal(isFullEvaluation(legacyFull), true);
});

test('buildEvaluationPromptAndSchema dynamically restricts prompt rubric and JSON schema per selected scope', () => {
  const ctx = {
    targetPersona: 'Gen Z Consumers' as const,
    campaignObjective: 'Brand Awareness' as const,
  };

  // 1 variable: Entertainment
  const oneVar = buildEvaluationPromptAndSchema({
    evaluationScope: { selectedVariables: ['entertainment'], fullEvaluation: false },
    context: ctx,
    videoMetadata: { fileName: 'clip.mp4' },
  });
  assert.match(oneVar.systemInstruction, /B\. ENTERTAINMENT CONTENT/);
  assert.doesNotMatch(oneVar.systemInstruction, /A\. INFORMATIONAL CONTENT/);
  assert.doesNotMatch(oneVar.systemInstruction, /C\. TRENDINESS/);
  assert.doesNotMatch(oneVar.systemInstruction, /D\. RELATABLE CONTENT/);
  assert.match(oneVar.systemInstruction, /Evaluate ONLY Entertainment Content/);
  assert.deepEqual(oneVar.responseSchema.properties.variables.required, ['entertainment']);
  assert.deepEqual(Object.keys(oneVar.responseSchema.properties.variables.properties), [
    'entertainment',
  ]);
  assert.deepEqual(
    oneVar.responseSchema.properties.developmentRecommendations.items.properties.targetVariable.enum,
    ['Entertainment Content']
  );

  // 2 variables: Entertainment + Relatable
  const twoVar = buildEvaluationPromptAndSchema({
    evaluationScope: { selectedVariables: ['entertainment', 'relatable'], fullEvaluation: false },
    context: ctx,
    videoMetadata: { fileName: 'clip.mp4' },
  });
  assert.deepEqual(twoVar.responseSchema.properties.variables.required, [
    'entertainment',
    'relatable',
  ]);
  assert.match(twoVar.systemInstruction, /B\. ENTERTAINMENT CONTENT/);
  assert.match(twoVar.systemInstruction, /D\. RELATABLE CONTENT/);
  assert.doesNotMatch(twoVar.systemInstruction, /A\. INFORMATIONAL CONTENT/);
  assert.doesNotMatch(twoVar.systemInstruction, /C\. TRENDINESS/);

  // 3 variables: Informational + Entertainment + Trendiness
  const threeVar = buildEvaluationPromptAndSchema({
    evaluationScope: {
      selectedVariables: ['informational', 'entertainment', 'trendiness'],
      fullEvaluation: false,
    },
    context: ctx,
    videoMetadata: { fileName: 'clip.mp4' },
  });
  assert.deepEqual(threeVar.responseSchema.properties.variables.required, [
    'informational',
    'entertainment',
    'trendiness',
  ]);
  assert.doesNotMatch(threeVar.systemInstruction, /D\. RELATABLE CONTENT/);

  // 4 variables: Full Evaluation
  const fullVar = buildEvaluationPromptAndSchema({
    evaluationScope: createFullEvaluationScope(),
    context: ctx,
    videoMetadata: { fileName: 'clip.mp4' },
  });
  assert.deepEqual(fullVar.responseSchema.properties.variables.required, [
    'informational',
    'entertainment',
    'trendiness',
    'relatable',
  ]);
  assert.match(fullVar.systemInstruction, /A\. INFORMATIONAL CONTENT/);
  assert.match(fullVar.systemInstruction, /B\. ENTERTAINMENT CONTENT/);
  assert.match(fullVar.systemInstruction, /C\. TRENDINESS/);
  assert.match(fullVar.systemInstruction, /D\. RELATABLE CONTENT/);

  // Empty selection throws validation error
  assert.throws(
    () =>
      buildEvaluationPromptAndSchema({
        evaluationScope: { selectedVariables: [], fullEvaluation: false },
        context: ctx,
        videoMetadata: { fileName: 'clip.mp4' },
      }),
    /Please select at least one content characteristic to evaluate\./
  );
});
