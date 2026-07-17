# Issue #12 Campaign System - Next Steps

## Immediate Actions

### 1. Run Prisma Migration (Required)
```bash
cd backend
npx prisma migrate deploy
```

This will:
- Create the Campaign table
- Create the CampaignBounty join table
- Create the LeaderboardEntry table
- Create necessary indexes

### 2. Run Unit Tests (Recommended)
```bash
cd backend
npm test -- campaigns.spec.ts
```

Expected output: All 12+ tests passing ✅

### 3. Build Backend (Required before deployment)
```bash
npm run build
```

## Integration with Bounties Service

Currently, campaigns reference bounty IDs. To complete the integration:

1. **Update Bounties Service** to notify when bounties are deleted:
   ```typescript
   // In bounties.service.ts - add cleanup logic
   async deleteBounty(bountyId: string) {
     // Remove from all campaigns
     await this.prisma.campaignBounty.deleteMany({
       where: { bountyId }
     });
     // Remove from featured bounties
     await this.updateCampaignsFeatured(bountyId);
   }
   ```

2. **Update Bounty Model** to include campaign reference (optional):
   ```prisma
   model Bounty {
     // ... existing fields
     campaigns CampaignBounty[]
   }
   ```

## Setup Scheduled Jobs

For automatic campaign management, add to your task scheduler:

### Using NestJS Schedule Module (Recommended)

```bash
npm install @nestjs/schedule @nestjs/task-scheduling
```

Add to your scheduler service:

```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CampaignsService } from './campaigns/campaigns.service';

@Injectable()
export class SchedulerService {
  constructor(private campaignsService: CampaignsService) {}

  // Daily at midnight UTC
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async manageCampaigns() {
    try {
      // Transition campaigns based on dates
      await this.campaignsService.transitionAllCampaigns();
      
      // Archive campaigns completed more than 30 days ago
      await this.campaignsService.archiveOldCampaigns(30);
    } catch (error) {
      console.error('Campaign management failed:', error);
    }
  }
}
```

### Using External Cron Service (e.g., AWS EventBridge)

Create an endpoint that accepts webhook calls:

```typescript
// In campaigns.controller.ts
@Post('admin/cron-trigger')
@UseGuards(AuthGuard('jwt'))
async cronTrigger(@Body('apiKey') apiKey: string) {
  if (apiKey !== process.env.CRON_SECRET) {
    throw new UnauthorizedException();
  }
  await this.campaignsService.transitionAllCampaigns();
  await this.campaignsService.archiveOldCampaigns(30);
  return { success: true };
}
```

## Frontend Implementation

### 1. Create Campaign Pages

```bash
# Create new pages
mkdir frontend/app/campaigns
touch frontend/app/campaigns/page.tsx           # List view
touch frontend/app/campaigns/[id]/page.tsx       # Detail view
```

### 2. Install Required Dependencies

```bash
npm install swr
# Already have: next, react, typescript
```

### 3. Implement Components

Use the provided React components from `CAMPAIGNS_FRONTEND_INTEGRATION.md`:

- CampaignCard
- CampaignLeaderboard
- CampaignProgress
- StatusBadge
- BonusIndicator

### 4. Add Navigation

Update `app/layout.tsx`:

```typescript
// Add to navigation
<Link href="/campaigns">Campaigns</Link>
```

### 5. Test Campaign Flow

1. Create a test campaign starting 1 hour ago
2. Verify it transitions to 'active'
3. Add bounties
4. Update leaderboard entries
5. Verify bonus calculations

## Monitoring & Logging

### Key Events to Monitor

1. **Campaign Transitions**
   - Log every status change
   - Alert if transitions fail

2. **Leaderboard Updates**
   - Monitor for data consistency
   - Check for duplicate entries

3. **Bonus Calculations**
   - Verify top 3 get correct bonuses
   - Check for calculation errors

### Sample Monitoring Queries

```sql
-- Check campaign status distribution
SELECT status, COUNT(*) FROM "Campaign" GROUP BY status;

-- Check leaderboard for a campaign
SELECT contributor_id, earnings, bonus FROM "LeaderboardEntry" 
WHERE campaign_id = 'campaign-123' 
ORDER BY earnings DESC 
LIMIT 10;

-- Check for duplicate campaign bounties
SELECT campaign_id, bounty_id, COUNT(*) 
FROM "CampaignBounty" 
GROUP BY campaign_id, bounty_id 
HAVING COUNT(*) > 1;
```

## Testing Checklist

- [ ] Unit tests pass: `npm test -- campaigns.spec.ts`
- [ ] API endpoint: GET /api/v1/campaigns works
- [ ] API endpoint: POST /api/v1/campaigns creates campaign
- [ ] Campaign transitions automatically (pending → active)
- [ ] Leaderboard updates correctly
- [ ] Bonuses calculated correctly (15%, 10%, 5%)
- [ ] Featured bounties validation works (max 5)
- [ ] Archival of old campaigns works
- [ ] Frontend campaign list displays correctly
- [ ] Frontend campaign detail page loads data
- [ ] Leaderboard displays correctly on frontend

## Performance Considerations

### Database Query Optimization

Current indexes are set up for:
- Campaign status lookups
- Campaign date range queries
- Leaderboard ranking queries

Monitor query performance with:

```sql
-- Analyze slow queries
EXPLAIN ANALYZE SELECT * FROM "LeaderboardEntry" 
WHERE campaign_id = 'campaign-123' 
ORDER BY earnings DESC LIMIT 10;
```

### Caching (Optional Enhancement)

For high-traffic campaigns, consider Redis caching:

```typescript
// Cache leaderboard for 5 minutes
@Cached({
  key: 'leaderboard-{campaignId}',
  ttl: 300,
})
async getLeaderboard(campaignId: string) {
  // ...
}
```

## Maintenance Tasks

### Weekly
- [ ] Check campaign transition logs
- [ ] Verify leaderboard data consistency
- [ ] Monitor database performance

### Monthly
- [ ] Review archived campaigns
- [ ] Analyze campaign performance metrics
- [ ] Check for data anomalies

### Quarterly
- [ ] Optimize database queries if needed
- [ ] Review and update bonus structure if needed
- [ ] Plan new campaign features

## Troubleshooting

### Campaign not transitioning to active

```typescript
// Manual check
const campaign = await campaignsService.getCampaignById('campaign-123');
if (campaign.status === 'pending') {
  await campaignsService.transitionCampaignStatus('campaign-123');
}
```

### Leaderboard showing incorrect bonuses

```typescript
// Recalculate
await campaignsService.recalculateBonuses('campaign-123');
```

### Duplicate bounties in campaign

```typescript
// This is handled gracefully with unique constraint
// Check database:
SELECT COUNT(*) FROM "CampaignBounty" 
WHERE campaign_id = 'X' AND bounty_id = 'Y';
```

## Future Enhancements

### Phase 2 (After deployment)
1. Campaign templates for quick creation
2. Campaign analytics dashboard
3. Sponsorship system
4. Milestone rewards
5. Contribution decay algorithm

### Phase 3 (Long-term)
1. AI-powered campaign recommendations
2. Dynamic goal adjustment
3. Automated bonus optimization
4. Campaign performance predictions
5. Integration with external reward systems

## Support & Documentation

- **Technical Docs**: `CAMPAIGNS_IMPLEMENTATION.md`
- **Frontend Guide**: `CAMPAIGNS_FRONTEND_INTEGRATION.md`
- **Implementation Summary**: `ISSUE_12_IMPLEMENTATION_SUMMARY.md`
- **Checklist**: `IMPLEMENTATION_CHECKLIST.md`

## Rollback Plan

If issues occur during deployment:

1. Keep previous database snapshot
2. Can revert Prisma migration with:
   ```bash
   npx prisma migrate resolve --rolled-back <migration-name>
   ```
3. Revert to previous backend version
4. Test rollback procedures before production

## Success Metrics

After deployment, track:

1. **Campaign Adoption**
   - Number of active campaigns
   - Average bounties per campaign

2. **Leaderboard Engagement**
   - Number of contributors per campaign
   - Average earnings per contributor

3. **System Performance**
   - API response times < 200ms
   - Zero campaign transition failures
   - Zero database errors

4. **User Satisfaction**
   - Feature adoption rate
   - User feedback on bonus system
   - Campaign completion rate

## Questions?

Refer to the documentation files or the GitHub issue for additional context.

---

**Status**: ✅ Ready for deployment  
**Last Updated**: 2026-07-17  
**Version**: 1.0.0
