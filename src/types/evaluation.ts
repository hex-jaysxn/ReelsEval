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

export interface CategoryScoreDetail {
  score: number; // 0 to 5
  rationale: string;
  observedCues: string[];
}

export interface ReelsMarketingScores {
  relatedContent: CategoryScoreDetail;
  entertainmentContent: CategoryScoreDetail;
  informational: CategoryScoreDetail;
  trendiness: CategoryScoreDetail;
}

export interface BrandEngagementScores {
  interaction: CategoryScoreDetail;
  sharing: CategoryScoreDetail;
  participation: CategoryScoreDetail;
}

export interface ImprovementRecommendation {
  priority: 'High' | 'Medium' | 'Low';
  targetVariable: string;
  recommendation: string;
  expectedImpact: string;
  timestampHint?: string;
}

export interface AudienceSegmentPrediction {
  segment: 'Business Owners' | 'Gen Z Consumers' | 'Social Media Content Creators' | 'Marketing Professionals';
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

export interface ReelEvaluation {
  id: string;
  createdAt: string;
  modelUsed: string;
  videoMetadata: ReelVideoMetadata;
  context: EvaluationContext;
  executiveSummary: string;
  overallScore: number; // 0 to 20 (sum of 4 reels marketing variables)
  scoreTier: {
    label: string;
    summary: string;
    tone: 'positive' | 'moderate' | 'caution' | 'critical';
  };
  reelsMarketingScores: ReelsMarketingScores;
  brandEngagementScores: BrandEngagementScores;
  brandEngagementSummary: {
    totalOutOf15: number;
    percentage: number;
    dominantDriver: string;
  };
  strengths: string[];
  weaknesses: string[];
  improvementRecommendations: ImprovementRecommendation[];
  predictedAudienceResponse: AudienceSegmentPrediction[];
  marketingStrategyRecommendations: MarketingStrategyItem[];
  researchRecommendations: string[];
}

export interface ApiErrorPayload {
  error: {
    code:
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
