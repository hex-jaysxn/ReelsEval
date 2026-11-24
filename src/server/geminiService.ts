import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AudienceSegmentPrediction,
  BrandEngagementScores,
  EvaluationContext,
  ImprovementRecommendation,
  MarketingStrategyItem,
  ReelEvaluation,
  ReelsMarketingScores,
  ReelVideoMetadata,
} from '../types/evaluation.ts';
import {
  INLINE_THRESHOLD_BYTES,
  clampScore,
  computeEngagementSummary,
  computeOverallScore,
  getScoreTier,
} from '../utils/evaluationLogic.ts';

export const GEMINI_FREE_TIER_MODEL = 'gemini-4-hydrogen';
export const GEMINI_FREE_TIER_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

export class GeminiServiceError extends Error {
  statusCode: number;
  errorCode:
    | 'RATE_LIMIT'
    | 'INVALID_API_KEY'
    | 'UNSUPPORTED_VIDEO'
    | 'MODEL_UNAVAILABLE'
    | 'ANALYSIS_FAILED';
  retryAfterSeconds?: number;

  constructor(
    message: string,
    statusCode: number,
    errorCode:
      | 'RATE_LIMIT'
      | 'INVALID_API_KEY'
      | 'UNSUPPORTED_VIDEO'
      | 'MODEL_UNAVAILABLE'
      | 'ANALYSIS_FAILED',
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = 'GeminiServiceError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const categoryDetailSchema = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.NUMBER,
      description: 'Score from 0 to 5 in 0.5 increments (e.g., 0, 1.5, 3, 4.5, 5).',
    },
    rationale: {
      type: Type.STRING,
      description: 'Concise 1-2 sentence evidence-based justification referencing what happens in the video.',
    },
    observedCues: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2-3 specific visual, audio, text-overlay, or pacing cues observed in the video.',
    },
  },
  required: ['score', 'rationale', 'observedCues'],
};

const evaluationResponseSchema = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: {
      type: Type.STRING,
      description: '2-3 sentence executive summary of the Reel marketing effectiveness and engagement potential.',
    },
    reelsMarketingScores: {
      type: Type.OBJECT,
      properties: {
        relatedContent: {
          ...categoryDetailSchema,
          description: 'Relevance of content to target audience, brand story, and niche context (0-5).',
        },
        entertainmentContent: {
          ...categoryDetailSchema,
          description: 'Hook strength, pacing, storytelling, visual/audio appeal, and retention (0-5).',
        },
        informational: {
          ...categoryDetailSchema,
          description: 'Clarity of value proposition, educational utility, and actionable takeaways (0-5).',
        },
        trendiness: {
          ...categoryDetailSchema,
          description: 'Alignment with current short-form formats, audio trends, editing cadence, and cultural hooks (0-5).',
        },
      },
      required: ['relatedContent', 'entertainmentContent', 'informational', 'trendiness'],
    },
    brandEngagementScores: {
      type: Type.OBJECT,
      properties: {
        interaction: {
          ...categoryDetailSchema,
          description: 'Likelihood of driving likes, comments, saves, and direct conversation triggers (0-5).',
        },
        sharing: {
          ...categoryDetailSchema,
          description: 'Likelihood of viewers sharing via DM, reposting, or sending to peers (0-5).',
        },
        participation: {
          ...categoryDetailSchema,
          description: 'Likelihood of prompting remixes, stitches, challenges, UGC, or CTA action (0-5).',
        },
      },
      required: ['interaction', 'sharing', 'participation'],
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3-5 concrete strengths observed in the video.',
    },
    weaknesses: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3-5 concrete weaknesses or missed opportunities observed in the video.',
    },
    improvementRecommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          priority: {
            type: Type.STRING,
            description: 'Must be High, Medium, or Low.',
          },
          targetVariable: {
            type: Type.STRING,
            description:
              'One of: Related Content, Entertainment Content, Informational, Trendiness, Interaction, Sharing, Participation.',
          },
          recommendation: {
            type: Type.STRING,
            description: 'Specific, actionable edit or creative change.',
          },
          expectedImpact: {
            type: Type.STRING,
            description: 'Expected lift in retention, engagement, or conversion.',
          },
          timestampHint: {
            type: Type.STRING,
            description: 'Timestamp or video segment reference (e.g., 0:00-0:03 Hook).',
          },
        },
        required: ['priority', 'targetVariable', 'recommendation', 'expectedImpact'],
      },
    },
    predictedAudienceResponse: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          segment: {
            type: Type.STRING,
            description:
              'Must cover each of: Business Owners, Gen Z Consumers, Social Media Content Creators, Marketing Professionals.',
          },
          predictedSentiment: {
            type: Type.STRING,
            description: 'Must be one of: Highly Receptive, Moderately Receptive, Mixed, Low Resonance.',
          },
          responseSummary: {
            type: Type.STRING,
            description: 'How this audience segment is likely to perceive and react to the Reel.',
          },
          likelyAction: {
            type: Type.STRING,
            description: 'Most probable behavioral action (e.g. DM share, skip at 3s, bookmark for reference).',
          },
        },
        required: ['segment', 'predictedSentiment', 'responseSummary', 'likelyAction'],
      },
    },
    marketingStrategyRecommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          pillar: { type: Type.STRING },
          recommendation: { type: Type.STRING },
          researchRationale: { type: Type.STRING },
          executionStep: { type: Type.STRING },
        },
        required: ['pillar', 'recommendation', 'researchRationale', 'executionStep'],
      },
    },
    researchRecommendations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '3-4 research experiments, A/B tests, or KPI measurement recommendations.',
    },
  },
  required: [
    'executiveSummary',
    'reelsMarketingScores',
    'brandEngagementScores',
    'strengths',
    'weaknesses',
    'improvementRecommendations',
    'predictedAudienceResponse',
    'marketingStrategyRecommendations',
    'researchRecommendations',
  ],
};

function mapUpstreamError(err: unknown): GeminiServiceError {
  if (err instanceof GeminiServiceError) {
    return err;
  }

  const rawMessage = err instanceof Error ? err.message : String(err);
  const status =
    typeof (err as { status?: number })?.status === 'number'
      ? (err as { status: number }).status
      : undefined;

  const upper = rawMessage.toUpperCase();

  if (
    status === 429 ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('QUOTA') ||
    upper.includes('RATE LIMIT')
  ) {
    return new GeminiServiceError(
      'Google Gemini API Free Tier rate limit reached. Please wait ~30-60 seconds before running another video evaluation.',
      429,
      'RATE_LIMIT',
      45
    );
  }

  if (
    status === 401 ||
    status === 403 ||
    upper.includes('PERMISSION_DENIED') ||
    upper.includes('API_KEY_INVALID') ||
    upper.includes('API KEY')
  ) {
    return new GeminiServiceError(
      'Gemini API key is missing or invalid. Please configure a valid GEMINI_API_KEY in Settings > Secrets.',
      401,
      'INVALID_API_KEY'
    );
  }

  if (
    status === 400 ||
    upper.includes('INVALID_ARGUMENT') ||
    upper.includes('UNSUPPORTED') ||
    upper.includes('DECODE') ||
    upper.includes('MIME')
  ) {
    return new GeminiServiceError(
      'The uploaded video format or codec could not be processed by Gemini. Please try a standard H.264 MP4 or WebM clip.',
      415,
      'UNSUPPORTED_VIDEO'
    );
  }

  if (status === 404 || upper.includes('NOT_FOUND')) {
    return new GeminiServiceError(
      `The configured Gemini model (${GEMINI_FREE_TIER_MODEL}) was unavailable. Please try again shortly.`,
      502,
      'MODEL_UNAVAILABLE'
    );
  }

  if (status === 503 || upper.includes('HIGH DEMAND') || upper.includes('UNAVAILABLE')) {
    return new GeminiServiceError(
      'Google Gemini Free Tier is temporarily experiencing high demand. Please retry in a few seconds.',
      503,
      'MODEL_UNAVAILABLE',
      15
    );
  }

  return new GeminiServiceError(
    'Video analysis could not be completed. Please try again or use a shorter MP4/WebM clip.',
    502,
    'ANALYSIS_FAILED'
  );
}

function isTransientError(err: unknown): boolean {
  const status =
    typeof (err as { status?: number })?.status === 'number'
      ? (err as { status: number }).status
      : undefined;
  if (status === 503 || status === 500) return true;
  const msg = err instanceof Error ? err.message.toUpperCase() : '';
  return (
    msg.includes('503') ||
    msg.includes('HIGH DEMAND') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('UNAVAILABLE')
  );
}

async function waitMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePriority(val: string): 'High' | 'Medium' | 'Low' {
  const lower = (val || '').toLowerCase();
  if (lower.includes('high')) return 'High';
  if (lower.includes('low')) return 'Low';
  return 'Medium';
}

function normalizeSentiment(
  val: string
): AudienceSegmentPrediction['predictedSentiment'] {
  const lower = (val || '').toLowerCase();
  if (lower.includes('high')) return 'Highly Receptive';
  if (lower.includes('moderate')) return 'Moderately Receptive';
  if (lower.includes('low')) return 'Low Resonance';
  return 'Mixed';
}

function normalizeSegment(
  val: string,
  fallbackIndex: number
): AudienceSegmentPrediction['segment'] {
  const lower = (val || '').toLowerCase();
  if (lower.includes('business')) return 'Business Owners';
  if (lower.includes('gen z') || lower.includes('consumer')) return 'Gen Z Consumers';
  if (lower.includes('creator')) return 'Social Media Content Creators';
  if (lower.includes('market')) return 'Marketing Professionals';
  const order: AudienceSegmentPrediction['segment'][] = [
    'Business Owners',
    'Gen Z Consumers',
    'Social Media Content Creators',
    'Marketing Professionals',
  ];
  return order[fallbackIndex % order.length];
}

export async function evaluateReelWithGemini(params: {
  filePath: string;
  videoMetadata: ReelVideoMetadata;
  context: EvaluationContext;
}): Promise<ReelEvaluation> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new GeminiServiceError(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.',
      401,
      'INVALID_API_KEY'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const { filePath, videoMetadata, context } = params;
  const mimeType = videoMetadata.mimeType || 'video/mp4';

  const systemInstruction = `You are a senior short-form video marketing researcher and brand engagement analyst for ReelsEvaluator.
Analyze the uploaded Reels/short-form marketing video across TWO linked frameworks:
1. Characteristics of Reels Marketing Content (5 points max per variable, total 20):
   - Related Content (0-5): Audience & brand alignment, contextual relevance, niche fit.
   - Entertainment Content (0-5): 0-3s hook strength, pacing, storytelling, audio-visual craft, retention pull.
   - Informational (0-5): Value proposition clarity, educational/product utility, concrete takeaways.
   - Trendiness (0-5): Current short-form editing cadence, cultural/audio format fit, native platform feel.
2. Characteristics of Brand Engagement (5 points max per variable):
   - Interaction (0-5): Potential to trigger likes, comments, saves, and replies.
   - Sharing (0-5): DM shareability, social currency, peer-to-peer send potential.
   - Participation (0-5): Remix/duet/challenge/UGC potential and CTA conversion follow-through.

Be strictly grounded in what you actually see and hear in the video (visuals, captions, pacing, audio, CTAs). Avoid generic boilerplate. Keep all text concise, analytical, and directly actionable.`;

  const promptText = `Evaluate this short-form marketing Reel (${videoMetadata.fileName}).
Target Persona Focus: ${context.targetPersona}
Campaign Objective: ${context.campaignObjective}
${context.brandContext ? `Brand / Product Context: ${context.brandContext}` : ''}

Provide:
- Scores (0 to 5 in 0.5 increments) with concrete observed video cues for all 4 Reels Marketing Content variables and all 3 Brand Engagement variables.
- 3 to 5 specific Strengths and Weaknesses.
- Prioritized Improvement Recommendations with timestamp hints.
- Predicted Audience Response across all 4 core user groups: Business Owners, Gen Z Consumers, Social Media Content Creators, and Marketing Professionals.
- Marketing Strategy Recommendations and Research Recommendations (A/B tests and KPIs).`;

  let uploadedFileName: string | undefined;

  try {
    let mediaPart:
      | { inlineData: { mimeType: string; data: string } }
      | { fileData: { fileUri: string; mimeType: string } };

    if (videoMetadata.fileSizeBytes <= INLINE_THRESHOLD_BYTES) {
      const fileBuffer = await fs.readFile(filePath);
      mediaPart = {
        inlineData: {
          mimeType,
          data: fileBuffer.toString('base64'),
        },
      };
    } else {
      const uploaded = await ai.files.upload({
        file: filePath,
        config: { mimeType },
      });
      uploadedFileName = uploaded.name;

      let fileState = uploaded.state;
      let fileUri = uploaded.uri;
      const deadline = Date.now() + 60_000;

      while (fileState === 'PROCESSING') {
        if (Date.now() > deadline) {
          throw new GeminiServiceError(
            'Video processing timed out while preparing the file for Gemini analysis. Try a shorter or smaller clip.',
            504,
            'ANALYSIS_FAILED'
          );
        }
        await waitMs(2000);
        const current = await ai.files.get({ name: uploaded.name! });
        fileState = current.state;
        fileUri = current.uri;
      }

      if (fileState === 'FAILED' || !fileUri) {
        throw new GeminiServiceError(
          'Gemini could not decode the uploaded video file. Ensure it uses a standard MP4 or WebM codec.',
          415,
          'UNSUPPORTED_VIDEO'
        );
      }

      mediaPart = {
        fileData: {
          fileUri,
          mimeType,
        },
      };
    }

    let response;
    let modelUsed = GEMINI_FREE_TIER_MODEL;
    const candidateModels = [
      { model: GEMINI_FREE_TIER_MODEL, thinkingLevel: ThinkingLevel.LOW },
      { model: GEMINI_FREE_TIER_FALLBACK_MODEL, thinkingLevel: ThinkingLevel.MINIMAL },
    ];

    let lastErr: unknown;
    for (const candidate of candidateModels) {
      let attempt = 0;
      while (attempt < 2) {
        try {
          response = await ai.models.generateContent({
            model: candidate.model,
            contents: {
              parts: [mediaPart, { text: promptText }],
            },
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: evaluationResponseSchema,
              thinkingConfig: {
                thinkingLevel: candidate.thinkingLevel,
              },
            },
          });
          modelUsed = candidate.model;
          lastErr = undefined;
          break;
        } catch (err) {
          lastErr = err;
          if (attempt === 0 && isTransientError(err)) {
            attempt += 1;
            await waitMs(1200);
            continue;
          }
          break;
        }
      }
      if (response) break;
      if (!isTransientError(lastErr)) {
        throw lastErr;
      }
    }

    if (!response) {
      throw lastErr;
    }

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      throw new GeminiServiceError(
        'Gemini returned an empty response for this video.',
        502,
        'ANALYSIS_FAILED'
      );
    }

    let parsed: {
      executiveSummary: string;
      reelsMarketingScores: ReelsMarketingScores;
      brandEngagementScores: BrandEngagementScores;
      strengths: string[];
      weaknesses: string[];
      improvementRecommendations: ImprovementRecommendation[];
      predictedAudienceResponse: AudienceSegmentPrediction[];
      marketingStrategyRecommendations: MarketingStrategyItem[];
      researchRecommendations: string[];
    };

    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new GeminiServiceError(
        'Could not parse structured JSON evaluation from Gemini output.',
        502,
        'ANALYSIS_FAILED'
      );
    }

    const reelsMarketingScores: ReelsMarketingScores = {
      relatedContent: {
        score: clampScore(parsed.reelsMarketingScores?.relatedContent?.score),
        rationale: parsed.reelsMarketingScores?.relatedContent?.rationale || '',
        observedCues: parsed.reelsMarketingScores?.relatedContent?.observedCues || [],
      },
      entertainmentContent: {
        score: clampScore(parsed.reelsMarketingScores?.entertainmentContent?.score),
        rationale: parsed.reelsMarketingScores?.entertainmentContent?.rationale || '',
        observedCues: parsed.reelsMarketingScores?.entertainmentContent?.observedCues || [],
      },
      informational: {
        score: clampScore(parsed.reelsMarketingScores?.informational?.score),
        rationale: parsed.reelsMarketingScores?.informational?.rationale || '',
        observedCues: parsed.reelsMarketingScores?.informational?.observedCues || [],
      },
      trendiness: {
        score: clampScore(parsed.reelsMarketingScores?.trendiness?.score),
        rationale: parsed.reelsMarketingScores?.trendiness?.rationale || '',
        observedCues: parsed.reelsMarketingScores?.trendiness?.observedCues || [],
      },
    };

    const brandEngagementScores: BrandEngagementScores = {
      interaction: {
        score: clampScore(parsed.brandEngagementScores?.interaction?.score),
        rationale: parsed.brandEngagementScores?.interaction?.rationale || '',
        observedCues: parsed.brandEngagementScores?.interaction?.observedCues || [],
      },
      sharing: {
        score: clampScore(parsed.brandEngagementScores?.sharing?.score),
        rationale: parsed.brandEngagementScores?.sharing?.rationale || '',
        observedCues: parsed.brandEngagementScores?.sharing?.observedCues || [],
      },
      participation: {
        score: clampScore(parsed.brandEngagementScores?.participation?.score),
        rationale: parsed.brandEngagementScores?.participation?.rationale || '',
        observedCues: parsed.brandEngagementScores?.participation?.observedCues || [],
      },
    };

    const overallScore = computeOverallScore(reelsMarketingScores);
    const brandEngagementSummary = computeEngagementSummary(brandEngagementScores);
    const scoreTier = getScoreTier(overallScore);

    return {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      modelUsed,
      videoMetadata,
      context,
      executiveSummary: parsed.executiveSummary || '',
      overallScore,
      scoreTier,
      reelsMarketingScores,
      brandEngagementScores,
      brandEngagementSummary,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      improvementRecommendations: (parsed.improvementRecommendations || []).map((rec) => ({
        priority: normalizePriority(rec.priority),
        targetVariable: rec.targetVariable || 'Related Content',
        recommendation: rec.recommendation || '',
        expectedImpact: rec.expectedImpact || '',
        timestampHint: rec.timestampHint,
      })),
      predictedAudienceResponse: (parsed.predictedAudienceResponse || []).map((aud, idx) => ({
        segment: normalizeSegment(aud.segment, idx),
        predictedSentiment: normalizeSentiment(aud.predictedSentiment),
        responseSummary: aud.responseSummary || '',
        likelyAction: aud.likelyAction || '',
      })),
      marketingStrategyRecommendations: Array.isArray(parsed.marketingStrategyRecommendations)
        ? parsed.marketingStrategyRecommendations
        : [],
      researchRecommendations: Array.isArray(parsed.researchRecommendations)
        ? parsed.researchRecommendations
        : [],
    };
  } catch (err) {
    throw mapUpstreamError(err);
  } finally {
    if (uploadedFileName) {
      try {
        await ai.files.delete({ name: uploadedFileName });
      } catch {
        // Ignore cleanup failures for ephemeral uploaded files
      }
    }
  }
}
