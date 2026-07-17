import { Injectable, Logger } from '@nestjs/common';
import {
  BountyType,
  QualityMetricsInput,
  SubmitMetricsDto,
  ReviewDecisionDto,
} from './quality.dto';

export interface GateResult {
  gate: string;
  passed: boolean;
  actual: number | boolean | string;
  required: number | boolean | string;
  details: string;
}

export interface QualityCheckResult {
  id: string;
  bountyId: string;
  bountyType: BountyType;
  contributorId: string;
  gates: GateResult[];
  allPassed: boolean;
  paymentBlocked: boolean;
  status: 'pending_review' | 'approved' | 'rejected';
  reviewerId?: string;
  reviewDetails?: string;
  submittedAt: Date;
  reviewedAt?: Date;
}

// ── Gate definitions per bounty type ────────────────────────────────────────

type GateDefinition = {
  name: string;
  check: (m: QualityMetricsInput) => { passed: boolean; actual: number | boolean | string; required: number | boolean | string; details: string };
};

const GATE_DEFINITIONS: Record<BountyType, GateDefinition[]> = {
  'smart-contracts': [
    {
      name: 'Test Coverage ≥ 90%',
      check: (m) => {
        const actual = m.testCoverage ?? 0;
        const passed = actual >= 90;
        return { passed, actual, required: 90, details: `Coverage is ${actual}% — must be ≥ 90%` };
      },
    },
    {
      name: 'Zero Security Issues',
      check: (m) => {
        const actual = m.securityIssues ?? 999;
        const passed = actual === 0;
        return { passed, actual, required: 0, details: `${actual} security issue(s) found — must be 0` };
      },
    },
  ],

  'frontend': [
    {
      name: 'Accessibility Score > 85',
      check: (m) => {
        const actual = m.accessibilityScore ?? 0;
        const passed = actual > 85;
        return { passed, actual, required: 85, details: `a11y score is ${actual} — must be > 85` };
      },
    },
    {
      name: 'Lighthouse Score > 80',
      check: (m) => {
        const actual = m.lighthouseScore ?? 0;
        const passed = actual > 80;
        return { passed, actual, required: 80, details: `Lighthouse score is ${actual} — must be > 80` };
      },
    },
  ],

  'backend': [
    {
      name: 'Test Coverage ≥ 80%',
      check: (m) => {
        const actual = m.backendCoverage ?? 0;
        const passed = actual >= 80;
        return { passed, actual, required: 80, details: `Coverage is ${actual}% — must be ≥ 80%` };
      },
    },
    {
      name: 'All Tests Passing',
      check: (m) => {
        const actual = m.allTestsPassing ?? false;
        return { passed: actual, actual, required: true, details: actual ? 'All tests pass' : 'Some tests are failing' };
      },
    },
  ],

  'devops': [
    {
      name: 'Runbook Present',
      check: (m) => {
        const actual = m.hasRunbook ?? false;
        return { passed: actual, actual, required: true, details: actual ? 'Runbook provided' : 'Runbook is required' };
      },
    },
    {
      name: 'Deployment Verified',
      check: (m) => {
        const actual = m.deploymentVerified ?? false;
        return { passed: actual, actual, required: true, details: actual ? 'Deployment verified' : 'Deployment must be verified in staging/prod' };
      },
    },
  ],

  'documentation': [
    {
      name: 'Minimum Word Count ≥ 500',
      check: (m) => {
        const actual = m.wordCount ?? 0;
        const passed = actual >= 500;
        return { passed, actual, required: 500, details: `${actual} words — must be ≥ 500` };
      },
    },
    {
      name: 'Examples Included',
      check: (m) => {
        const actual = m.hasExamples ?? false;
        return { passed: actual, actual, required: true, details: actual ? 'Examples present' : 'At least one code/usage example is required' };
      },
    },
  ],

  'security': [
    {
      name: 'Zero Vulnerabilities',
      check: (m) => {
        const actual = m.vulnCount ?? 999;
        const passed = actual === 0;
        return { passed, actual, required: 0, details: `${actual} vulnerabilities — must be 0` };
      },
    },
    {
      name: 'Security Report Attached',
      check: (m) => {
        const actual = m.hasSecurityReport ?? false;
        return { passed: actual, actual, required: true, details: actual ? 'Report attached' : 'A formal security report is required' };
      },
    },
  ],

  'design': [
    {
      name: 'Design File Provided',
      check: (m) => {
        const actual = m.hasDesignFile ?? false;
        return { passed: actual, actual, required: true, details: actual ? 'Design file present' : 'Design file (Figma/Sketch) required' };
      },
    },
    {
      name: 'Responsive Verified',
      check: (m) => {
        const actual = m.responsiveVerified ?? false;
        return { passed: actual, actual, required: true, details: actual ? 'Responsive layout verified' : 'Must verify mobile + desktop layouts' };
      },
    },
  ],

  'data': [
    {
      name: 'Schema Documented',
      check: (m) => {
        const actual = m.schemaDocumented ?? false;
        return { passed: actual, actual, required: true, details: actual ? 'Schema documented' : 'All schema changes must be documented' };
      },
    },
    {
      name: 'Migration Tested',
      check: (m) => {
        const actual = m.migrationTested ?? false;
        return { passed: actual, actual, required: true, details: actual ? 'Migration tested' : 'Migration must be tested against a copy of production data' };
      },
    },
  ],
};

@Injectable()
export class QualityGatesService {
  private readonly logger = new Logger(QualityGatesService.name);

  // In-memory quality check store (replace with DB table in production)
  private checks: Map<string, QualityCheckResult> = new Map();

  // Trend tracking per bounty type: stores the last N scores
  private trends: Map<BountyType, number[]> = new Map();

  /**
   * Submit quality metrics for a bounty submission.
   * Runs all gates for the given bounty type.
   */
  submitMetrics(dto: SubmitMetricsDto): QualityCheckResult {
    const definitions = GATE_DEFINITIONS[dto.bountyType];
    if (!definitions) {
      throw new Error(`Unknown bounty type: ${dto.bountyType}`);
    }

    const gates: GateResult[] = definitions.map(def => ({
      gate: def.name,
      ...def.check(dto.metrics),
    }));

    const allPassed = gates.every(g => g.passed);
    const passedCount = gates.filter(g => g.passed).length;
    const score = Math.round((passedCount / gates.length) * 100);

    // Track trend
    const existing = this.trends.get(dto.bountyType) ?? [];
    this.trends.set(dto.bountyType, [...existing.slice(-99), score]);

    const id = `qc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const result: QualityCheckResult = {
      id,
      bountyId: dto.bountyId,
      bountyType: dto.bountyType,
      contributorId: dto.contributorId,
      gates,
      allPassed,
      paymentBlocked: !allPassed,
      status: 'pending_review',
      submittedAt: new Date(),
    };

    this.checks.set(id, result);

    this.logger.log(
      `Quality check ${id} for bounty ${dto.bountyId} (${dto.bountyType}): ${passedCount}/${gates.length} gates passed — payment ${allPassed ? 'allowed' : 'BLOCKED'}`,
    );

    return result;
  }

  /**
   * Reviewer approves or requests changes on a quality check.
   */
  reviewSubmission(dto: ReviewDecisionDto): QualityCheckResult {
    const check = this.checks.get(dto.qualityCheckId);
    if (!check) {
      throw new Error(`Quality check ${dto.qualityCheckId} not found`);
    }

    check.status = dto.decision === 'approved' ? 'approved' : 'rejected';
    check.reviewerId = dto.reviewerId;
    check.reviewDetails = dto.details;
    check.reviewedAt = new Date();

    // If reviewer approves, unblock payment even if some gates failed
    if (dto.decision === 'approved') {
      check.paymentBlocked = false;
    }

    this.checks.set(dto.qualityCheckId, check);
    this.logger.log(`Quality check ${dto.qualityCheckId} reviewed by ${dto.reviewerId}: ${dto.decision}`);

    return check;
  }

  /**
   * Get a quality check by ID.
   */
  getCheck(id: string): QualityCheckResult | null {
    return this.checks.get(id) ?? null;
  }

  /**
   * List all quality checks, optionally filtered.
   */
  listChecks(filters?: { bountyId?: string; contributorId?: string; status?: string }) {
    let results = Array.from(this.checks.values());
    if (filters?.bountyId) results = results.filter(c => c.bountyId === filters.bountyId);
    if (filters?.contributorId) results = results.filter(c => c.contributorId === filters.contributorId);
    if (filters?.status) results = results.filter(c => c.status === filters.status);
    return results.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }

  /**
   * Get quality trend statistics per bounty type.
   */
  getTrends(): Record<string, { averageScore: number; recentScores: number[]; trend: 'improving' | 'stable' | 'declining' }> {
    const result: Record<string, { averageScore: number; recentScores: number[]; trend: 'improving' | 'stable' | 'declining' }> = {};

    this.trends.forEach((scores, type) => {
      const recent = scores.slice(-10);
      const avg = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
      let trend: 'improving' | 'stable' | 'declining' = 'stable';

      if (recent.length >= 4) {
        const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
        const secondHalf = recent.slice(Math.floor(recent.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        if (secondAvg - firstAvg > 5) trend = 'improving';
        else if (firstAvg - secondAvg > 5) trend = 'declining';
      }

      result[type] = { averageScore: Math.round(avg), recentScores: recent, trend };
    });

    return result;
  }

  /**
   * Get gate definitions for a bounty type (for documentation/UI).
   */
  getGateDefinitions(bountyType: BountyType) {
    const defs = GATE_DEFINITIONS[bountyType];
    if (!defs) throw new Error(`Unknown bounty type: ${bountyType}`);
    return defs.map(d => ({ name: d.name, bountyType }));
  }

  /**
   * List supported bounty types.
   */
  getSupportedTypes(): BountyType[] {
    return Object.keys(GATE_DEFINITIONS) as BountyType[];
  }
}
