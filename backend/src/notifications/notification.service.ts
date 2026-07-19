import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';

export type NotificationType = 'status-change' | 'awaiting-review' | 'feedback-received';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  bountyId: string;
  message: string;
  createdAt: Date;
  read: boolean;
}

const MAX_STORED_PER_USER = 200;

/**
 * In-memory notification store + pub/sub. Delivery transport (WebSocket, email,
 * SMS) is layered on top by subscribing via `onNotification`; this service only
 * owns notification state and the "who gets notified about what" decision made
 * by callers.
 */
@Injectable()
export class NotificationService {
  private readonly emitter = new EventEmitter();
  private readonly byUser: Map<string, Notification[]> = new Map();
  private counter = 0;

  /** Subscribe to newly created notifications. Returns an unsubscribe function. */
  onNotification(handler: (notification: Notification) => void): () => void {
    this.emitter.on('notification', handler);
    return () => this.emitter.off('notification', handler);
  }

  notify(userId: string, type: NotificationType, bountyId: string, message: string): Notification {
    const notification: Notification = {
      id: `notif-${Date.now()}-${this.counter++}`,
      userId,
      type,
      bountyId,
      message,
      createdAt: new Date(),
      read: false,
    };

    const list = this.byUser.get(userId) ?? [];
    list.unshift(notification);
    if (list.length > MAX_STORED_PER_USER) list.length = MAX_STORED_PER_USER;
    this.byUser.set(userId, list);

    this.emitter.emit('notification', notification);
    return notification;
  }

  getForUser(userId: string, limit = 50): Notification[] {
    return (this.byUser.get(userId) ?? []).slice(0, limit);
  }

  markRead(userId: string, notificationId: string): Notification | undefined {
    const notification = this.byUser.get(userId)?.find(n => n.id === notificationId);
    if (notification) notification.read = true;
    return notification;
  }

  unreadCount(userId: string): number {
    return (this.byUser.get(userId) ?? []).filter(n => !n.read).length;
  }
}
