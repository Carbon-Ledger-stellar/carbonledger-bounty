import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { NotificationService } from '../notifications/notification.service';
import { ActivityEventType, FeedQuery, RecordEventDto } from './activity-feed.dto';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  bountyId: string;
  actorId: string;
  targetUserId?: string;
  status?: string;
  message: string;
  createdAt: Date;
}

export interface FeedPage {
  data: ActivityEvent[];
  nextCursor: string | null;
}

export interface RankedBounty {
  bountyId: string;
  eventCount: number;
}

export interface RankedContributor {
  contributorId: string;
  eventCount: number;
}

// "Feed shows last 200 events" — events beyond this stay queryable via cursor
// pagination but move out of the hot in-memory window into the archive.
const LIVE_WINDOW_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_RANKING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class ActivityFeedService {
  private readonly logger = new Logger(ActivityFeedService.name);
  private readonly emitter = new EventEmitter();

  // Both kept newest-first; `live` is the hot window, `archive` is overflow.
  private live: ActivityEvent[] = [];
  private archive: ActivityEvent[] = [];
  private counter = 0;

  constructor(private readonly notifications: NotificationService) {}

  /** Subscribe to newly recorded events (used by the WebSocket gateway). Returns an unsubscribe fn. */
  onEvent(handler: (event: ActivityEvent) => void): () => void {
    this.emitter.on('event', handler);
    return () => this.emitter.off('event', handler);
  }

  record(dto: RecordEventDto): ActivityEvent {
    const event: ActivityEvent = {
      id: `evt-${Date.now()}-${this.counter++}`,
      type: dto.type,
      bountyId: dto.bountyId,
      actorId: dto.actorId,
      targetUserId: dto.targetUserId,
      status: dto.status,
      message: dto.message,
      createdAt: new Date(),
    };

    this.live.unshift(event);
    if (this.live.length > LIVE_WINDOW_SIZE) {
      const overflow = this.live.splice(LIVE_WINDOW_SIZE);
      this.archive.unshift(...overflow);
    }

    this.logger.log(`Activity event: ${event.type} on ${event.bountyId} by ${event.actorId}`);
    this.emitter.emit('event', event);
    this.dispatchNotification(event);
    return event;
  }

  /**
   * Paginated, filtered feed ordered newest-first. Pass `cursor` (an event id)
   * to continue an infinite-scroll session past the previous page.
   */
  getFeed(query: FeedQuery = {}): FeedPage {
    const { bountyId, contributorId, status, dateFrom, dateTo, cursor, limit = DEFAULT_PAGE_SIZE } = query;

    let results = [...this.live, ...this.archive];

    if (bountyId) results = results.filter(e => e.bountyId === bountyId);
    if (contributorId) {
      results = results.filter(e => e.actorId === contributorId || e.targetUserId === contributorId);
    }
    if (status) results = results.filter(e => e.status === status);
    if (dateFrom) results = results.filter(e => e.createdAt >= dateFrom);
    if (dateTo) results = results.filter(e => e.createdAt <= dateTo);

    let startIndex = 0;
    if (cursor) {
      const idx = results.findIndex(e => e.id === cursor);
      startIndex = idx === -1 ? 0 : idx + 1;
    }

    const data = results.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < results.length;
    const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

    return { data, nextCursor };
  }

  /** Bounties ranked by event volume within the trailing window (default 7 days). */
  getTrendingBounties(windowMs = DEFAULT_RANKING_WINDOW_MS, limit = 10): RankedBounty[] {
    return this.rank(e => e.bountyId, windowMs, limit).map(([bountyId, eventCount]) => ({
      bountyId,
      eventCount,
    }));
  }

  /** Contributors ranked by event volume (as actor) within the trailing window. */
  getMostActiveContributors(windowMs = DEFAULT_RANKING_WINDOW_MS, limit = 10): RankedContributor[] {
    return this.rank(e => e.actorId, windowMs, limit).map(([contributorId, eventCount]) => ({
      contributorId,
      eventCount,
    }));
  }

  private rank(keyOf: (e: ActivityEvent) => string, windowMs: number, limit: number): [string, number][] {
    const since = new Date(Date.now() - windowMs);
    const counts = new Map<string, number>();

    for (const event of [...this.live, ...this.archive]) {
      if (event.createdAt < since) continue;
      const key = keyOf(event);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  private dispatchNotification(event: ActivityEvent): void {
    if (!event.targetUserId) return;

    switch (event.type) {
      case 'application-submitted':
        this.notifications.notify(event.targetUserId, 'awaiting-review', event.bountyId, event.message);
        break;
      case 'reviewed':
        this.notifications.notify(event.targetUserId, 'feedback-received', event.bountyId, event.message);
        break;
      case 'approved':
      case 'rejected':
      case 'completed':
        this.notifications.notify(event.targetUserId, 'status-change', event.bountyId, event.message);
        break;
      case 'bounty-created':
        // Broadcast-only event; no single target user to notify.
        break;
    }
  }
}
