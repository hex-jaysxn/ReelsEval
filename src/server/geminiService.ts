import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AudienceSegmentPrediction,
  DevelopmentRecommendation,
  EvaluationContext,
  MarketingStrategyItem,
  ReelEvaluation,
  ReelVideoMetadata,
} from '../types/evaluation.ts';
import {
  INLINE_THRESHOLD_BYTES,
  buildVariableAssessment,
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

const dimensionRatingSchema = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.INTEGER,
      minimum: 2,
      maximum: 5,
      description:
        'Integer score from 2 to 5 strictly per the scoring guide: 5 = Very Effective, 4 = Effective, 3 = Moderately Effective, 2 = Less Effective.',
    },
    rationale: {
      type: Type.STRING,
      description: 'Concise 1-2 sentence justification citing specific video evidence for this rating.',
    },
  },
  required: ['score', 'rationale'],
};

const variableMatrixSchema = {
  type: Type.OBJECT,
  properties: {
    interaction: {
      ...dimensionRatingSchema,
      description: 'Rating (2-5) for how well this content variable encourages viewer interaction (likes, comments, reactions, questions).',
    },
    participation: {
      ...dimensionRatingSchema,
      description: 'Rating (2-5) for how well this content variable encourages viewer participation (discussions, prompts, challenges, UGC).',
    },
    sharing: {
      ...dimensionRatingSchema,
      description: 'Rating (2-5) for how well this content variable encourages saving or sharing with friends/peers.',
    },
    observedCues: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2-3 specific visual, audio, caption, or pacing cues observed in the video.',
    },
  },
  required: ['interaction', 'participation', 'sharing', 'observedCues'],
};

const evaluationResponseSchema = {
  type: Type.OBJECT,
  properties: {
    executiveSummary: {
      type: Type.STRING,
      description:
        '2-3 sentence executive summary of the Reel marketing effectiveness and engagement potential.',
    },
    variables: {
      type: Type.OBJECT,
      properties: {
        informational: {
          ...variableMatrixSchema,
          description: 'A. Informational Content evaluated across Interaction, Participation, and Sharing (2-5 each).',
        },
        entertainment: {
          ...variableMatrixSchema,
          description: 'B. Entertainment Content evaluated across Interaction, Participation, and Sharing (2-5 each).',
        },
        trendiness: {
          ...variableMatrixSchema,
          description: 'C. Trendiness evaluated across Interaction, Participation, and Sharing (2-5 each).',
        },
        relatable: {
          ...variableMatrixSchema,
          description: 'D. Relatable Content evaluated across Interaction, Participation, and Sharing (2-5 each).',
        },
      },
      required: ['informational', 'entertainment', 'trendiness', 'relatable'],
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        '3-5 strengths identifying the characteristics and engagement dimensions that the Reel demonstrates effectively.',
    },
    areasForImprovement: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        '3-5 areas for improvement identifying the lowest-scoring characteristics and engagement dimensions.',
    },
    developmentRecommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          priority: {
            type: Type.STRING,
            enum: ['High', 'Medium', 'Low'],
            description: 'Must be High, Medium, or Low.',
          },
          targetVariable: {
            type: Type.STRING,
            enum: [
              'Informational Content',
              'Entertainment Content',
              'Trendiness',
              'Relatable Content',
            ],
            description:
              'One of: Informational Content, Entertainment Content, Trendiness, Relatable Content.',
          },
          targetDimension: {
            type: Type.STRING,
            enum: ['Interaction', 'Participation', 'Sharing', 'All Dimensions'],
            description: 'One of: Interaction, Participation, Sharing, All Dimensions.',
          },
          recommendation: {
            type: Type.STRING,
            description:
              'Specific, actionable suggestion on how the content creator or business owner can improve the Reel based on the rubric.',
          },
          expectedImpact: {
            type: Type.STRING,
            description: 'Expected lift in dimension rating or engagement behavior.',
          },
          timestampHint: {
            type: Type.STRING,
            description: 'Optional timestamp or video segment reference (e.g., 0:00-0:03).',
          },
        },
        required: [
          'priority',
          'targetVariable',
          'targetDimension',
          'recommendation',
          'expectedImpact',
        ],
      },
    },
    predictedAudienceResponse: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          segment: {
            type: Type.STRING,
            enum: [
              'Business Owners',
              'Gen Z Consumers',
              'Social Media Content Creators',
              'Marketing Professionals',
            ],
            description:
              'Must cover each of: Business Owners, Gen Z Consumers, Social Media Content Creators, Marketing Professionals.',
          },
          predictedSentiment: {
            type: Type.STRING,
            enum: ['Highly Receptive', 'Moderately Receptive', 'Mixed', 'Low Resonance'],
            description:
              'Must be one of: Highly Receptive, Moderately Receptive, Mixed, Low Resonance.',
          },
          responseSummary: {
            type: Type.STRING,
            description: 'How this audience segment is likely to perceive and react to the Reel.',
          },
          likelyAction: {
            type: Type.STRING,
            description: 'Most probable viewer action (e.g., save for reference, DM share, skip).',
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
  },
  required: [
    'executiveSummary',
    'variables',
    'strengths',
    'areasForImprovement',
    'developmentRecommendations',
    'predictedAudienceResponse',
    'marketingStrategyRecommendations',
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

function normalizeDimension(
  val: string
): DevelopmentRecommendation['targetDimension'] {
  const lower = (val || '').toLowerCase();
  if (lower.includes('interact')) return 'Interaction';
  if (lower.includes('participat')) return 'Participation';
  if (lower.includes('shar')) return 'Sharing';
  return 'All Dimensions';
}

function normalizeTargetVariable(val: string): string {
  const lower = (val || '').toLowerCase();
  if (lower.includes('entertain')) return 'Entertainment Content';
  if (lower.includes('trend')) return 'Trendiness';
  if (lower.includes('relat')) return 'Relatable Content';
  return 'Informational Content';
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

  const systemInstruction = `You are a senior short-form video marketing researcher evaluating Reels using the "Reels Marketing Content Effectiveness Assessment" rubric.

SCORING GUIDE (STRICTLY INTEGER 2, 3, 4, or 5 per cell):
5 = Very Effective | 4 = Effective | 3 = Moderately Effective | 2 = Less Effective
Note: Minimum rating is 2, maximum rating is 5. Never output 0 or 1.

Evaluate each of the 4 Reels Marketing Content Variables across all 3 Brand Engagement Dimensions (Interaction, Participation, Sharing):

A. INFORMATIONAL CONTENT (Survey Mean: 3.40 | Brand Engagement Correlation: 0.372 Weak):
- Interaction:
  5: Presents clear and useful product information that encourages viewers to react, comment, or ask questions.
  4: Provides relevant product information that encourages viewers to express their reactions.
  3: Provides basic product information but does little to encourage viewers to react or comment.
  2: Presents unclear or insufficient product information, resulting in little encouragement for viewer interaction.
- Participation:
  5: Provides understandable information that encourages viewers to participate in discussions or respond to product-related questions.
  4: Explains the product sufficiently to encourage viewers to respond to its message or prompts.
  3: Presents information but offers limited opportunities for viewers to participate.
  2: Provides confusing or incomplete information that makes viewer participation difficult.
- Sharing:
  5: Presents valuable product details that viewers would want to save or share with others.
  4: Provides useful information that viewers may share with friends or save for future reference.
  3: Contains some useful details, but its information gives viewers little reason to share or save it.
  2: Lacks useful product details that would motivate viewers to share or save the content.

B. ENTERTAINMENT CONTENT (Survey Mean: 3.19 | Brand Engagement Correlation: 0.463 Moderate):
- Interaction:
  5: Uses highly entertaining elements that capture viewers' attention and encourage them to like, comment, or react.
  4: Uses enjoyable content that encourages viewers to express their reactions.
  3: Has some entertaining elements but does not consistently encourage viewers to interact.
  2: Lacks entertaining elements that could encourage viewers to like, comment, or react.
- Participation:
  5: Uses enjoyable and engaging activities that encourage viewers to join challenges or participate.
  4: Includes entertaining elements that invite viewers to participate in its activities or prompts.
  3: Provides limited entertainment that generates little interest in participating.
  2: Is unengaging and provides little motivation for viewers to participate.
- Sharing:
  5: Provides an entertaining experience that makes viewers want to share it with friends or post it on their stories.
  4: Contains entertaining moments that viewers may want to share with others.
  3: Is somewhat enjoyable but does not strongly motivate viewers to share it.
  2: Offers little entertainment value, giving viewers minimal reason to share it with others.

C. TRENDINESS (Survey Mean: 3.43 | Brand Engagement Correlation: 0.306 Weak):
- Interaction:
  5: Effectively incorporates current social media trends in a way that encourages viewers to react, comment, or share their opinions.
  4: Incorporates recognizable trends that encourage viewers to express their reactions.
  3: Includes trending elements but does not effectively use them to encourage interaction.
  2: Uses outdated or irrelevant trends that fail to encourage viewer reactions.
- Participation:
  5: Adapts popular trends into interactive activities that encourage viewers to join or create their own content.
  4: Includes trending elements that provide opportunities for viewers to participate.
  3: Follows current trends but provides limited opportunities for viewer participation.
  2: Does not effectively incorporate trends that could motivate viewers to participate.
- Sharing:
  5: Uses relevant and popular trends that encourage viewers to share or repost the content with others.
  4: Uses popular topics or formats that viewers may find worth sharing.
  3: Uses familiar trends but does not create a strong reason for viewers to share the content.
  2: Lacks relevant trending elements that could encourage viewers to share or repost it.

D. RELATABLE CONTENT (Survey Mean: 3.31 | Brand Engagement Correlation: 0.554 Moderate):
- Interaction:
  5: Presents relatable situations and experiences that encourage viewers to comment, react, and share their personal opinions.
  4: Presents familiar situations that encourage viewers to express their reactions or opinions.
  3: Contains some relatable elements but does not strongly encourage viewers to interact.
  2: Presents situations that are difficult for its target audience to relate to, resulting in little interaction.
- Participation:
  5: Features experiences that viewers can identify with, encouraging them to participate by sharing their own stories or experiences.
  4: Includes relatable experiences that encourage viewers to respond or participate in its activities.
  3: Presents familiar situations but provides limited motivation for viewers to participate or share their experiences.
  2: Lacks relatable experiences that could encourage viewers to participate.
- Sharing:
  5: Reflects the interests and everyday experiences of its target audience, making viewers want to share it with friends or peers.
  4: Contains situations that viewers may relate to and consider sharing with others.
  3: Has some relatable content but does not create a strong connection that encourages sharing.
  2: Does not reflect the interests or experiences of its target audience, giving them little reason to share it.

Ground every score strictly in what is visible and audible in the video using the exact 2-5 criteria above:
- Apply the Target Persona Focus as the "target audience" lens (especially for Relatable Content) and any Brand / Product Context to judge product clarity (especially for Informational Content), without overriding the rubric criteria.
- Strengths MUST highlight the highest-scoring variables and engagement dimensions (ratings 4-5) demonstrated effectively in the Reel.
- Areas for Improvement MUST explicitly identify the lowest-scoring characteristics and engagement dimensions from your matrix and explain the gap per the rubric.
- Development Recommendations MUST target those lowest-scoring characteristics/dimensions with concrete creator or business-owner improvements grounded in the assessment criteria.
- Methodological rule: Evaluate demonstrated content characteristics and their POTENTIAL to encourage Interaction, Participation, and Sharing. Frame classifications and expected impact as assessment potential based on the study's rubric—never assert proof of guaranteed causal effects on actual consumer behavior or sales.`;

  const promptText = `Evaluate this short-form marketing Reel (${videoMetadata.fileName}).
Target Persona Focus: ${context.targetPersona}
Campaign Objective: ${context.campaignObjective}
${context.brandContext ? `Brand / Product Context: ${context.brandContext}` : ''}

Provide:
- Integer ratings (2, 3, 4, or 5) and concise evidence-based rationales for Interaction, Participation, and Sharing across each of the 4 content variables (Informational Content, Entertainment Content, Trendiness, Relatable Content), plus observed video cues.
- Strengths identifying effective characteristics and engagement dimensions.
- Areas for Improvement identifying the lowest-scoring characteristics and engagement dimensions.
- Specific Development Recommendations for the content creator or business owner.
- Predicted Audience Response across Business Owners, Gen Z Consumers, Social Media Content Creators, and Marketing Professionals.
- Marketing Strategy Recommendations.`;

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

    type RawVariableMatrix = {
      interaction: { score: number; rationale: string };
      participation: { score: number; rationale: string };
      sharing: { score: number; rationale: string };
      observedCues: string[];
    };

    let parsed: {
      executiveSummary: string;
      variables: {
        informational: RawVariableMatrix;
        entertainment: RawVariableMatrix;
        trendiness: RawVariableMatrix;
        relatable: RawVariableMatrix;
      };
      strengths: string[];
      areasForImprovement: string[];
      developmentRecommendations: DevelopmentRecommendation[];
      predictedAudienceResponse: AudienceSegmentPrediction[];
      marketingStrategyRecommendations: MarketingStrategyItem[];
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

    const variables = {
      informational: buildVariableAssessment({
        key: 'informational',
        interaction: parsed.variables?.informational?.interaction || { score: 2, rationale: '' },
        participation: parsed.variables?.informational?.participation || { score: 2, rationale: '' },
        sharing: parsed.variables?.informational?.sharing || { score: 2, rationale: '' },
        observedCues: parsed.variables?.informational?.observedCues || [],
      }),
      entertainment: buildVariableAssessment({
        key: 'entertainment',
        interaction: parsed.variables?.entertainment?.interaction || { score: 2, rationale: '' },
        participation: parsed.variables?.entertainment?.participation || { score: 2, rationale: '' },
        sharing: parsed.variables?.entertainment?.sharing || { score: 2, rationale: '' },
        observedCues: parsed.variables?.entertainment?.observedCues || [],
      }),
      trendiness: buildVariableAssessment({
        key: 'trendiness',
        interaction: parsed.variables?.trendiness?.interaction || { score: 2, rationale: '' },
        participation: parsed.variables?.trendiness?.participation || { score: 2, rationale: '' },
        sharing: parsed.variables?.trendiness?.sharing || { score: 2, rationale: '' },
        observedCues: parsed.variables?.trendiness?.observedCues || [],
      }),
      relatable: buildVariableAssessment({
        key: 'relatable',
        interaction: parsed.variables?.relatable?.interaction || { score: 2, rationale: '' },
        participation: parsed.variables?.relatable?.participation || { score: 2, rationale: '' },
        sharing: parsed.variables?.relatable?.sharing || { score: 2, rationale: '' },
        observedCues: parsed.variables?.relatable?.observedCues || [],
      }),
    };

    const overallScore = computeOverallScore(variables);
    const scoreTier = getScoreTier(overallScore);
    const brandEngagementSummary = computeEngagementSummary(variables);

    return {
      schemaVersion: 2,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      modelUsed,
      videoMetadata,
      context,
      executiveSummary: parsed.executiveSummary || '',
      overallScore,
      scoreTier,
      variables,
      brandEngagementSummary,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      areasForImprovement: Array.isArray(parsed.areasForImprovement)
        ? parsed.areasForImprovement
        : [],
      developmentRecommendations: (parsed.developmentRecommendations || []).map((rec) => ({
        priority: normalizePriority(rec.priority),
        targetVariable: normalizeTargetVariable(rec.targetVariable),
        targetDimension: normalizeDimension(rec.targetDimension),
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
    };
  } catch (err) {
    throw mapUpstreamError(err);
  } finally {
    if (uploadedFileName) {
      try {
        await ai.files.delete({ name: uploadedFileName });
      } catch {
        // Ignore cleanup failures
      }
    }
  }
}
