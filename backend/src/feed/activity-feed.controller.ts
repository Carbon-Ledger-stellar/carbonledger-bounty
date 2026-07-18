import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ActivityFeedService } from './activity-feed.service';
import { FeedSort, RecordEventDto } from './activity-feed.dto';

@Controller('api/v1/feed')
export class ActivityFeedController {
  constructor(private readonly feed: ActivityFeedService) {}

  /**
   * Filtered, paginated activity feed. `sort=recent` (default) returns a
   * chronological page for infinite scroll; `trending`/`most-active` return
   * ranked bounties/contributors instead of raw events.
   */
  @Get()
  async getFeed(
    @Query('sort') sort: FeedSort = 'recent',
    @Query('bountyId') bountyId?: string,
    @Query('contributorId') contributorId?: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('windowDays') windowDays?: string,
  ) {
    const limitN = limit ? Number(limit) : undefined;
    const windowMs = (windowDays ? Number(windowDays) : 7) * 24 * 60 * 60 * 1000;

    if (sort === 'trending') {
      return this.feed.getTrendingBounties(windowMs, limitN ?? 10);
    }
    if (sort === 'most-active') {
      return this.feed.getMostActiveContributors(windowMs, limitN ?? 10);
    }

    return this.feed.getFeed({
      bountyId,
      contributorId,
      status,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      cursor,
      limit: limitN,
    });
  }

  /**
   * Record an activity event (bounty state transition, application, review decision).
   * Called internally by other services in production; exposed here for testing/integration.
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async recordEvent(@Body() dto: RecordEventDto) {
    return this.feed.record(dto);
  }
}
