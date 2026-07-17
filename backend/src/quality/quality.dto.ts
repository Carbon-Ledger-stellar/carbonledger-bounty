export type BountyType =
  | 'smart-contracts'
  | 'frontend'
  | 'backend'
  | 'devops'
  | 'documentation'
  | 'security'
  | 'design'
  | 'data';

export class SubmitMetricsDto {
  bountyId: string;
  bountyType: BountyType;
  contributorId: string;
  metrics: QualityMetricsInput;
}

export interface QualityMetricsInput {
  // Smart Contracts
  testCoverage?: number;       // 0–100
  securityIssues?: number;     // count

  // Frontend
  accessibilityScore?: number; // 0–100 (Lighthouse a11y)
  lighthouseScore?: number;    // 0–100

  // Backend
  backendCoverage?: number;    // 0–100
  allTestsPassing?: boolean;

  // DevOps
  hasRunbook?: boolean;
  deploymentVerified?: boolean;

  // Documentation
  wordCount?: number;
  hasExamples?: boolean;

  // Security
  vulnCount?: number;
  hasSecurityReport?: boolean;

  // Design
  hasDesignFile?: boolean;
  responsiveVerified?: boolean;

  // Data
  schemaDocumented?: boolean;
  migrationTested?: boolean;
}

export class ReviewDecisionDto {
  qualityCheckId: string;
  reviewerId: string;
  decision: 'approved' | 'request_changes';
  details: string;
}
