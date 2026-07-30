import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { SCHEDULER_INTERVAL_MS, REVIEWER_TIMEOUT_DAYS } from './milestone.model';

/**
 * EscrowScheduler
 *
 * Polls on a fixed interval (default: every hour) and delegates to
 * EscrowService.processAutoReleases() to find in-review milestones whose
 * reviewer deadline has expired and automatically approves + releases their funds.
 *
 * Implemented as a plain NestJS service (OnModuleInit / OnModuleDestroy) to
 * avoid adding a @nestjs/schedule dependency to the project. The interval is
 * configurable via ESCROW_SCHEDULER_INTERVAL_MS environment variable, which
 * allows tests to set a very short interval or skip scheduling entirely.
 *
 * Auto-release rule:
 *   If a milestone has been in 'in-review' status for more than
 *   REVIEWER_TIMEOUT_DAYS (default: 7) without a reviewer decision,
 *   the system auto-approves the milestone and releases the funds.
 */
@Injectable()
export class EscrowScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EscrowScheduler.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly escrowService: EscrowService) {}

  onModuleInit(): void {
    // Allow tests or environments to disable the scheduler by setting the
    // interval to 0 or a very large value.
    const intervalMs =
      process.env.ESCROW_SCHEDULER_INTERVAL_MS != null
        ? parseInt(process.env.ESCROW_SCHEDULER_INTERVAL_MS, 10)
        : SCHEDULER_INTERVAL_MS;

    if (isNaN(intervalMs) || intervalMs <= 0) {
      this.logger.warn(
        'EscrowScheduler is disabled (ESCROW_SCHEDULER_INTERVAL_MS=0 or invalid)',
      );
      return;
    }

    this.logger.log(
      `EscrowScheduler started — polling every ${intervalMs / 1000}s. ` +
      `Reviewer timeout: ${REVIEWER_TIMEOUT_DAYS} days.`,
    );

    // Run once immediately on startup to catch any backlogs
    void this.runAutoRelease();

    this.intervalHandle = setInterval(() => {
      void this.runAutoRelease();
    }, intervalMs);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      this.logger.log('EscrowScheduler stopped');
    }
  }

  /**
   * Execute one pass of the auto-release logic.
   * Errors are caught and logged; they must not crash the interval.
   */
  private async runAutoRelease(): Promise<void> {
    try {
      const released = await this.escrowService.processAutoReleases();
      if (released > 0) {
        this.logger.log(
          `Auto-release pass complete: ${released} milestone(s) released`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Auto-release pass failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }
}
