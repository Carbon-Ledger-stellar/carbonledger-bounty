import { NotificationService } from '../notifications/notification.service';
import { ActivityFeedService } from './activity-feed.service';
import { RecordEventDto } from './activity-feed.dto';

function makeEvent(overrides: Partial<RecordEventDto> = {}): RecordEventDto {
  return {
    type: 'application-submitted',
    bountyId: 'bounty-1',
    actorId: 'contributor-1',
    targetUserId: 'reviewer-1',
    message: 'Applied to bounty-1',
    ...overrides,
  };
}

describe('ActivityFeedService', () => {
  let notifications: NotificationService;
  let feed: ActivityFeedService;

  beforeEach(() => {
    notifications = new NotificationService();
    feed = new ActivityFeedService(notifications);
  });

  it('records an event and returns it with an id and timestamp', () => {
    const event = feed.record(makeEvent());
    expect(event.id).toBeDefined();
    expect(event.createdAt).toBeInstanceOf(Date);
    expect(event.type).toBe('application-submitted');
  });

  it('returns events newest-first in the feed', () => {
    feed.record(makeEvent({ message: 'first' }));
    feed.record(makeEvent({ message: 'second' }));

    const page = feed.getFeed();
    expect(page.data.map(e => e.message)).toEqual(['second', 'first']);
  });

  it('filters by bountyId, contributorId, and status', () => {
    feed.record(makeEvent({ bountyId: 'bounty-1', actorId: 'contributor-1', status: 'open' }));
    feed.record(makeEvent({ bountyId: 'bounty-2', actorId: 'contributor-2', status: 'closed' }));

    expect(feed.getFeed({ bountyId: 'bounty-1' }).data).toHaveLength(1);
    expect(feed.getFeed({ contributorId: 'contributor-2' }).data).toHaveLength(1);
    expect(feed.getFeed({ status: 'closed' }).data).toHaveLength(1);
    expect(feed.getFeed({ bountyId: 'bounty-1', status: 'closed' }).data).toHaveLength(0);
  });

  it('filters by contributorId matching either actor or target user', () => {
    feed.record(makeEvent({ actorId: 'alice', targetUserId: 'bob' }));

    expect(feed.getFeed({ contributorId: 'alice' }).data).toHaveLength(1);
    expect(feed.getFeed({ contributorId: 'bob' }).data).toHaveLength(1);
    expect(feed.getFeed({ contributorId: 'carol' }).data).toHaveLength(0);
  });

  it('filters by date range', () => {
    const event = feed.record(makeEvent());
    const before = new Date(event.createdAt.getTime() - 1000);
    const after = new Date(event.createdAt.getTime() + 1000);

    expect(feed.getFeed({ dateFrom: before, dateTo: after }).data).toHaveLength(1);
    expect(feed.getFeed({ dateFrom: after }).data).toHaveLength(0);
  });

  it('paginates with a cursor for infinite scroll', () => {
    for (let i = 0; i < 25; i++) {
      feed.record(makeEvent({ message: `msg-${i}` }));
    }

    const firstPage = feed.getFeed({ limit: 10 });
    expect(firstPage.data).toHaveLength(10);
    expect(firstPage.nextCursor).not.toBeNull();
    // Newest recorded is msg-24, so first page starts there.
    expect(firstPage.data[0].message).toBe('msg-24');

    const secondPage = feed.getFeed({ limit: 10, cursor: firstPage.nextCursor! });
    expect(secondPage.data).toHaveLength(10);
    expect(secondPage.data[0].id).not.toBe(firstPage.data[0].id);

    const thirdPage = feed.getFeed({ limit: 10, cursor: secondPage.nextCursor! });
    expect(thirdPage.data).toHaveLength(5);
    expect(thirdPage.nextCursor).toBeNull();
  });

  it('keeps events queryable via cursor once they age out of the 200-event live window', () => {
    for (let i = 0; i < 250; i++) {
      feed.record(makeEvent({ message: `msg-${i}` }));
    }

    // Oldest event (msg-0) has aged into the archive but must still be reachable.
    const all = feed.getFeed({ limit: 250 });
    expect(all.data).toHaveLength(250);
    expect(all.data[all.data.length - 1].message).toBe('msg-0');
  });

  it('ranks bounties by event volume for trending', () => {
    feed.record(makeEvent({ bountyId: 'bounty-1' }));
    feed.record(makeEvent({ bountyId: 'bounty-1' }));
    feed.record(makeEvent({ bountyId: 'bounty-2' }));

    const trending = feed.getTrendingBounties();
    expect(trending[0]).toEqual({ bountyId: 'bounty-1', eventCount: 2 });
    expect(trending[1]).toEqual({ bountyId: 'bounty-2', eventCount: 1 });
  });

  it('excludes events outside the ranking window from trending/most-active', () => {
    const oldEvent = feed.record(makeEvent({ bountyId: 'bounty-old', actorId: 'contributor-old' }));
    oldEvent.createdAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    feed.record(makeEvent({ bountyId: 'bounty-new', actorId: 'contributor-new' }));

    const trending = feed.getTrendingBounties(7 * 24 * 60 * 60 * 1000);
    expect(trending.map(t => t.bountyId)).toEqual(['bounty-new']);

    const mostActive = feed.getMostActiveContributors(7 * 24 * 60 * 60 * 1000);
    expect(mostActive.map(c => c.contributorId)).toEqual(['contributor-new']);
  });

  it('ranks contributors by event volume for most-active', () => {
    feed.record(makeEvent({ actorId: 'alice' }));
    feed.record(makeEvent({ actorId: 'alice' }));
    feed.record(makeEvent({ actorId: 'bob' }));

    const mostActive = feed.getMostActiveContributors();
    expect(mostActive[0]).toEqual({ contributorId: 'alice', eventCount: 2 });
  });

  it('notifies the target user with the correct notification type per event', () => {
    feed.record(makeEvent({ type: 'application-submitted', targetUserId: 'reviewer-1' }));
    feed.record(makeEvent({ type: 'reviewed', targetUserId: 'contributor-1' }));
    feed.record(makeEvent({ type: 'approved', targetUserId: 'contributor-1' }));

    expect(notifications.getForUser('reviewer-1')[0].type).toBe('awaiting-review');
    const contributorNotifs = notifications.getForUser('contributor-1');
    expect(contributorNotifs[0].type).toBe('status-change'); // approved (most recent)
    expect(contributorNotifs[1].type).toBe('feedback-received'); // reviewed
  });

  it('does not notify when an event has no targetUserId', () => {
    feed.record(makeEvent({ type: 'bounty-created', targetUserId: undefined, actorId: 'maintainer-1' }));
    expect(notifications.getForUser('maintainer-1')).toHaveLength(0);
  });

  it('emits recorded events to subscribers', () => {
    const received: string[] = [];
    feed.onEvent(e => received.push(e.message));

    feed.record(makeEvent({ message: 'broadcast me' }));

    expect(received).toEqual(['broadcast me']);
  });
});
