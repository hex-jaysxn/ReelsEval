import type {
  BrandEngagementScores,
  ReelEvaluation,
  ReelsMarketingScores,
} from '../types/evaluation.ts';

export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
  'video/mpeg',
] as const;

export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.mpeg', '.mpg'] as const;

// Optimized for Gemini API Free Tier limits (keeps payload & processing reliable)
export const MAX_VIDEO_SIZE_BYTES = 45 * 1024 * 1024; // 45 MB
export const INLINE_THRESHOLD_BYTES = 14 * 1024 * 1024; // 14 MB (base64 stays < 20 MB request ceiling)

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

  if (normalizedType && !normalizedType.startsWith('video/') && normalizedType !== 'application/octet-stream') {
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

export function clampScore(value: number, max = 5): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(max, value));
  // Round to nearest 0.5 for crisp rubric scoring
  return Math.round(clamped * 2) / 2;
}

export function computeOverallScore(scores: ReelsMarketingScores): number {
  const sum =
    clampScore(scores.relatedContent.score) +
    clampScore(scores.entertainmentContent.score) +
    clampScore(scores.informational.score) +
    clampScore(scores.trendiness.score);
  return Math.round(sum * 10) / 10;
}

export function computeEngagementSummary(scores: BrandEngagementScores): {
  totalOutOf15: number;
  percentage: number;
  dominantDriver: string;
} {
  const interaction = clampScore(scores.interaction.score);
  const sharing = clampScore(scores.sharing.score);
  const participation = clampScore(scores.participation.score);
  const totalOutOf15 = Math.round((interaction + sharing + participation) * 10) / 10;
  const percentage = Math.round((totalOutOf15 / 15) * 100);

  const pairs = [
    { label: 'Interaction', value: interaction },
    { label: 'Sharing', value: sharing },
    { label: 'Participation', value: participation },
  ];
  pairs.sort((a, b) => b.value - a.value);

  return {
    totalOutOf15,
    percentage,
    dominantDriver: pairs[0].label,
  };
}

export function getScoreTier(overallScore: number): ReelEvaluation['scoreTier'] {
  if (overallScore >= 17) {
    return {
      label: 'High Viral & Brand Impact',
      summary:
        'Strong alignment across relevance, entertainment pacing, informational clarity, and trend resonance.',
      tone: 'positive',
    };
  }
  if (overallScore >= 13) {
    return {
      label: 'Strong Performance',
      summary:
        'Solid short-form marketing foundation with targeted optimization opportunities to maximize reach.',
      tone: 'moderate',
    };
  }
  if (overallScore >= 9) {
    return {
      label: 'Moderate Potential',
      summary:
        'Core message is present, but hook pacing, trend alignment, or engagement triggers need refinement.',
      tone: 'caution',
    };
  }
  return {
    label: 'Needs Restructuring',
    summary:
      'Significant gaps in short-form storytelling, audience relevance, or clear value delivery.',
    tone: 'critical',
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
    reelsMarketingScores,
    brandEngagementScores,
    brandEngagementSummary,
    executiveSummary,
    strengths,
    weaknesses,
    improvementRecommendations,
    predictedAudienceResponse,
    marketingStrategyRecommendations,
    researchRecommendations,
    createdAt,
    modelUsed,
  } = evaluation;

  const lines: string[] = [
    `# ReelsEvaluator — Marketing Video Evaluation Report`,
    ``,
    `- **Video File:** ${videoMetadata.fileName}`,
    `- **File Size:** ${formatBytes(videoMetadata.fileSizeBytes)}`,
    `- **Duration:** ${formatDuration(videoMetadata.durationSeconds)}`,
    `- **Target Persona:** ${context.targetPersona}`,
    `- **Campaign Objective:** ${context.campaignObjective}`,
    `- **Evaluated At:** ${new Date(createdAt).toLocaleString()}`,
    `- **Model:** ${modelUsed} (Google Gemini API Free Tier)`,
    ``,
    `## Overall Score: ${overallScore} / 20 — ${scoreTier.label}`,
    ``,
    `${executiveSummary}`,
    ``,
    `## Reels Marketing Content Breakdown (5 Points Each)`,
    ``,
    `| Variable | Score | Rationale |`,
    `| --- | --- | --- |`,
    `| Related Content | ${reelsMarketingScores.relatedContent.score} / 5 | ${reelsMarketingScores.relatedContent.rationale.replace(/\|/g, '/')} |`,
    `| Entertainment Content | ${reelsMarketingScores.entertainmentContent.score} / 5 | ${reelsMarketingScores.entertainmentContent.rationale.replace(/\|/g, '/')} |`,
    `| Informational | ${reelsMarketingScores.informational.score} / 5 | ${reelsMarketingScores.informational.rationale.replace(/\|/g, '/')} |`,
    `| Trendiness | ${reelsMarketingScores.trendiness.score} / 5 | ${reelsMarketingScores.trendiness.rationale.replace(/\|/g, '/')} |`,
    ``,
    `## Brand Engagement Characteristics (${brandEngagementSummary.totalOutOf15} / 15 · ${brandEngagementSummary.percentage}%)`,
    ``,
    `- **Interaction (${brandEngagementScores.interaction.score}/5):** ${brandEngagementScores.interaction.rationale}`,
    `- **Sharing (${brandEngagementScores.sharing.score}/5):** ${brandEngagementScores.sharing.rationale}`,
    `- **Participation (${brandEngagementScores.participation.score}/5):** ${brandEngagementScores.participation.rationale}`,
    ``,
    `## Key Strengths`,
    ...strengths.map((item) => `- ${item}`),
    ``,
    `## Key Weaknesses`,
    ...weaknesses.map((item) => `- ${item}`),
    ``,
    `## Specific Improvement Recommendations`,
    ...improvementRecommendations.map(
      (rec) =>
        `- **[${rec.priority} · ${rec.targetVariable}]** ${rec.recommendation} *(Expected Impact: ${rec.expectedImpact}${rec.timestampHint ? ` · Cue: ${rec.timestampHint}` : ''})*`
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
  ];

  return lines.join('\n');
}
