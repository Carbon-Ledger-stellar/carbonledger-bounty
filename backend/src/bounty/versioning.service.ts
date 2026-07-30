import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AuditEntry,
  BountyVersion,
  InitBountyVersionDto,
  ReopenBountyDto,
  UpdateVersionStatusDto,
} from './versioning.dto';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Bounty versioning and re-opening.
 *
 * A closed bounty version can be re-opened (in full or for specific
 * milestones only) as a new, sequentially-numbered version with its own
 * budget. Every version and every re-open is recorded in an audit trail.
 *
 * In-memory store — mirrors the pattern used by TeamBountyService; replace
 * with Prisma in production.
 */
@Injectable()
export class BountyVersioningService {
  private readonly logger = new Logger(BountyVersioningService.name);

  /** bountyId -> versions, ordered by versionNumber ascending */
  private versions: Map<string, BountyVersion[]> = new Map();

  /** bountyId -> audit trail, ordered chronologically */
  private auditLog: Map<string, AuditEntry[]> = new Map();

  // ── Version creation ─────────────────────────────────────────────────────

  /**
   * Create the initial (v1) version for a bounty.
   */
  createInitialVersion(bountyId: string, dto: InitBountyVersionDto, actorId: string): BountyVersion {
    if (this.versions.has(bountyId)) {
      throw new BadRequestException(`Bounty ${bountyId} already has a version history`);
    }

    const now = new Date();
    const version: BountyVersion = {
      id: generateId('bv'),
      bountyId,
      versionNumber: 1,
      status: 'open',
      budgetUsd: dto.budgetUsd,
      milestoneIds: [],
      createdAt: now,
      updatedAt: now,
    };

    this.versions.set(bountyId, [version]);
    this.writeAudit(bountyId, version.versionNumber, 'version_created', actorId);

    this.logger.log(`Bounty ${bountyId} initialised at v1 (budget $${dto.budgetUsd})`);
    return version;
  }

  // ── Re-opening ────────────────────────────────────────────────────────────

  /**
   * Re-open a closed bounty as a new version. Supports partial re-opening
   * via `milestoneIds` (empty/omitted = full scope).
   */
  reopenBounty(bountyId: string, dto: ReopenBountyDto, actorId: string): BountyVersion {
    const history = this.getHistoryOrThrow(bountyId);
    const current = history[history.length - 1];

    if (current.status !== 'closed') {
      throw new BadRequestException(
        `Cannot re-open: bounty ${bountyId} current version is '${current.status}', expected 'closed'`,
      );
    }

    const now = new Date();
    const version: BountyVersion = {
      id: generateId('bv'),
      bountyId,
      versionNumber: current.versionNumber + 1,
      status: 'open',
      budgetUsd: dto.budgetUsd,
      milestoneIds: dto.milestoneIds ?? [],
      reopenReason: dto.reason,
      reopenedBy: actorId,
      createdAt: now,
      updatedAt: now,
    };

    history.push(version);
    this.writeAudit(bountyId, version.versionNumber, 'reopened', actorId, dto.reason, dto.notes);

    this.logger.log(
      `Bounty ${bountyId} re-opened as v${version.versionNumber} by ${actorId} (reason: ${dto.reason})`,
    );
    return version;
  }

  // ── Status changes ───────────────────────────────────────────────────────

  /**
   * Update the status of the current (latest) version.
   */
  updateVersionStatus(bountyId: string, dto: UpdateVersionStatusDto, actorId: string): BountyVersion {
    const history = this.getHistoryOrThrow(bountyId);
    const current = history[history.length - 1];

    if (current.status === 'closed') {
      throw new BadRequestException(
        `Bounty ${bountyId} current version is already closed; re-open to continue work`,
      );
    }

    current.status = dto.status;
    current.updatedAt = new Date();
    if (dto.status === 'closed') {
      current.closedAt = current.updatedAt;
    }

    this.writeAudit(bountyId, current.versionNumber, 'status_changed', actorId, undefined, dto.status);

    this.logger.log(`Bounty ${bountyId} v${current.versionNumber} status -> ${dto.status}`);
    return current;
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  /** Full version history, ordered oldest to newest. */
  getVersionHistory(bountyId: string): BountyVersion[] {
    return this.getHistoryOrThrow(bountyId);
  }

  /** The latest (current) version. */
  getCurrentVersion(bountyId: string): BountyVersion {
    const history = this.getHistoryOrThrow(bountyId);
    return history[history.length - 1];
  }

  /** Full audit trail — who reopened, when, and why — ordered chronologically. */
  getAuditTrail(bountyId: string): AuditEntry[] {
    this.getHistoryOrThrow(bountyId);
    return this.auditLog.get(bountyId) ?? [];
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private getHistoryOrThrow(bountyId: string): BountyVersion[] {
    const history = this.versions.get(bountyId);
    if (!history || history.length === 0) {
      throw new NotFoundException(`No version history for bounty ${bountyId}`);
    }
    return history;
  }

  private writeAudit(
    bountyId: string,
    versionNumber: number,
    action: AuditEntry['action'],
    actorId: string,
    reason?: AuditEntry['reason'],
    notes?: string,
  ): void {
    const entry: AuditEntry = {
      id: generateId('audit'),
      bountyId,
      versionNumber,
      action,
      actorId,
      reason,
      notes,
      createdAt: new Date(),
    };

    const log = this.auditLog.get(bountyId) ?? [];
    log.push(entry);
    this.auditLog.set(bountyId, log);
  }
}
