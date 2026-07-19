import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService();
  });

  it('creates a notification and stores it for the target user', () => {
    const n = service.notify('user-1', 'awaiting-review', 'bounty-1', 'New application submitted');

    expect(n.userId).toBe('user-1');
    expect(n.type).toBe('awaiting-review');
    expect(n.read).toBe(false);
    expect(service.getForUser('user-1')).toEqual([n]);
  });

  it('returns notifications for a user newest-first', () => {
    service.notify('user-1', 'status-change', 'bounty-1', 'first');
    service.notify('user-1', 'status-change', 'bounty-1', 'second');

    const list = service.getForUser('user-1');
    expect(list.map(n => n.message)).toEqual(['second', 'first']);
  });

  it('isolates notifications per user', () => {
    service.notify('user-1', 'status-change', 'bounty-1', 'for user 1');
    service.notify('user-2', 'status-change', 'bounty-1', 'for user 2');

    expect(service.getForUser('user-1')).toHaveLength(1);
    expect(service.getForUser('user-2')).toHaveLength(1);
    expect(service.getForUser('user-1')[0].message).toBe('for user 1');
  });

  it('marks a notification read and updates unread count', () => {
    const n = service.notify('user-1', 'feedback-received', 'bounty-1', 'reviewed');
    expect(service.unreadCount('user-1')).toBe(1);

    service.markRead('user-1', n.id);

    expect(service.unreadCount('user-1')).toBe(0);
    expect(service.getForUser('user-1')[0].read).toBe(true);
  });

  it('notifies subscribers via onNotification', () => {
    const received: string[] = [];
    const unsubscribe = service.onNotification(n => received.push(n.message));

    service.notify('user-1', 'status-change', 'bounty-1', 'hello');
    expect(received).toEqual(['hello']);

    unsubscribe();
    service.notify('user-1', 'status-change', 'bounty-1', 'ignored after unsubscribe');
    expect(received).toEqual(['hello']);
  });

  it('caps stored notifications per user', () => {
    for (let i = 0; i < 250; i++) {
      service.notify('user-1', 'status-change', 'bounty-1', `msg-${i}`);
    }
    expect(service.getForUser('user-1', 1000)).toHaveLength(200);
    // Most recent survive the cap.
    expect(service.getForUser('user-1')[0].message).toBe('msg-249');
  });
});
