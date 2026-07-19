import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityFeedService } from './activity-feed.service';
import { ActivityFeedController } from './activity-feed.controller';
import { ActivityFeedGateway } from './activity-feed.gateway';

@Module({
  imports: [NotificationsModule],
  controllers: [ActivityFeedController],
  providers: [ActivityFeedService, ActivityFeedGateway],
  exports: [ActivityFeedService],
})
export class FeedModule {}
