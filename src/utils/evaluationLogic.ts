import type {
  ApiErrorPayload,
  BrandEngagementDimensionSummary,
  EffectivenessLevel,
  ReelEvaluation,
  ReelsMarketingVariables,
  ReelsVariableKey,
  VariableAssessment,
} from '../types/evaluation.ts';

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
  'video/mpeg',
] as const;

export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.mpeg', '.mpg'] as const;

// Optimized for Gemini API Free Tier limits
export const MAX_VIDEO_SIZE_BYTES = 45 * 1024 * 1024; // 45 MB
export const INLINE_THRESHOLD_BYTES = 14 * 1024 * 1024; // 14 MB

export const MIN_DIMENSION_RATING = 2;
export const MAX_DIMENSION_RATING = 5;
export const MIN_OVERALL_SCORE = 8;
export const MAX_OVERALL_SCORE = 20;

export const STUDY_VARIABLE_META: Record<
  ReelsVariableKey,
  {
    code: string;
    label: string;
    surveyMean: number;
    correlationLabel: string;
  }
> = {
  informational: {
    code: 'A',
    label: 'Informational Content',
    surveyMean: 3.4,
    correlationLabel: '0.372 (Weak)',
  },
  entertainment: {
    code: 'B',
    label: 'Entertainment Content',
    surveyMean: 3.19,
    correlationLabel: '0.463 (Moderate)',
  },
  trendiness: {
    code: 'C',
    label: 'Trendiness',
    surveyMean: 3.43,
    correlationLabel: '0.306 (Weak)',
  },
  relatable: {
    code: 'D',
    label: 'Relatable Content',
    surveyMean: 3.31,
    correlationLabel: '0.554 (Moderate)',
  },
};

export interface VideoValidationInput {
  name: string;
  type: string;
  size: number;
}

export interface VideoValidationResult {
  valid: boolean;
  errorCode?: 'INVALID_FILE' | 'UNSUPPORTED_VIDEO' | 'FILE_TOO_LARGE';
  errorMessage?: string;
}

export function validateVideoMetadata(file: VideoValidationInput): VideoValidationResult {
  if (!file || !file.name) {
    return {
      valid: false,
      errorCode: 'INVALID_FILE',
      errorMessage: 'No video file was provided.',
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      errorCode: 'INVALID_FILE',
      errorMessage: 'The selected file is empty (0 bytes). Please choose a valid video.',
    };
  }

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      errorCode: 'FILE_TOO_LARGE',
      errorMessage: `Video is ${sizeMb} MB, which exceeds the 45 MB limit optimized for Gemini Free Tier video analysis.`,
    };
  }

  const normalizedType = (file.type || '').toLowerCase().split(';')[0].trim();
  const lowerName = file.name.toLowerCase();
  const hasAllowedExtension = ALLOWED_VIDEO_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const hasAllowedMime = (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(normalizedType);

  if (!hasAllowedMime && !hasAllowedExtension) {
    return {
      valid: false,
      errorCode: 'UNSUPPORTED_VIDEO',
      errorMessage:
        'Unsupported file format. Please upload an MP4, WebM, MOV, or M4V short-form video.',
    };
  }

  if (
    normalizedType &&
    !normalizedType.startsWith('video/') &&
    normalizedType !== 'application/octet-stream'
  ) {
    return {
      valid: false,
      errorCode: 'UNSUPPORTED_VIDEO',
      errorMessage: `File MIME type "${normalizedType}" is not a supported video format.`,
    };
  }

  return { valid: true };
}

export function resolveVideoMimeType(fileName: string, providedMime?: string): string {
  const normalized = (providedMime || '').toLowerCase().split(';')[0].trim();
  if (normalized && normalized.startsWith('video/')) {
    return normalized;
  }
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.m4v')) return 'video/x-m4v';
  if (lower.endsWith('.mpeg') || lower.endsWith('.mpg')) return 'video/mpeg';
  return 'video/mp4';
}

/**
 * PDF Scoring Guide: 5 - Very Effective | 4 - Effective | 3 - Moderately Effective | 2 - Less Effective
 */
export function clampDimensionRating(value: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return MIN_DIMENSION_RATING;
  }
  const clamped = Math.max(MIN_DIMENSION_RATING, Math.min(MAX_DIMENSION_RATING, value));
  return Math.round(clamped);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Formula for each variable: (Interaction + Participation + Sharing) / 3
 */
export function computeVariableAverage(
  interaction: number,
  participation: number,
  sharing: number
): number {
  const i = clampDimensionRating(interaction);
  const p = clampDimensionRating(participation);
  const s = clampDimensionRating(sharing);
  return round2((i + p + s) / 3);
}

/**
 * Section IV: Effectiveness interpretation per variable
 * 4.25–5.00: Very Effective
 * 3.50–4.24: Effective
 * 2.75–3.49: Moderately Effective
 * 2.00–2.74: Less Effective
 */
export function getVariableEffectiveness(averageScore: number): {
  level: EffectivenessLevel;
  interpretation: string;
} {
  if (averageScore >= 4.25) {
    return {
      level: 'Very Effective',
      interpretation:
        'The content characteristic is highly effective in encouraging brand engagement.',
    };
  }
  if (averageScore >= 3.5) {
    return {
      level: 'Effective',
      interpretation: 'The content characteristic is effective in encouraging brand engagement.',
    };
  }
  if (averageScore >= 2.75) {
    return {
      level: 'Moderately Effective',
      interpretation:
        'The content characteristic shows moderate effectiveness but needs improvement.',
    };
  }
  return {
    level: 'Less Effective',
    interpretation:
      'The content characteristic demonstrates limited effectiveness in encouraging brand engagement.',
  };
}

export function buildVariableAssessment(input: {
  key: ReelsVariableKey;
  interaction: { score: number; rationale: string };
  participation: { score: number; rationale: string };
  sharing: { score: number; rationale: string };
  observedCues: string[];
}): VariableAssessment {
  const meta = STUDY_VARIABLE_META[input.key];
  const iScore = clampDimensionRating(input.interaction.score);
  const pScore = clampDimensionRating(input.participation.score);
  const sScore = clampDimensionRating(input.sharing.score);
  const averageScore = computeVariableAverage(iScore, pScore, sScore);
  const eff = getVariableEffectiveness(averageScore);

  return {
    key: input.key,
    label: meta.label,
    surveyMean: meta.surveyMean,
    correlationLabel: meta.correlationLabel,
    interaction: {
      score: iScore,
      rationale: input.interaction.rationale || '',
    },
    participation: {
      score: pScore,
      rationale: input.participation.rationale || '',
    },
    sharing: {
      score: sScore,
      rationale: input.sharing.rationale || '',
    },
    averageScore,
    effectivenessLevel: eff.level,
    effectivenessInterpretation: eff.interpretation,
    observedCues: Array.isArray(input.observedCues) ? input.observedCues : [],
  };
}

/**
 * Formula for overall assessment: Informational + Entertainment + Trendiness + Relatable
 * Range: 8.00 to 20.00
 */
export function computeOverallScore(variables: ReelsMarketingVariables): number {
  const total =
    variables.informational.averageScore +
    variables.entertainment.averageScore +
    variables.trendiness.averageScore +
    variables.relatable.averageScore;
  return round2(Math.max(MIN_OVERALL_SCORE, Math.min(MAX_OVERALL_SCORE, total)));
}

/**
 * Section V: Overall Reels Marketing Content Effectiveness
 * 17.00–20.00: Very Effective
 * 14.00–16.99: Effective
 * 11.00–13.99: Moderately Effective
 *  8.00–10.99: Less Effective
 */
export function getScoreTier(overallScore: number): ReelEvaluation['scoreTier'] {
  if (overallScore >= 17) {
    return {
      level: 'Very Effective',
      summary:
        'The Reel effectively incorporates all four characteristics and demonstrates strong potential to encourage brand engagement.',
      tone: 'positive',
    };
  }
  if (overallScore >= 14) {
    return {
      level: 'Effective',
      summary:
        'The Reel demonstrates good effectiveness in encouraging brand engagement through its content characteristics.',
      tone: 'moderate',
    };
  }
  if (overallScore >= 11) {
    return {
      level: 'Moderately Effective',
      summary:
        'The Reel shows moderate effectiveness but requires improvement in some content characteristics.',
      tone: 'caution',
    };
  }
  return {
    level: 'Less Effective',
    summary:
      'The Reel demonstrates limited effectiveness and requires significant improvement in its content characteristics.',
    tone: 'critical',
  };
}

export function computeEngagementSummary(
  variables: ReelsMarketingVariables
): BrandEngagementDimensionSummary {
  const list = [
    variables.informational,
    variables.entertainment,
    variables.trendiness,
    variables.relatable,
  ];
  const interactionMean = round2(list.reduce((acc, v) => acc + v.interaction.score, 0) / 4);
  const participationMean = round2(list.reduce((acc, v) => acc + v.participation.score, 0) / 4);
  const sharingMean = round2(list.reduce((acc, v) => acc + v.sharing.score, 0) / 4);
  const overallEngagementMean = round2(
    (interactionMean + participationMean + sharingMean) / 3
  );

  const ranked: { label: 'Interaction' | 'Participation' | 'Sharing'; value: number }[] = [
    { label: 'Interaction', value: interactionMean },
    { label: 'Participation', value: participationMean },
    { label: 'Sharing', value: sharingMean },
  ];
  ranked.sort((a, b) => b.value - a.value);

  return {
    interactionMean,
    participationMean,
    sharingMean,
    overallEngagementMean,
    dominantDriver: ranked[0].label,
    lowestDriver: ranked[ranked.length - 1].label,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null || Number.isNaN(seconds) || seconds <= 0) {
    return 'Unknown';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function buildReportMarkdown(evaluation: ReelEvaluation): string {
  const {
    videoMetadata,
    context,
    overallScore,
    scoreTier,
    variables,
    brandEngagementSummary,
    executiveSummary,
    strengths,
    areasForImprovement,
    developmentRecommendations,
    predictedAudienceResponse,
    marketingStrategyRecommendations,
    researchRecommendations,
    createdAt,
    modelUsed,
  } = evaluation;

  const varList = [
    variables.informational,
    variables.entertainment,
    variables.trendiness,
    variables.relatable,
  ];

  const lines: string[] = [
    `# ReelsEvaluator — Reels Marketing Content Effectiveness Assessment`,
    ``,
    `- **Video File:** ${videoMetadata.fileName}`,
    `- **File Size:** ${formatBytes(videoMetadata.fileSizeBytes)}`,
    `- **Duration:** ${formatDuration(videoMetadata.durationSeconds)}`,
    `- **Target Persona:** ${context.targetPersona}`,
    `- **Campaign Objective:** ${context.campaignObjective}`,
    `- **Evaluated At:** ${new Date(createdAt).toLocaleString()}`,
    `- **Model:** ${modelUsed} (Google Gemini API Free Tier)`,
    ``,
    `## Overall Effectiveness Score: ${overallScore.toFixed(2)} / 20 — ${scoreTier.level}`,
    ``,
    `${executiveSummary}`,
    ``,
    `*${scoreTier.summary}*`,
    ``,
    `## Scoring & Computation Matrix (2–5 Rating Scale)`,
    ``,
    `| Reels Marketing Content Variable | Interaction | Participation | Sharing | Average | Effectiveness Level | Survey Mean & Correlation |`,
    `| --- | ---: | ---: | ---: | ---: | --- | --- |`,
    ...varList.map(
      (v) =>
        `| ${v.label} | ${v.interaction.score} | ${v.participation.score} | ${v.sharing.score} | ${v.averageScore.toFixed(2)} | ${v.effectivenessLevel} | Mean ${v.surveyMean.toFixed(2)} · r=${v.correlationLabel} |`
    ),
    `| **Total Overall Score** | **Mean ${brandEngagementSummary.interactionMean.toFixed(2)}** | **Mean ${brandEngagementSummary.participationMean.toFixed(2)}** | **Mean ${brandEngagementSummary.sharingMean.toFixed(2)}** | **${overallScore.toFixed(2)} / 20** | **${scoreTier.level}** | — |`,
    ``,
    `## Strengths`,
    ...strengths.map((item) => `- ${item}`),
    ``,
    `## Areas for Improvement (Lowest-Scoring Characteristics & Dimensions)`,
    ...areasForImprovement.map((item) => `- ${item}`),
    ``,
    `## Development Recommendations`,
    ...developmentRecommendations.map(
      (rec) =>
        `- **[${rec.priority} · ${rec.targetVariable} · ${rec.targetDimension}]** ${rec.recommendation} *(Expected Impact: ${rec.expectedImpact}${rec.timestampHint ? ` · Cue: ${rec.timestampHint}` : ''})*`
    ),
    ``,
    `## Predicted Audience Response`,
    ...predictedAudienceResponse.map(
      (aud) =>
        `- **${aud.segment} (${aud.predictedSentiment}):** ${aud.responseSummary} *Likely Action: ${aud.likelyAction}*`
    ),
    ``,
    `## Marketing Strategy Recommendations`,
    ...marketingStrategyRecommendations.map(
      (st) =>
        `- **${st.pillar}:** ${st.recommendation} — *Research Rationale:* ${st.researchRationale} *Next Step:* ${st.executionStep}`
    ),
    ``,
    `## Research Recommendations`,
    ...researchRecommendations.map((r) => `- ${r}`),
    ``,
    `---`,
    `*Methodological Note: The rubric evaluates the content's demonstrated characteristics and its potential to encourage Interaction, Participation, and Sharing. The effectiveness levels are assessment classifications developed from the study's findings, not proof of causal effects on actual consumer behavior.*`,
    ``,
  ];

  return lines.join('\n');
}

export type ParsedEvaluationResponse =
  | { ok: true; evaluation: ReelEvaluation }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        retryAfterSeconds?: number;
      };
    };

export function parseEvaluationApiResponse(params: {
  ok: boolean;
  status: number;
  contentType?: string | null;
  redirected?: boolean;
  rawBody: string;
}): ParsedEvaluationResponse {
  const { ok, status, contentType, redirected, rawBody } = params;
  const trimmed = (rawBody || '').trim();
  const normalizedType = (contentType || '').toLowerCase();
  const looksLikeHtml =
    normalizedType.includes('text/html') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html');

  let parsed: { evaluation?: ReelEvaluation } | ApiErrorPayload | null = null;
  if (trimmed && !looksLikeHtml) {
    try {
      parsed = JSON.parse(trimmed) as { evaluation?: ReelEvaluation } | ApiErrorPayload;
    } catch {
      parsed = null;
    }
  }

  if (ok && parsed && 'evaluation' in parsed && parsed.evaluation) {
    return { ok: true, evaluation: parsed.evaluation };
  }

  if (parsed && 'error' in parsed && parsed.error) {
    return { ok: false, error: parsed.error };
  }

  if (looksLikeHtml || (redirected && !parsed)) {
    return {
      ok: false,
      error: {
        code: 'SESSION_OR_PROXY_HTML',
        message:
          'The evaluation endpoint returned an HTML page instead of a JSON response (usually caused by an expired preview session after updating Secrets or an auth/proxy redirect). Please refresh the page and try analyzing again.',
      },
    };
  }

  if (!trimmed) {
    return {
      ok: false,
      error: {
        code: 'ANALYSIS_FAILED',
        message: `The evaluation server returned an empty response (HTTP ${status}). Please retry the analysis.`,
      },
    };
  }

  return {
    ok: false,
    error: {
      code: 'ANALYSIS_FAILED',
      message: `Unexpected response format from evaluation server (HTTP ${status}). Please refresh the page and retry.`,
    },
  };
}

