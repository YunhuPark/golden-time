export interface AIAnalysisContext {
  triage: string | null;
  primaryCondition: string | null;
  secondaryConditions?: string[];
  analysisMode: string | null;
  analysisSources: string[];
  capabilities: string[];
  specialties: string[];
  clinicalValidation: boolean;
}

export interface AIContextMatchResult {
  score: number; // 0 to maxScore
  maxScore: number;
  matchedReasons: string[];
  unconfirmedReasons: string[];
}
