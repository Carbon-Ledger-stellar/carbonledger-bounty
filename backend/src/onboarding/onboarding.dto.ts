import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

// ── Value types ──────────────────────────────────────────────────────────────

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed';
export type StepStatus = 'not_started' | 'in_progress' | 'completed';
export type AssessmentDomain = 'smart_contracts' | 'frontend' | 'backend';
export type CertificationDomain = 'smart_contracts' | 'frontend' | 'backend' | 'general';
export type BadgeType = 'first_contribution' | 'first_certification' | 'mentor_others';

export type StepKey =
  | 'setup'
  | 'first_pr'
  | 'testing'
  | 'documentation'
  | 'code_review';

export const STEP_KEYS: StepKey[] = [
  'setup',
  'first_pr',
  'testing',
  'documentation',
  'code_review',
];

export const ASSESSMENT_DOMAINS: AssessmentDomain[] = [
  'smart_contracts',
  'frontend',
  'backend',
];

export const CERTIFICATION_DOMAINS: CertificationDomain[] = [
  'smart_contracts',
  'frontend',
  'backend',
  'general',
];

export const BADGE_TYPES: BadgeType[] = [
  'first_contribution',
  'first_certification',
  'mentor_others',
];

/** Minimum score (out of 100) required to pass an assessment and earn certification */
export const PASS_SCORE = 80;

/** Certification validity period in milliseconds (1 year) */
export const CERT_VALIDITY_MS = 365 * 24 * 60 * 60 * 1000;

/** Number of mentees required to earn the mentor_others badge */
export const MENTOR_THRESHOLD = 3;

// ── Seeded onboarding step definitions ───────────────────────────────────────

export interface StepDefinition {
  stepKey: StepKey;
  title: string;
  description: string;
}

export const ONBOARDING_STEPS: StepDefinition[] = [
  {
    stepKey: 'setup',
    title: 'Environment Setup',
    description:
      'Clone the repo, install dependencies, configure .env, and run the backend and frontend locally.',
  },
  {
    stepKey: 'first_pr',
    title: 'First Pull Request',
    description:
      'Fix a labelled "good-first-issue" bug or typo, open a PR, and get it merged.',
  },
  {
    stepKey: 'testing',
    title: 'Write a Test',
    description:
      'Add at least one meaningful unit test to an existing service and confirm it passes in CI.',
  },
  {
    stepKey: 'documentation',
    title: 'Improve Documentation',
    description:
      'Add or update a README section, inline JSDoc, or API doc for a module you have worked with.',
  },
  {
    stepKey: 'code_review',
    title: 'Conduct a Code Review',
    description:
      'Review another contributor\'s PR, leave at least two constructive comments, and approve or request changes.',
  },
];

// ── Seeded skill assessment definitions (2-3 per domain) ────────────────────

export interface AssessmentDefinition {
  assessmentId: string;
  domain: AssessmentDomain;
  title: string;
  description: string;
}

export const ASSESSMENT_DEFINITIONS: AssessmentDefinition[] = [
  // Smart Contracts
  {
    assessmentId: 'assess-sc-01',
    domain: 'smart_contracts',
    title: 'Soroban Basics Quiz',
    description: 'Tests knowledge of Soroban SDK fundamentals: storage, auth, events.',
  },
  {
    assessmentId: 'assess-sc-02',
    domain: 'smart_contracts',
    title: 'Carbon Credit Contract Design',
    description: 'Architecture challenge: design a serial-number registry that prevents double-counting.',
  },
  {
    assessmentId: 'assess-sc-03',
    domain: 'smart_contracts',
    title: 'Marketplace Security Review',
    description: 'Identify vulnerabilities in a provided USDC marketplace contract snippet.',
  },
  // Frontend
  {
    assessmentId: 'assess-fe-01',
    domain: 'frontend',
    title: 'Next.js 15 Patterns Quiz',
    description: 'Tests knowledge of App Router, SWR data fetching, and accessibility.',
  },
  {
    assessmentId: 'assess-fe-02',
    domain: 'frontend',
    title: 'Freighter Wallet Integration',
    description: 'Challenge: describe the full Freighter → Soroban TX signing flow for a credit purchase.',
  },
  {
    assessmentId: 'assess-fe-03',
    domain: 'frontend',
    title: 'Component Performance Review',
    description: 'Identify re-render issues and propose fixes in a provided marketplace listing component.',
  },
  // Backend
  {
    assessmentId: 'assess-be-01',
    domain: 'backend',
    title: 'NestJS Architecture Quiz',
    description: 'Tests knowledge of modules, guards, interceptors, and Prisma integration patterns.',
  },
  {
    assessmentId: 'assess-be-02',
    domain: 'backend',
    title: 'API Design Challenge',
    description: 'Design a pagination + filtering strategy for the marketplace listings endpoint.',
  },
];

// ── Request DTOs ─────────────────────────────────────────────────────────────

/**
 * Start or retrieve a contributor's onboarding progress.
 * Idempotent — calling again returns the existing record.
 */
export class StartOnboardingDto {
  // contributorId comes from the JWT — no body fields required
}

/**
 * Mark a single onboarding step as started or completed.
 */
export class UpdateStepDto {
  @IsIn(STEP_KEYS)
  stepKey: StepKey;

  @IsIn(['in_progress', 'completed'] as StepStatus[])
  status: 'in_progress' | 'completed';
}

/**
 * Submit a score for a skill assessment attempt.
 * The quiz engine computes the score; the backend validates and records it.
 */
export class SubmitAssessmentDto {
  @IsString()
  assessmentId: string;

  /** Score out of 100, as computed by the quiz engine */
  @IsInt()
  @Min(0)
  @Max(100)
  score: number;

  /** ISO 8601 timestamp when the attempt was started */
  @IsString()
  startedAt: string;
}

/**
 * Check whether a contributor holds a valid certification for a domain.
 * Used by the bounty gateway to decide whether to allow application.
 */
export class CheckCertificationDto {
  @IsString()
  contributorId: string;

  @IsIn(CERTIFICATION_DOMAINS)
  domain: CertificationDomain;
}

/**
 * Record a mentorship action (contributor has guided another contributor).
 * When the mentor reaches MENTOR_THRESHOLD mentees the badge is awarded automatically.
 */
export class RecordMentorshipDto {
  /** ID of the contributor being mentored */
  @IsString()
  menteeId: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  notes?: string;
}

/**
 * Query params for listing onboarding progress records.
 */
export class OnboardingQueryDto {
  @IsOptional()
  @IsIn(['not_started', 'in_progress', 'completed'] as OnboardingStatus[])
  status?: OnboardingStatus;
}

// ── Response interfaces ───────────────────────────────────────────────────────

export interface StepProgress {
  stepKey: string;
  title: string;
  description: string;
  status: string;
  completedAt: Date | null;
  durationMs: number | null;
}

export interface OnboardingProgressResponse {
  contributorId: string;
  status: string;
  completionPct: number;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  steps: StepProgress[];
}

export interface CertificationResponse {
  certificationId: string;
  contributorId: string;
  domain: string;
  issuedAt: Date;
  expiresAt: Date;
  highestScore: number;
  isValid: boolean;
}

export interface BadgeResponse {
  badgeId: string;
  contributorId: string;
  badge: string;
  awardedAt: Date;
  metadata: string | null;
}

export interface BountyAccessResponse {
  contributorId: string;
  bountyId: string;
  requiresCertification: boolean;
  domain: CertificationDomain | null;
  hasAccess: boolean;
  reason: string;
}
