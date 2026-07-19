import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationService, Notification } from '../notifications/notification.service';
import { ActivityFeedService, ActivityEvent } from './activity-feed.service';

interface SubscribeFilter {
  bountyId?: string;
  contributorId?: string;
}

/**
 * Pushes activity-feed events and per-user notifications over WebSocket.
 *
 * Clients join rooms:
 *  - `feed:all` for every event (default on connect)
 *  - `bounty:<id>` after `subscribe` with a bountyId filter
 *  - `contributor:<id>` after `subscribe` with a contributorId filter
 *  - `user:<id>` after `register` with their userId, for targeted notifications
 */
@WebSocketGateway({ namespace: '/feed', cors: { origin: '*' } })
export class ActivityFeedGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ActivityFeedGateway.name);
  private unsubscribeEvent?: () => void;
  private unsubscribeNotification?: () => void;

  constructor(
    private readonly feed: ActivityFeedService,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    this.unsubscribeEvent = this.feed.onEvent(event => this.broadcastEvent(event));
    this.unsubscribeNotification = this.notifications.onNotification(n => this.pushNotification(n));
  }

  onModuleDestroy(): void {
    this.unsubscribeEvent?.();
    this.unsubscribeNotification?.();
  }

  handleConnection(client: Socket): void {
    client.join('feed:all');
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('register')
  handleRegister(@MessageBody() userId: string, @ConnectedSocket() client: Socket): { registered: boolean } {
    client.join(`user:${userId}`);
    return { registered: true };
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @MessageBody() filter: SubscribeFilter,
    @ConnectedSocket() client: Socket,
  ): { subscribed: boolean } {
    if (filter?.bountyId) client.join(`bounty:${filter.bountyId}`);
    if (filter?.contributorId) client.join(`contributor:${filter.contributorId}`);
    return { subscribed: true };
  }

  private broadcastEvent(event: ActivityEvent): void {
    if (!this.server) return;
    this.server.to('feed:all').emit('activity', event);
    this.server.to(`bounty:${event.bountyId}`).emit('activity', event);
    this.server.to(`contributor:${event.actorId}`).emit('activity', event);
  }

  private pushNotification(notification: Notification): void {
    if (!this.server) return;
    this.server.to(`user:${notification.userId}`).emit('notification', notification);
  }
}
