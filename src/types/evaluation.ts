export type TargetUserPersona =
  | 'General Audience'
  | 'Gen Z Consumers'
  | 'Business Owners'
  | 'Social Media Content Creators'
  | 'Marketing Professionals';

export type CampaignObjective =
  | 'Brand Awareness'
  | 'Product Conversion'
  | 'Community Engagement'
  | 'Educational Authority';

export type EffectivenessLevel =
  | 'Very Effective'
  | 'Effective'
  | 'Moderately Effective'
  | 'Less Effective';

export type ReelsVariableKey = 'informational' | 'entertainment' | 'trendiness' | 'relatable';

export interface EvaluationScope {
  selectedVariables: ReelsVariableKey[];
  fullEvaluation: boolean;
}

export interface EngagementDimensionRating {
  score: number; // Integer 2 to 5 per PDF rubric
  rationale: string;
}

export interface VariableAssessment {
  key: ReelsVariableKey;
  label: string;
  surveyMean: number;
  correlationLabel: string;
  interaction: EngagementDimensionRating;
  participation: EngagementDimensionRating;
  sharing: EngagementDimensionRating;
  averageScore: number; // (interaction + participation + sharing) / 3, 2.00 to 5.00
  effectivenessLevel: EffectivenessLevel;
  effectivenessInterpretation: string;
  observedCues: string[];
}

export type ReelsMarketingVariables = Partial<Record<ReelsVariableKey, VariableAssessment>>;

export interface BrandEngagementDimensionSummary {
  interactionMean: number; // Mean across the evaluated content variables (2.00 - 5.00)
  participationMean: number;
  sharingMean: number;
  overallEngagementMean: number;
  dominantDriver: 'Interaction' | 'Participation' | 'Sharing';
  lowestDriver: 'Interaction' | 'Participation' | 'Sharing';
}

export interface DevelopmentRecommendation {
  priority: 'High' | 'Medium' | 'Low';
  targetVariable: string;
  targetDimension: 'Interaction' | 'Participation' | 'Sharing' | 'All Dimensions';
  recommendation: string;
  expectedImpact: string;
  timestampHint?: string;
}

export interface AudienceSegmentPrediction {
  segment:
    | 'Business Owners'
    | 'Gen Z Consumers'
    | 'Social Media Content Creators'
    | 'Marketing Professionals';
  predictedSentiment: 'Highly Receptive' | 'Moderately Receptive' | 'Mixed' | 'Low Resonance';
  responseSummary: string;
  likelyAction: string;
}

export interface MarketingStrategyItem {
  pillar: string;
  recommendation: string;
  researchRationale: string;
  executionStep: string;
}

export interface ReelVideoMetadata {
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
}

export interface EvaluationContext {
  targetPersona: TargetUserPersona;
  campaignObjective: CampaignObjective;
  brandContext?: string;
}

export interface ScoreTierSummary {
  level: EffectivenessLevel;
  summary: string;
  tone: 'positive' | 'moderate' | 'caution' | 'critical';
}

export interface ReelEvaluation {
  schemaVersion: 2;
  id: string;
  createdAt: string;
  modelUsed: string;
  videoMetadata: ReelVideoMetadata;
  context: EvaluationContext;
  evaluationScope?: EvaluationScope;
  executiveSummary: string;
  overallScore: number | null; // Sum of 4 variable averages (8.00 to 20.00) ONLY when fullEvaluation is true
  scoreTier: ScoreTierSummary | null; // Official 20-point classification ONLY when fullEvaluation is true
  selectedAverageScore?: number; // Mean of evaluated characteristic averages (2.00 to 5.00)
  selectedEffectivenessLevel?: EffectivenessLevel;
  selectedEffectivenessInterpretation?: string;
  variables: ReelsMarketingVariables;
  brandEngagementSummary: BrandEngagementDimensionSummary;
  strengths: string[];
  areasForImprovement: string[];
  developmentRecommendations: DevelopmentRecommendation[];
  predictedAudienceResponse: AudienceSegmentPrediction[];
  marketingStrategyRecommendations: MarketingStrategyItem[];
}

export interface ApiErrorPayload {
  error: {
    code:
      | 'INVALID_INPUT'
      | 'INVALID_FILE'
      | 'UNSUPPORTED_VIDEO'
      | 'FILE_TOO_LARGE'
      | 'RATE_LIMIT'
      | 'INVALID_API_KEY'
      | 'MODEL_UNAVAILABLE'
      | 'ANALYSIS_FAILED';
    message: string;
    detail?: string;
    retryAfterSeconds?: number;
  };
}
