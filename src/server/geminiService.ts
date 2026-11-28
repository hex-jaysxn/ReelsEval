import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AudienceSegmentPrediction,
  DevelopmentRecommendation,
  EvaluationContext,
  EvaluationScope,
  MarketingStrategyItem,
  ReelEvaluation,
  ReelsMarketingVariables,
  ReelsVariableKey,
  ReelVideoMetadata,
} from '../types/evaluation.ts';
import {
  ALL_REELS_VARIABLES,
  EMPTY_SCOPE_VALIDATION_MESSAGE,
  INLINE_THRESHOLD_BYTES,
  STUDY_VARIABLE_META,
  buildVariableAssessment,
  createFullEvaluationScope,
  matchVariableKeyFromLabel,
  normalizeEvaluationScope,
  sanitizeEvaluationByScope,
  validateEvaluationScope,
} from '../utils/evaluationLogic.ts';

export const GEMINI_FREE_TIER_MODEL = 'gemini-4-hydrogen';
export const GEMINI_FREE_TIER_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

export class GeminiServiceError extends Error {
  statusCode: number;
  errorCode:
    | 'INVALID_INPUT'
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
      | 'INVALID_INPUT'
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
      description:
        'Rating (2-5) for how well this content variable encourages viewer interaction (likes, comments, reactions, questions).',
    },
    participation: {
      ...dimensionRatingSchema,
      description:
        'Rating (2-5) for how well this content variable encourages viewer participation (discussions, prompts, challenges, UGC).',
    },
    sharing: {
      ...dimensionRatingSchema,
      description:
        'Rating (2-5) for how well this content variable encourages saving or sharing with friends/peers.',
    },
    observedCues: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '2-3 specific visual, audio, caption, or pacing cues observed in the video.',
    },
  },
  required: ['interaction', 'participation', 'sharing', 'observedCues'],
};

const RUBRIC_CRITERIA_BY_VARIABLE: Record<
  ReelsVariableKey,
  {
    schemaDescription: string;
    rubricBlock: string;
  }
> = {
  informational: {
    schemaDescription:
      'A. Informational Content evaluated across Interaction, Participation, and Sharing (2-5 each).',
    rubricBlock: `A. INFORMATIONAL CONTENT (Survey Mean: 3.40 | Brand Engagement Correlation: 0.372 Weak):
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
  2: Lacks useful product details that would motivate viewers to share or save the content.`,
  },
  entertainment: {
    schemaDescription:
      'B. Entertainment Content evaluated across Interaction, Participation, and Sharing (2-5 each).',
    rubricBlock: `B. ENTERTAINMENT CONTENT (Survey Mean: 3.19 | Brand Engagement Correlation: 0.463 Moderate):
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
  2: Offers little entertainment value, giving viewers minimal reason to share it with others.`,
  },
  trendiness: {
    schemaDescription:
      'C. Trendiness evaluated across Interaction, Participation, and Sharing (2-5 each).',
    rubricBlock: `C. TRENDINESS (Survey Mean: 3.43 | Brand Engagement Correlation: 0.306 Weak):
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
  2: Lacks relevant trending elements that could encourage viewers to share or repost it.`,
  },
  relatable: {
    schemaDescription:
      'D. Relatable Content evaluated across Interaction, Participation, and Sharing (2-5 each).',
    rubricBlock: `D. RELATABLE CONTENT (Survey Mean: 3.31 | Brand Engagement Correlation: 0.554 Moderate):
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
  2: Does not reflect the interests or experiences of its target audience, giving them little reason to share it.`,
  },
};

function formatHumanList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

export function buildEvaluationPromptAndSchema(params: {
  evaluationScope: EvaluationScope;
  context: EvaluationContext;
  videoMetadata: Pick<ReelVideoMetadata, 'fileName'>;
}) {
  const scope = normalizeEvaluationScope(params.evaluationScope);
  const scopeCheck = validateEvaluationScope(scope);
  if (!scopeCheck.valid) {
    throw new GeminiServiceError(
      scopeCheck.errorMessage || EMPTY_SCOPE_VALIDATION_MESSAGE,
      400,
      'INVALID_INPUT'
    );
  }

  const selectedKeys = scope.selectedVariables;
  const unselectedKeys = ALL_REELS_VARIABLES.filter((key) => !selectedKeys.includes(key));
  const selectedLabels = selectedKeys.map((key) => STUDY_VARIABLE_META[key].label);
  const unselectedLabels = unselectedKeys.map((key) => STUDY_VARIABLE_META[key].label);

  const scopeDirective = scope.fullEvaluation
    ? 'Perform the complete Reels Marketing Content Effectiveness Assessment using all four official characteristics (Informational Content, Entertainment Content, Trendiness, and Relatable Content).'
    : `Evaluate ONLY ${formatHumanList(selectedLabels)}.
Use ONLY the selected section(s) of the official rubric provided below.
For each selected characteristic, evaluate Interaction, Participation, and Sharing.
Do NOT score, evaluate, discuss, or mention ${formatHumanList(unselectedLabels)} as evaluated characteristics or weaknesses, and do NOT give recommendations for unselected characteristics.`;

  const selectedRubricSections = selectedKeys
    .map((key) => RUBRIC_CRITERIA_BY_VARIABLE[key].rubricBlock)
    .join('\n\n');

  const systemInstruction = `You are ReeView's content evaluation engine, acting as a senior short-form video marketing researcher using the official "Reels Marketing Content Effectiveness Assessment" rubric.

USER-SELECTED EVALUATION SCOPE:
The user's selected content characteristics define the exact scope of this evaluation.
${scopeDirective}

STRICT GUARDRAIL:
You must not evaluate characteristics outside the selected scope. The official assessment rubric supplied below is authoritative. For each selected characteristic, assign Interaction, Participation, and Sharing integer scores from 2 to 5 strictly according to the corresponding official rubric descriptions. Base all conclusions on visible and audible evidence observed in the uploaded Reel (visual presentation, spoken content, on-screen text, audio/music when relevant, editing, narrative structure, and demonstrated content characteristics). Do not award high scores based solely on production polish unless it supports the selected rubric criteria. Keep your executive summary, explanations, strengths, areas for improvement, development recommendations, audience response, and strategy aligned strictly with the selected characteristics. When fewer than four characteristics are selected, do not calculate, invent, or reference an official 8–20 overall score.

SCORING GUIDE (STRICTLY INTEGER 2, 3, 4, or 5 per cell):
5 = Very Effective | 4 = Effective | 3 = Moderately Effective | 2 = Less Effective
Note: Minimum rating is 2, maximum rating is 5. Never output 0 or 1.

OFFICIAL RUBRIC FOR SELECTED CHARACTERISTIC${selectedKeys.length > 1 ? 'S' : ''} (evaluate across Interaction, Participation, and Sharing):

${selectedRubricSections}

Ground every score strictly in what is visible and audible in the video using the exact 2-5 criteria above:
- Apply the Target Persona Focus and any Brand / Product Context solely as contextual framing for the selected content characteristics—they must never replace or override the selected content characteristics or official rubric criteria.
- Strengths MUST highlight the highest-scoring demonstrated elements within the selected characteristic(s) (ratings 4-5 when present).
- Areas for Improvement MUST explicitly identify the lowest-scoring engagement dimensions/gaps within the selected characteristic(s) only, and explain the gap per the rubric.
- Development Recommendations MUST target ONLY the selected characteristic(s) with concrete creator or business-owner improvements grounded in the assessment criteria.
- Methodological rule: Evaluate demonstrated content characteristics and their POTENTIAL to encourage Interaction, Participation, and Sharing. Use academic framing such as "demonstrates", "indicates", "shows potential to encourage", or "based on the assessment criteria"—never assert guaranteed consumer behavior or causal proof.`;

  const promptText = `Evaluate this short-form marketing Reel (${params.videoMetadata.fileName}).
Evaluation Scope (${scope.fullEvaluation ? 'Full Evaluation — 4 of 4 characteristics' : `${selectedKeys.length} of 4 characteristics`}): ${selectedLabels.join(', ')}.
Target Persona Focus (context): ${params.context.targetPersona}
Campaign Objective (context): ${params.context.campaignObjective}
${params.context.brandContext ? `Brand / Product Context: ${params.context.brandContext}` : ''}

Provide strictly within the selected scope (${selectedLabels.join(', ')}):
- Integer ratings (2, 3, 4, or 5) and concise evidence-based rationales for Interaction, Participation, and Sharing across ONLY: ${selectedLabels.join(', ')}, plus observed video cues.
- Strengths focused strictly on ${formatHumanList(selectedLabels)}.
- Areas for Improvement focused strictly on ${formatHumanList(selectedLabels)}.
- Specific Development Recommendations targeting ONLY ${formatHumanList(selectedLabels)}.
- Predicted Audience Response across Business Owners, Gen Z Consumers, Social Media Content Creators, and Marketing Professionals grounded in the evaluated content characteristics.
- Marketing Strategy Recommendations aligned with ${formatHumanList(selectedLabels)}.`;

  const scopedVariableProperties: Record<string, typeof variableMatrixSchema & { description: string }> = {};
  for (const key of selectedKeys) {
    scopedVariableProperties[key] = {
      ...variableMatrixSchema,
      description: RUBRIC_CRITERIA_BY_VARIABLE[key].schemaDescription,
    };
  }

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      executiveSummary: {
        type: Type.STRING,
        description: scope.fullEvaluation
          ? '2-3 sentence executive summary of the Reel marketing effectiveness and engagement potential across all four characteristics.'
          : `2-3 sentence executive summary focused strictly on the selected characteristic(s): ${selectedLabels.join(', ')}. Do not mention unselected characteristics or an 8-20 overall score.`,
      },
      variables: {
        type: Type.OBJECT,
        properties: scopedVariableProperties,
        required: [...selectedKeys],
      },
      strengths: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: `2-5 strengths identifying demonstrated elements within ONLY: ${selectedLabels.join(', ')}.`,
      },
      areasForImprovement: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: `2-5 areas for improvement identifying lowest-scoring dimensions within ONLY: ${selectedLabels.join(', ')}.`,
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
              enum: selectedLabels,
              description: `Must be one of the selected characteristics: ${selectedLabels.join(', ')}.`,
            },
            targetDimension: {
              type: Type.STRING,
              enum: ['Interaction', 'Participation', 'Sharing', 'All Dimensions'],
              description: 'One of: Interaction, Participation, Sharing, All Dimensions.',
            },
            recommendation: {
              type: Type.STRING,
              description:
                'Specific, actionable suggestion on how the content creator or business owner can improve the Reel based on the selected rubric criteria.',
            },
            expectedImpact: {
              type: Type.STRING,
              description:
                'Expected potential lift in dimension rating or engagement encouragement (academic framing, no causal guarantees).',
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
              description:
                'How this audience segment may perceive the evaluated content characteristics.',
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

  return {
    scope,
    systemInstruction,
    promptText,
    responseSchema,
  };
}

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

function normalizeScopedTargetVariable(
  val: string,
  allowedKeys: readonly ReelsVariableKey[]
): string | null {
  const matched = matchVariableKeyFromLabel(val);
  if (matched && allowedKeys.includes(matched)) {
    return STUDY_VARIABLE_META[matched].label;
  }
  if (allowedKeys.length === 1 && !matched) {
    return STUDY_VARIABLE_META[allowedKeys[0]].label;
  }
  return null;
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
  evaluationScope?: EvaluationScope;
}): Promise<ReelEvaluation> {
  const scopeInput = params.evaluationScope ?? createFullEvaluationScope();
  const { scope, systemInstruction, promptText, responseSchema } =
    buildEvaluationPromptAndSchema({
      evaluationScope: scopeInput,
      context: params.context,
      videoMetadata: params.videoMetadata,
    });

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
              responseSchema,
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
      interaction?: { score: number; rationale: string };
      participation?: { score: number; rationale: string };
      sharing?: { score: number; rationale: string };
      observedCues?: string[];
    };

    let parsed: {
      executiveSummary: string;
      variables: Partial<Record<ReelsVariableKey, RawVariableMatrix>>;
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

    const variables: ReelsMarketingVariables = {};
    for (const key of scope.selectedVariables) {
      const rawVar = parsed.variables?.[key];
      if (
        !rawVar ||
        !rawVar.interaction ||
        !rawVar.participation ||
        !rawVar.sharing
      ) {
        throw new GeminiServiceError(
          `Evaluation output omitted required rubric ratings for ${STUDY_VARIABLE_META[key].label}. Please retry the analysis.`,
          502,
          'ANALYSIS_FAILED'
        );
      }
      variables[key] = buildVariableAssessment({
        key,
        interaction: rawVar.interaction,
        participation: rawVar.participation,
        sharing: rawVar.sharing,
        observedCues: rawVar.observedCues || [],
      });
    }

    const scopedRecommendations: DevelopmentRecommendation[] = [];
    for (const rec of parsed.developmentRecommendations || []) {
      const targetVariable = normalizeScopedTargetVariable(
        rec.targetVariable,
        scope.selectedVariables
      );
      if (!targetVariable) continue;
      scopedRecommendations.push({
        priority: normalizePriority(rec.priority),
        targetVariable,
        targetDimension: normalizeDimension(rec.targetDimension),
        recommendation: rec.recommendation || '',
        expectedImpact: rec.expectedImpact || '',
        timestampHint: rec.timestampHint,
      });
    }

    const rawEvaluation: ReelEvaluation = {
      schemaVersion: 2,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      modelUsed,
      videoMetadata,
      context,
      evaluationScope: scope,
      executiveSummary: parsed.executiveSummary || '',
      overallScore: null,
      scoreTier: null,
      variables,
      brandEngagementSummary: {
        interactionMean: 0,
        participationMean: 0,
        sharingMean: 0,
        overallEngagementMean: 0,
        dominantDriver: 'Interaction',
        lowestDriver: 'Sharing',
      },
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      areasForImprovement: Array.isArray(parsed.areasForImprovement)
        ? parsed.areasForImprovement
        : [],
      developmentRecommendations: scopedRecommendations,
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

    return sanitizeEvaluationByScope(rawEvaluation);
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
