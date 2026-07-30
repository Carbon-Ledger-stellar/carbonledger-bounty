import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

/**
 * Runs an analytics snapshot every hour.
 *
 * NestJS's @nestjs/schedule package is not installed, so we use a plain
 * setInterval started in onModuleInit.  The first snapshot fires
 * immediately on startup so there is always at least one data point.
 */
@Injectable()
export class AnalyticsScheduler implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsScheduler.name);
  private readonly INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  constructor(private readonly analytics: AnalyticsService) {}

  onModuleInit() {
    // Fire once immediately, then every hour
    this.runSnapshot();
    setInterval(() => this.runSnapshot(), this.INTERVAL_MS);
    this.logger.log(
      `Analytics scheduler started. Next snapshot in ${this.INTERVAL_MS / 60_000} minutes.`,
    );
  }

  private async runSnapshot() {
    try {
      const snapshot = await this.analytics.computeAndSaveSnapshot();
      this.logger.log(
        `[Snapshot] open=${snapshot.bountiesOpen} ` +
          `completions=${snapshot.bountiesCompleted} ` +
          `payouts=$${snapshot.totalPayoutsUsd}`,
      );
    } catch (err) {
      this.logger.error('Analytics snapshot failed', err);
    }
  }
}
