/**
 * Mentorship types and interfaces for CarbonLedger bounty platform.
 * Defines review checklists, feedback forms, and metrics for mentorship coordination.
 */

import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export type BountyType =
  | 'smart-contracts'
  | 'frontend'
  | 'backend'
  | 'devops'
  | 'documentation'
  | 'security'
  | 'design'
  | 'data';

export type ReviewStatus = 'pending' | 'in_review' | 'changes_requested' | 'approved' | 'rejected';

export type MentorStatus = 'active' | 'inactive' | 'on_break';

// ─── Review Checklist Item ───────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  category: string;
  criterion: string;
  description: string;
  required: boolean;
  weight: number; // for scoring, 1-5
}

export interface ChecklistItemResult {
  itemId: string;
  passed: boolean;
  score: number; // 0-5
  notes: string;
  autoChecked: boolean; // true if automated, false if manual review
}

// ─── Review Checklist Templates ──────────────────────────────────────────────

export interface ReviewChecklistTemplate {
  bountyType: BountyType;
  version: string;
  items: ChecklistItem[];
  minimumPassingScore: number; // percentage 0-100
  estimatedReviewMinutes: number;
}

// ─── Mentor Profile ──────────────────────────────────────────────────────────

export interface MentorProfile {
  userId: string;
  publicKey: string;
  status: MentorStatus;
  reputation: number; // must be >80 to be eligible
  specializations: BountyType[];
  totalReviews: number;
  avgTurnaroundHours: number;
  avgHelpfulnessScore: number; // 1-5, from mentee feedback
  reviewCapacityPerWeek: number; // how many reviews they can handle
  currentReviewCount: number;
  joinedAt: Date;
  lastActiveAt: Date;
}

// ─── Review Request ──────────────────────────────────────────────────────────

export interface ReviewRequest {
  id: string;
  bountyId: string;
  bountyTitle: string;
  bountyType: BountyType;
  contributorId: string;
  mentorId: string | null; // assigned mentor
  status: ReviewStatus;
  submissionUrl: string; // GitHub PR, deployment link, etc.
  submittedAt: Date;
  assignedAt: Date | null;
  reviewStartedAt: Date | null;
  reviewCompletedAt: Date | null;
  slaDeadline: Date; // 48 hours from submission
  slaMet: boolean | null;
  checklistResults: ChecklistItemResult[];
  overallScore: number | null; // 0-100
  mentorFeedback: string | null;
  revisionCount: number;
}

// ─── Mentor Feedback Form ────────────────────────────────────────────────────

export interface MentorFeedbackQuestion {
  id: string;
  question: string;
  type: 'rating' | 'boolean' | 'text' | 'multiple_choice';
  options?: string[]; // for multiple_choice
  required: boolean;
}

export interface MentorFeedbackAnswer {
  questionId: string;
  rating?: number; // 1-5
  booleanValue?: boolean;
  textValue?: string;
  choiceValue?: string;
}

export interface MentorFeedbackForm {
  reviewRequestId: string;
  mentorId: string;
  contributorId: string;
  submittedAt: Date;
  answers: MentorFeedbackAnswer[];
}

// ─── Mentee Feedback (about mentor helpfulness) ──────────────────────────────

export interface MenteeFeedback {
  id: string;
  reviewRequestId: string;
  mentorId: string;
  contributorId: string;
  helpfulnessScore: number; // 1-5
  timelinessScore: number; // 1-5
  clarityScore: number; // 1-5
  wouldWorkWithAgain: boolean;
  comments: string;
  submittedAt: Date;
}

// ─── Review SLA Metrics ──────────────────────────────────────────────────────

export interface ReviewSLAMetrics {
  totalReviews: number;
  reviewsWithinSLA: number;
  reviewsBreachedSLA: number;
  slaCompliancePct: number; // percentage
  avgTurnaroundHours: number;
  medianTurnaroundHours: number;
  p95TurnaroundHours: number;
  byBountyType: {
    bountyType: BountyType;
    avgTurnaroundHours: number;
    slaCompliancePct: number;
  }[];
}

// ─── Mentorship Metrics ──────────────────────────────────────────────────────

export interface MentorshipMetrics {
  totalMentors: number;
  activeMentors: number;
  totalReviews: number;
  avgHelpfulnessScore: number;
  slaMetrics: ReviewSLAMetrics;
  topMentors: {
    mentorId: string;
    publicKey: string;
    totalReviews: number;
    avgHelpfulnessScore: number;
    slaCompliancePct: number;
  }[];
}

// ─── DTOs ────────────────────────────────────────────────────────────────────

export class OptInMentorDto {
  @IsString()
  publicKey: string;

  @IsArray()
  @IsEnum(['smart-contracts', 'frontend', 'backend', 'devops', 'documentation', 'security', 'design', 'data'], { each: true })
  specializations: BountyType[];

  @IsNumber()
  @Min(1)
  @Max(20)
  reviewCapacityPerWeek: number;
}

export class UpdateMentorStatusDto {
  @IsEnum(['active', 'inactive', 'on_break'])
  status: MentorStatus;
}

export class SubmitReviewRequestDto {
  @IsString()
  bountyId: string;

  @IsString()
  bountyTitle: string;

  @IsEnum(['smart-contracts', 'frontend', 'backend', 'devops', 'documentation', 'security', 'design', 'data'])
  bountyType: BountyType;

  @IsString()
  contributorId: string;

  @IsString()
  submissionUrl: string;
}

export class ChecklistResultDto {
  @IsString()
  itemId: string;

  @IsBoolean()
  passed: boolean;

  @IsNumber()
  @Min(0)
  @Max(5)
  score: number;

  @IsString()
  notes: string;

  @IsBoolean()
  autoChecked: boolean;
}

export class SubmitReviewDto {
  @IsString()
  reviewRequestId: string;

  @IsString()
  mentorId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistResultDto)
  checklistResults: ChecklistResultDto[];

  @IsNumber()
  @Min(0)
  @Max(100)
  overallScore: number;

  @IsString()
  mentorFeedback: string;

  @IsEnum(['approved', 'changes_requested', 'rejected'])
  decision: 'approved' | 'changes_requested' | 'rejected';
}

export class SubmitMenteeFeedbackDto {
  @IsString()
  reviewRequestId: string;

  @IsString()
  mentorId: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  helpfulnessScore: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  timelinessScore: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  clarityScore: number;

  @IsBoolean()
  wouldWorkWithAgain: boolean;

  @IsOptional()
  @IsString()
  comments?: string;
}

export class GetReviewsQueryDto {
  @IsOptional()
  @IsEnum(['pending', 'in_review', 'changes_requested', 'approved', 'rejected'])
  status?: ReviewStatus;

  @IsOptional()
  @IsEnum(['smart-contracts', 'frontend', 'backend', 'devops', 'documentation', 'security', 'design', 'data'])
  bountyType?: BountyType;

  @IsOptional()
  @IsString()
  mentorId?: string;

  @IsOptional()
  @IsString()
  contributorId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;
}
