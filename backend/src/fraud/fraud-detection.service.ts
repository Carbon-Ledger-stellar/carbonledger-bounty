import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CheckFraudDto,
  LinkGithubDto,
  VerifyStellarDto,
  AppealDto,
  ReviewFraudDto,
} from './fraud.dto';

export interface FraudSignal {
  type: 'MULTIPLE_ACCOUNTS' | 'DUPLICATE_CODE' | 'IMPOSSIBLE_SPEED' | 'STELLAR_MISMATCH' | 'HIGH_VALUE_KYC';
  severity: 'low' | 'medium' | 'high';
  details: string;
  score: number; // 0-100, higher = more suspicious
}

export interface FraudCheckResult {
  contributorId: string;
  signals: FraudSignal[];
  totalScore: number;
  action: 'allow' | 'manual_review' | 'block';
  requiresKyc: boolean;
  timestamp: Date;
}

// High-value payout threshold in USD
const HIGH_VALUE_THRESHOLD_USD = 1000;

// Minimum seconds expected to read + understand a bounty before submitting
const MIN_SUBMISSION_SECONDS = 300; // 5 minutes

// Code similarity threshold (0-1)
const DUPLICATE_CODE_THRESHOLD = 0.80;

@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name);

  // In-memory store for identity records (replace with DB table in production)
  private identityStore: Map<string, {
    stellarAddress: string;
    githubUsername?: string;
    githubUserId?: string;
    kycVerified: boolean;
    trustScore: number;
    linkedAt: Date;
  }> = new Map();

  // In-memory audit log (replace with DB table in production)
  private auditLog: Array<{
    id: string;
    contributorId: string;
    action: string;
    signals: FraudSignal[];
    totalScore: number;
    decision: string;
    reviewerId?: string;
    reviewNotes?: string;
    appealReason?: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  constructor(private prisma: PrismaService) {}

  /**
   * Main entry point: run all fraud checks for a contributor submission.
   */
  async checkFraud(dto: CheckFraudDto): Promise<FraudCheckResult> {
    const signals: FraudSignal[] = [];

    // 1. Multiple-account detection
    const multiAccountSignal = await this.detectMultipleAccounts(dto.contributorId, dto.stellarAddress);
    if (multiAccountSignal) signals.push(multiAccountSignal);

    // 2. Duplicate code detection
    if (dto.submissionCode && dto.bountyId) {
      const dupSignal = await this.detectDuplicateCode(dto.contributorId, dto.bountyId, dto.submissionCode);
      if (dupSignal) signals.push(dupSignal);
    }

    // 3. Impossible speed detection
    if (dto.submissionTime && dto.bountyId) {
      const speedSignal = await this.detectImpossibleSpeed(dto.bountyId, dto.submissionTime);
      if (speedSignal) signals.push(speedSignal);
    }

    // 4. Stellar address consistency
    const stellarSignal = this.checkStellarConsistency(dto.contributorId, dto.stellarAddress);
    if (stellarSignal) signals.push(stellarSignal);

    // 5. High-value KYC check
    const requiresKyc = (dto.payoutAmountUsd ?? 0) >= HIGH_VALUE_THRESHOLD_USD;
    if (requiresKyc) {
      signals.push({
        type: 'HIGH_VALUE_KYC',
        severity: 'low',
        details: `Payout $${dto.payoutAmountUsd} exceeds $${HIGH_VALUE_THRESHOLD_USD} threshold — optional KYC triggered`,
        score: 10,
      });
    }

    const totalScore = signals.reduce((sum, s) => sum + s.score, 0);
    const action = this.scoreToAction(totalScore);

    const result: FraudCheckResult = {
      contributorId: dto.contributorId,
      signals,
      totalScore,
      action,
      requiresKyc,
      timestamp: new Date(),
    };

    // Persist to audit log
    this.writeAuditLog(dto.contributorId, 'FRAUD_CHECK', signals, totalScore, action);

    this.logger.log(
      `Fraud check for ${dto.contributorId}: score=${totalScore} action=${action} signals=${signals.map(s => s.type).join(',')}`,
    );

    return result;
  }

  /**
   * Detect whether a Stellar address is associated with multiple contributor IDs.
   */
  private async detectMultipleAccounts(contributorId: string, stellarAddress: string): Promise<FraudSignal | null> {
    // Look for other contributors using the same Stellar address
    const conflicting = Array.from(this.identityStore.entries()).find(
      ([id, rec]) => rec.stellarAddress === stellarAddress && id !== contributorId,
    );

    if (conflicting) {
      return {
        type: 'MULTIPLE_ACCOUNTS',
        severity: 'high',
        details: `Stellar address ${stellarAddress} is already linked to contributor ${conflicting[0]}`,
        score: 80,
      };
    }

    // Also check the User table for duplicate Stellar public keys
    const existingUser = await this.prisma.user.findFirst({
      where: { publicKey: stellarAddress },
    });

    if (existingUser && existingUser.id !== contributorId) {
      return {
        type: 'MULTIPLE_ACCOUNTS',
        severity: 'high',
        details: `Stellar address ${stellarAddress} is registered to a different account in the system`,
        score: 75,
      };
    }

    return null;
  }

  /**
   * Detect whether submitted code is >80% similar to prior submissions on the same bounty.
   */
  private async detectDuplicateCode(
    contributorId: string,
    bountyId: string,
    submissionCode: string,
  ): Promise<FraudSignal | null> {
    // Retrieve prior submissions for this bounty from the audit log
    const priorSubmissions = this.auditLog
      .filter(entry => entry.action === 'CODE_SUBMISSION' && entry.contributorId !== contributorId)
      .map(entry => (entry as any).submissionCode as string)
      .filter(Boolean);

    for (const prior of priorSubmissions) {
      const similarity = this.cosineSimilarity(submissionCode, prior);
      if (similarity >= DUPLICATE_CODE_THRESHOLD) {
        return {
          type: 'DUPLICATE_CODE',
          severity: 'high',
          details: `Code submission matches a prior submission at ${Math.round(similarity * 100)}% similarity (threshold: ${DUPLICATE_CODE_THRESHOLD * 100}%)`,
          score: Math.round(similarity * 90),
        };
      }
    }

    return null;
  }

  /**
   * Detect impossibly fast submissions relative to when the bounty was opened.
   */
  private async detectImpossibleSpeed(bountyId: string, submissionTime: Date): Promise<FraudSignal | null> {
    // In a full implementation this would look up bounty.createdAt from DB
    // Here we check whether the time-since-epoch-seconds is plausibly human
    const submissionEpoch = submissionTime.getTime() / 1000;
    const nowEpoch = Date.now() / 1000;

    // If submission time is in the future, that's suspicious
    if (submissionEpoch > nowEpoch + 60) {
      return {
        type: 'IMPOSSIBLE_SPEED',
        severity: 'medium',
        details: 'Submission timestamp is in the future',
        score: 60,
      };
    }

    // Check if any prior log entry shows a submission for this bounty within MIN_SUBMISSION_SECONDS
    const priorForBounty = this.auditLog.find(
      entry => (entry as any).bountyId === bountyId && entry.action === 'CODE_SUBMISSION',
    );

    if (priorForBounty) {
      const elapsed = (submissionTime.getTime() - priorForBounty.createdAt.getTime()) / 1000;
      if (elapsed < MIN_SUBMISSION_SECONDS) {
        return {
          type: 'IMPOSSIBLE_SPEED',
          severity: 'medium',
          details: `Submission arrived ${Math.round(elapsed)}s after bounty opened — minimum expected is ${MIN_SUBMISSION_SECONDS}s`,
          score: 50,
        };
      }
    }

    return null;
  }

  /**
   * Verify that the Stellar address is consistent with previously stored identity.
   */
  private checkStellarConsistency(contributorId: string, stellarAddress: string): FraudSignal | null {
    const identity = this.identityStore.get(contributorId);
    if (!identity) return null; // First time seen — no inconsistency yet

    if (identity.stellarAddress !== stellarAddress) {
      return {
        type: 'STELLAR_MISMATCH',
        severity: 'high',
        details: `Stellar address changed from ${identity.stellarAddress} to ${stellarAddress}`,
        score: 70,
      };
    }

    return null;
  }

  /**
   * Link a GitHub account to a contributor (optional — improves trust score).
   */
  async linkGithub(dto: LinkGithubDto): Promise<{ trustScore: number }> {
    const existing = this.identityStore.get(dto.contributorId) ?? {
      stellarAddress: '',
      kycVerified: false,
      trustScore: 50,
      linkedAt: new Date(),
    };

    // GitHub linking boosts trust score by 20 points (capped at 100)
    const newTrustScore = Math.min(100, existing.trustScore + 20);

    this.identityStore.set(dto.contributorId, {
      ...existing,
      githubUsername: dto.githubUsername,
      githubUserId: dto.githubUserId,
      trustScore: newTrustScore,
    });

    this.writeAuditLog(dto.contributorId, 'GITHUB_LINKED', [], 0, 'allow');
    this.logger.log(`GitHub linked for ${dto.contributorId}: @${dto.githubUsername} trustScore=${newTrustScore}`);

    return { trustScore: newTrustScore };
  }

  /**
   * Verify a Stellar address by checking a signed challenge string.
   */
  async verifyStellarAddress(dto: VerifyStellarDto): Promise<{ verified: boolean; trustScore: number }> {
    // In production: validate dto.signature against dto.challenge using Stellar SDK
    // For now we accept any non-empty signature as a placeholder
    const verified = typeof dto.signature === 'string' && dto.signature.length > 0;

    const existing = this.identityStore.get(dto.contributorId) ?? {
      stellarAddress: '',
      githubUsername: undefined,
      githubUserId: undefined,
      kycVerified: false,
      trustScore: 50,
      linkedAt: new Date(),
    };

    const newTrustScore = verified ? Math.min(100, existing.trustScore + 30) : existing.trustScore;

    this.identityStore.set(dto.contributorId, {
      ...existing,
      stellarAddress: dto.stellarAddress,
      trustScore: newTrustScore,
    });

    this.writeAuditLog(dto.contributorId, 'STELLAR_VERIFIED', [], 0, verified ? 'allow' : 'block');
    return { verified, trustScore: newTrustScore };
  }

  /**
   * File an appeal against a fraud decision.
   */
  async fileAppeal(dto: AppealDto): Promise<{ success: boolean; fraudLogId: string }> {
    const entry = this.auditLog.find(e => e.id === dto.fraudLogId);
    if (!entry) return { success: false, fraudLogId: dto.fraudLogId };

    entry.appealReason = dto.reason;
    entry.decision = 'under_appeal';
    entry.updatedAt = new Date();

    this.logger.log(`Appeal filed for fraud log ${dto.fraudLogId} by ${dto.contributorId}`);
    return { success: true, fraudLogId: dto.fraudLogId };
  }

  /**
   * Reviewer resolves a fraud flag (clear or confirm).
   */
  async reviewFraudFlag(dto: ReviewFraudDto): Promise<{ success: boolean; decision: string }> {
    const entry = this.auditLog.find(e => e.id === dto.fraudLogId);
    if (!entry) return { success: false, decision: 'not_found' };

    entry.decision = dto.decision;
    entry.reviewerId = dto.reviewerId;
    entry.reviewNotes = dto.notes;
    entry.updatedAt = new Date();

    // If confirmed fraud, update identity trust score to 0
    if (dto.decision === 'confirmed') {
      const identity = this.identityStore.get(entry.contributorId);
      if (identity) {
        identity.trustScore = 0;
        this.identityStore.set(entry.contributorId, identity);
      }
    }

    this.logger.log(`Fraud log ${dto.fraudLogId} reviewed by ${dto.reviewerId}: ${dto.decision}`);
    return { success: true, decision: dto.decision };
  }

  /**
   * Return the full audit log (admin only).
   */
  getAuditLog(filters?: { contributorId?: string; action?: string }) {
    let entries = [...this.auditLog];
    if (filters?.contributorId) {
      entries = entries.filter(e => e.contributorId === filters.contributorId);
    }
    if (filters?.action) {
      entries = entries.filter(e => e.action === filters.action);
    }
    return entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Return identity record for a contributor.
   */
  getIdentity(contributorId: string) {
    return this.identityStore.get(contributorId) ?? null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private scoreToAction(score: number): 'allow' | 'manual_review' | 'block' {
    if (score >= 70) return 'block';
    if (score >= 30) return 'manual_review';
    return 'allow';
  }

  private writeAuditLog(
    contributorId: string,
    action: string,
    signals: FraudSignal[],
    totalScore: number,
    decision: string,
  ) {
    const id = `fraud-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.auditLog.push({
      id,
      contributorId,
      action,
      signals,
      totalScore,
      decision,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Compute cosine similarity between two strings using character-level bigrams.
   * Returns a value in [0, 1].
   */
  private cosineSimilarity(a: string, b: string): number {
    const getBigrams = (str: string): Map<string, number> => {
      const map = new Map<string, number>();
      const normalized = str.replace(/\s+/g, ' ').toLowerCase();
      for (let i = 0; i < normalized.length - 1; i++) {
        const bigram = normalized.slice(i, i + 2);
        map.set(bigram, (map.get(bigram) ?? 0) + 1);
      }
      return map;
    };

    const va = getBigrams(a);
    const vb = getBigrams(b);

    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    va.forEach((count, bigram) => {
      dotProduct += count * (vb.get(bigram) ?? 0);
      magA += count * count;
    });
    vb.forEach(count => { magB += count * count; });

    if (magA === 0 || magB === 0) return 0;
    return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
  }
}
