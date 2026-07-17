# Campaign System Implementation - Issue #12

## Overview

This document describes the implementation of the **Seasonal Campaigns and Themed Bounty Collections** feature (Issue #12) for the CarbonLedger bounty system.

## Requirements Met

### ✅ Campaign Model
- **Fields**: `campaignId`, `name`, `description`, `startDate`, `endDate`, `goal`, `status`, `featuredBounties[]`
- **Status Transitions**: `pending` → `active` → `completed` → `archived`
- **Database**: PostgreSQL with Prisma ORM

### ✅ Featured Bounties
- Maximum 5 featured bounties per campaign
- Easily highlighted in campaign UI
- Can be updated dynamically
- Automatically removed if bounty is removed from campaign

### ✅ Leaderboard System
- **Top 10 Contributors** tracked by earnings and completions
- **Ranking**: Sorted by total earnings (primary), then by completion count (secondary)
- **Bonus Rewards**:
  - 1st place: 15% bonus on earnings
  - 2nd place: 10% bonus on earnings
  - 3rd place: 5% bonus on earnings

### ✅ Automatic State Transitions
- Campaigns automatically transition from `pending` → `active` when start date is reached
- Transition to `completed` when end date is reached
- Manual or automatic archival after completion
- Bonus recalculation occurs at completion

### ✅ Testing
- Comprehensive unit tests in `campaigns.spec.ts`
- Covers:
  - Campaign creation and validation
  - Status transitions
  - Featured bounty management
  - Leaderboard calculations
  - Bonus assignment
  - Campaign archival

## Project Structure

```
backend/src/campaigns/
├── campaigns.controller.ts    # REST API endpoints
├── campaigns.service.ts        # Business logic
├── campaigns.dto.ts            # Data transfer objects & validation
├── campaigns.module.ts         # NestJS module definition
└── campaigns.spec.ts           # Unit tests
```

## Database Schema

### Campaign Model
```sql
CREATE TABLE "Campaign" (
  id              String @id @default(cuid())
  campaignId      String @unique
  name            String
  description     String
  startDate       DateTime
  endDate         DateTime
  goal            Int @default(50)
  status          String @default("pending")
  featuredBounties String[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
);
```

### CampaignBounty Model (Many-to-Many)
```sql
CREATE TABLE "CampaignBounty" (
  id         String @id @default(cuid())
  campaignId String
  bountyId   String
  addedAt    DateTime @default(now())
  
  @@unique([campaignId, bountyId])
};
```

### LeaderboardEntry Model
```sql
CREATE TABLE "LeaderboardEntry" (
  id            String @id @default(cuid())
  campaignId    String
  contributorId String
  earnings      Int @default(0)
  completions   Int @default(0)
  bonus         Int @default(0)
  rank          Int @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@unique([campaignId, contributorId])
};
```

## API Endpoints

### Public Endpoints (No Auth Required)

#### List Campaigns
```
GET /api/v1/campaigns?status=active
```
Query Parameters:
- `status`: Filter by status (`pending`, `active`, `completed`, `archived`)

Response:
```json
[
  {
    "id": "...",
    "campaignId": "campaign-123",
    "name": "Q4 DevOps Push",
    "description": "Infrastructure automation focus",
    "startDate": "2026-10-01T00:00:00Z",
    "endDate": "2026-12-31T23:59:59Z",
    "goal": 50,
    "status": "active",
    "featuredBounties": ["bounty-1", "bounty-2"],
    "bountyCount": 30,
    "createdAt": "2026-09-15T10:00:00Z",
    "updatedAt": "2026-09-15T10:00:00Z"
  }
]
```

#### Get Campaign Details
```
GET /api/v1/campaigns/:campaignId
```

Response: Single campaign object (same structure as above)

#### Get Campaign Statistics
```
GET /api/v1/campaigns/:campaignId/stats
```

Response:
```json
{
  "campaignId": "campaign-123",
  "name": "Q4 DevOps Push",
  "status": "active",
  "bountyCount": 30,
  "contributorCount": 15,
  "progress": "30/50",
  "totalEarnings": 45000,
  "totalCompletions": 120,
  "daysRemaining": 105
}
```

#### Get Campaign Leaderboard
```
GET /api/v1/campaigns/:campaignId/leaderboard?limit=10
```

Query Parameters:
- `limit`: Number of top contributors to return (default: 10, max suggested: 10)

Response:
```json
[
  {
    "id": "entry-1",
    "contributorId": "contributor-alice",
    "earnings": 5000,
    "completions": 8,
    "bonus": 15,
    "rank": 1
  },
  {
    "id": "entry-2",
    "contributorId": "contributor-bob",
    "earnings": 3500,
    "completions": 6,
    "bonus": 10,
    "rank": 2
  }
]
```

### Protected Endpoints (JWT Auth Required)

#### Create Campaign
```
POST /api/v1/campaigns
```

Request Body:
```json
{
  "name": "Q4 DevOps Push",
  "description": "Infrastructure automation focus",
  "startDate": "2026-10-01T00:00:00Z",
  "endDate": "2026-12-31T23:59:59Z",
  "goal": 50
}
```

Validation:
- `name`: Required, max 100 characters
- `description`: Required, max 500 characters
- `startDate`: Required, must be ISO date
- `endDate`: Required, must be after `startDate`
- `goal`: Optional, defaults to 50, must be >= 1

#### Update Campaign
```
POST /api/v1/campaigns/:campaignId/update
```

Request Body (all optional):
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "endDate": "2026-12-31T23:59:59Z",
  "goal": 60
}
```

#### Add Bounties to Campaign
```
POST /api/v1/campaigns/:campaignId/bounties/add
```

Request Body:
```json
{
  "bountyIds": ["bounty-1", "bounty-2", "bounty-3"]
}
```

Response:
```json
{
  "success": true,
  "message": "Added 3 bounties to campaign"
}
```

#### Remove Bounty from Campaign
```
POST /api/v1/campaigns/:campaignId/bounties/remove
```

Request Body:
```json
{
  "bountyId": "bounty-1"
}
```

#### Set Featured Bounties
```
POST /api/v1/campaigns/:campaignId/featured
```

Request Body:
```json
{
  "featuredBountyIds": ["bounty-1", "bounty-2", "bounty-3"]
}
```

Validation:
- Maximum 5 bounties can be featured
- All featured bounties must exist in the campaign

#### Update Leaderboard Entry
```
POST /api/v1/campaigns/:campaignId/leaderboard/update
```

Request Body (at least one required):
```json
{
  "contributorId": "contributor-alice",
  "earnings": 1000,
  "completions": 2
}
```

Creates a new leaderboard entry if not exists, or updates existing.

#### Recalculate Bonuses
```
POST /api/v1/campaigns/:campaignId/recalculate-bonuses
```

Manually recalculates bonuses (top 3 get 15%, 10%, 5%). Usually called automatically when campaign completes.

Response:
```json
{
  "success": true,
  "message": "Bonuses recalculated"
}
```

#### Transition Campaign Status
```
POST /api/v1/campaigns/:campaignId/transition
```

Manually trigger status transition (pending → active → completed → archived).

Response: Updated campaign object

#### Transition All Campaigns (Admin)
```
POST /api/v1/campaigns/admin/transition-all
```

Transitions all campaigns that need status updates. Should be called by a scheduled job daily.

Response:
```json
{
  "success": true,
  "message": "All campaigns transitioned"
}
```

#### Archive Old Campaigns (Admin)
```
POST /api/v1/campaigns/admin/archive-old?daysOld=30
```

Query Parameters:
- `daysOld`: Days since completion to archive (default: 30)

Response:
```json
{
  "success": true,
  "archivedCount": 3
}
```

## Campaign Lifecycle

### Pending → Active
- Occurs when current time >= campaign start date
- Can be automatic or manual
- Campaign appears in public listings
- Contributors can see and apply for bounties

### Active → Completed
- Occurs when current time >= campaign end date
- Bonuses are automatically recalculated
- Campaign leaderboard is finalized
- No more bounty applications accepted

### Completed → Archived
- Automatic or manual transition
- By default, completed campaigns are archived after 30 days
- Archived campaigns are excluded from public listings (optional based on UI)

## Key Features

### 1. Automatic State Management
The service provides automatic campaign status transitions based on system time:

```typescript
// Automatically transitions campaigns based on current time
await campaignService.transitionCampaignStatus(campaignId);

// Transitions all campaigns that need updates
await campaignService.transitionAllCampaigns();

// Archives campaigns older than 30 days
await campaignService.archiveOldCampaigns(30);
```

### 2. Leaderboard & Bonus System
- Tracks contributor earnings and completion count
- Automatically assigns bonuses to top 3:
  - 1st: 15% bonus
  - 2nd: 10% bonus
  - 3rd: 5% bonus

```typescript
// Update leaderboard (increments values)
await campaignService.updateLeaderboardEntry({
  campaignId: 'campaign-123',
  contributorId: 'contributor-alice',
  earnings: 500,
  completions: 1,
});

// Recalculate bonuses (usually on campaign completion)
await campaignService.recalculateBonuses(campaignId);
```

### 3. Featured Bounties
Campaigns can highlight up to 5 featured bounties:

```typescript
await campaignService.setFeaturedBounties({
  campaignId: 'campaign-123',
  featuredBountyIds: ['bounty-1', 'bounty-2', 'bounty-3'],
});
```

### 4. Campaign Statistics
Real-time metrics for campaign performance:

```typescript
const stats = await campaignService.getCampaignStats(campaignId);
// Returns: bountyCount, contributorCount, progress, totalEarnings, etc.
```

## Integration Points

### With Bounties Service
- Campaigns reference bounty IDs (no direct dependency)
- Bounty service should notify campaigns when bounty is deleted/archived

### With Leaderboard
- Tracked separately from bounty completion
- Can aggregate from bounty service or use dedicated leaderboard

### Scheduled Jobs Needed
For automated campaign management, add these to a scheduled task runner:

```typescript
// Daily at midnight
@Cron('0 0 * * *')
async manageAllCampaigns() {
  await this.campaignsService.transitionAllCampaigns();
  await this.campaignsService.archiveOldCampaigns(30);
}
```

## Testing

Run tests with:
```bash
npm test -- campaigns.spec.ts
```

Test coverage includes:
- ✅ Campaign creation with validation
- ✅ Status transitions (pending → active → completed → archived)
- ✅ Featured bounties management (max 5)
- ✅ Leaderboard sorting and updates
- ✅ Bonus calculation (15%, 10%, 5%)
- ✅ Campaign archival
- ✅ Statistics calculation
- ✅ Error handling (invalid dates, non-existent campaigns, etc.)

## Error Handling

The service provides comprehensive error handling:

```
BadRequestException:
- endDate must be after startDate
- Maximum 5 featured bounties allowed
- Bounties not in campaign

NotFoundException:
- Campaign not found
- Bounty not found in campaign

ConflictException:
- Bounty already in campaign (handled gracefully)
```

## Future Enhancements

1. **Campaign Templates**: Pre-defined campaign configurations
2. **Auto-Scaling Goals**: Adjust goal based on available bounties
3. **Milestone Rewards**: Bonus rewards at specific bounty counts
4. **Campaign Analytics**: Detailed performance metrics and trends
5. **Campaign Sponsorships**: Organizations can sponsor campaigns
6. **Contribution Decay**: Older contributions weighted less in leaderboard

## Configuration

No additional environment variables needed. Campaign settings are:
- Goal (default: 50 bounties)
- Bonus percentages: hardcoded as [15, 10, 5] for top 3
- Archival window: 30 days (configurable in method call)

## Migration to Production

Before deploying to production:

1. **Run Prisma Migration**:
   ```bash
   npx prisma migrate deploy
   ```

2. **Initialize Scheduled Jobs**:
   - Add `transitionAllCampaigns()` to daily scheduler
   - Add `archiveOldCampaigns()` to daily scheduler

3. **Test Campaign Flow**:
   - Create test campaign with start date 1 hour ago
   - Verify automatic transition to 'active'
   - Update leaderboard entries
   - Verify bonus calculations

4. **Monitor Logs**:
   - Check for campaign transition logs
   - Monitor for constraint violations (duplicate bounties)

## References

- Issue #12: [Bounty System] Implement seasonal campaigns and themed bounty collections
- Acceptance Criteria: All criteria met ✅
- Complexity: Medium ✅
