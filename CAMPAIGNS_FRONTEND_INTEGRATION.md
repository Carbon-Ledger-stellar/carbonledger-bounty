# Campaign System - Frontend Integration Guide

## Quick Start

### Get All Active Campaigns
```javascript
// GET /api/v1/campaigns?status=active
const campaigns = await fetch('/api/v1/campaigns?status=active').then(r => r.json());
```

### Get Campaign Details with Statistics
```javascript
const campaignId = 'campaign-123';
const [campaign, stats, leaderboard] = await Promise.all([
  fetch(`/api/v1/campaigns/${campaignId}`).then(r => r.json()),
  fetch(`/api/v1/campaigns/${campaignId}/stats`).then(r => r.json()),
  fetch(`/api/v1/campaigns/${campaignId}/leaderboard?limit=10`).then(r => r.json()),
]);
```

## Campaign Display Components

### Campaign Card
```typescript
interface CampaignCardProps {
  campaign: {
    campaignId: string;
    name: string;
    description: string;
    status: 'pending' | 'active' | 'completed' | 'archived';
    goal: number;
    bountyCount: number;
    daysRemaining: number;
    featuredBounties: string[];
  };
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const progressPercentage = (campaign.bountyCount / campaign.goal) * 100;
  
  return (
    <div className="campaign-card">
      <h3>{campaign.name}</h3>
      <p>{campaign.description}</p>
      <div className="progress-bar">
        <div style={{ width: `${progressPercentage}%` }} />
      </div>
      <p>{campaign.bountyCount}/{campaign.goal} bounties</p>
      <p>{campaign.daysRemaining} days remaining</p>
      <div className="featured-bounties">
        {campaign.featuredBounties.map(id => (
          <BountyBadge key={id} bountyId={id} />
        ))}
      </div>
    </div>
  );
}
```

### Campaign Leaderboard
```typescript
interface LeaderboardEntry {
  contributorId: string;
  earnings: number;
  completions: number;
  bonus: number;
  rank: number;
}

export function CampaignLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Contributor</th>
          <th>Earnings</th>
          <th>Completed</th>
          <th>Bonus</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, idx) => (
          <tr key={entry.contributorId}>
            <td>{entry.rank || idx + 4}</td>
            <td>{entry.contributorId}</td>
            <td>${entry.earnings}</td>
            <td>{entry.completions}</td>
            <td>
              {entry.bonus > 0 && (
                <span className={`bonus bonus-${entry.bonus}`}>
                  +{entry.bonus}%
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Campaign Progress Widget
```typescript
interface CampaignProgressProps {
  stats: {
    bountyCount: number;
    goal: number;
    contributorCount: number;
    totalEarnings: number;
    totalCompletions: number;
    daysRemaining: number;
  };
}

export function CampaignProgress({ stats }: CampaignProgressProps) {
  const progress = (stats.bountyCount / stats.goal) * 100;
  const isNearGoal = progress >= 80;
  
  return (
    <div className="campaign-progress">
      <div className="stats-grid">
        <StatBox label="Bounties" value={stats.bountyCount} goal={stats.goal} />
        <StatBox label="Contributors" value={stats.contributorCount} />
        <StatBox label="Total Earnings" value={`$${stats.totalEarnings}`} />
        <StatBox label="Completions" value={stats.totalCompletions} />
        <StatBox label="Days Left" value={stats.daysRemaining} />
      </div>
      
      {isNearGoal && (
        <div className="alert alert-success">
          Campaign is {progress.toFixed(0)}% complete! 🎉
        </div>
      )}
    </div>
  );
}
```

## Campaign Listing Page

```typescript
export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/campaigns?status=${status}`)
      .then(r => r.json())
      .then(data => {
        setCampaigns(data);
        setLoading(false);
      });
  }, [status]);

  return (
    <div className="campaigns-page">
      <h1>Campaigns</h1>
      
      <div className="filters">
        <button 
          className={status === 'active' ? 'active' : ''}
          onClick={() => setStatus('active')}
        >
          Active
        </button>
        <button 
          className={status === 'pending' ? 'active' : ''}
          onClick={() => setStatus('pending')}
        >
          Upcoming
        </button>
        <button 
          className={status === 'completed' ? 'active' : ''}
          onClick={() => setStatus('completed')}
        >
          Completed
        </button>
      </div>

      <div className="campaigns-grid">
        {campaigns.map(campaign => (
          <Link key={campaign.campaignId} href={`/campaigns/${campaign.campaignId}`}>
            <CampaignCard campaign={campaign} />
          </Link>
        ))}
      </div>
    </div>
  );
}
```

## Campaign Detail Page

```typescript
export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const [campaign, setCampaign] = useState(null);
  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/v1/campaigns/${params.id}`).then(r => r.json()),
      fetch(`/api/v1/campaigns/${params.id}/stats`).then(r => r.json()),
      fetch(`/api/v1/campaigns/${params.id}/leaderboard?limit=10`).then(r => r.json()),
    ]).then(([camp, stat, lead]) => {
      setCampaign(camp);
      setStats(stat);
      setLeaderboard(lead);
      setLoading(false);
    });
  }, [params.id]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="campaign-detail">
      <h1>{campaign.name}</h1>
      <p>{campaign.description}</p>

      <CampaignProgress stats={stats} />

      <div className="campaign-sections">
        <section className="featured-bounties">
          <h2>Featured Bounties</h2>
          <div className="bounties-grid">
            {campaign.featuredBounties.map(bountyId => (
              <BountyCard key={bountyId} bountyId={bountyId} featured />
            ))}
          </div>
        </section>

        <section className="leaderboard">
          <h2>Top Contributors</h2>
          <CampaignLeaderboard entries={leaderboard} />
        </section>

        <section className="all-bounties">
          <h2>All Campaign Bounties</h2>
          <BountiesListForCampaign campaignId={campaign.campaignId} />
        </section>
      </div>
    </div>
  );
}
```

## Status Badge Component

```typescript
type CampaignStatus = 'pending' | 'active' | 'completed' | 'archived';

const statusConfig: Record<CampaignStatus, { label: string; color: string }> = {
  pending: { label: 'Upcoming', color: 'bg-blue-100 text-blue-800' },
  active: { label: 'Active', color: 'bg-green-100 text-green-800' },
  completed: { label: 'Completed', color: 'bg-yellow-100 text-yellow-800' },
  archived: { label: 'Archived', color: 'bg-gray-100 text-gray-800' },
};

export function StatusBadge({ status }: { status: CampaignStatus }) {
  const config = statusConfig[status];
  return <span className={`badge ${config.color}`}>{config.label}</span>;
}
```

## Bonus Badge Component

```typescript
export function BonusIndicator({ bonus }: { bonus: number }) {
  if (bonus === 0) return null;
  
  const icon = 
    bonus === 15 ? '🥇' :
    bonus === 10 ? '🥈' :
    bonus === 5 ? '🥉' :
    '⭐';

  return (
    <span className={`bonus-badge bonus-${bonus}`}>
      {icon} +{bonus}%
    </span>
  );
}
```

## Styling Guide

### CSS Classes
```css
/* Campaign Cards */
.campaign-card { /* ... */ }
.campaign-card h3 { /* ... */ }
.progress-bar { /* ... */ }
.featured-bounties { /* ... */ }

/* Leaderboard */
.leaderboard table { /* ... */ }
.leaderboard tbody tr { /* ... */ }
.leaderboard tbody tr:nth-child(1) { /* highlight */ }

/* Status Badges */
.badge { /* ... */ }
.badge.bg-green-100 { background: #dcfce7; }
.badge.bg-blue-100 { background: #dbeafe; }

/* Bonus Badges */
.bonus-badge { /* ... */ }
.bonus-15 { color: #fbbf24; font-weight: bold; }
.bonus-10 { color: #a78bfa; }
.bonus-5 { color: #93c5fd; }

/* Progress */
.progress-bar { 
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar > div {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #059669);
  transition: width 0.3s ease;
}
```

## SWR Hook for Campaigns

```typescript
import useSWR from 'swr';

export function useCampaign(campaignId: string) {
  const { data, error, isLoading } = useSWR(
    `/api/v1/campaigns/${campaignId}`,
    fetch
  );
  
  return { campaign: data, isLoading, error };
}

export function useCampaignLeaderboard(campaignId: string, limit = 10) {
  const { data, error, isLoading } = useSWR(
    `/api/v1/campaigns/${campaignId}/leaderboard?limit=${limit}`,
    fetch
  );
  
  return { leaderboard: data, isLoading, error };
}

export function useCampaignStats(campaignId: string) {
  const { data, error, isLoading } = useSWR(
    `/api/v1/campaigns/${campaignId}/stats`,
    fetch
  );
  
  return { stats: data, isLoading, error };
}

export function useCampaigns(status?: string) {
  const url = status 
    ? `/api/v1/campaigns?status=${status}`
    : '/api/v1/campaigns';
  
  const { data, error, isLoading } = useSWR(url, fetch);
  
  return { campaigns: data, isLoading, error };
}
```

## URL Routing

```
/campaigns                           # List all campaigns
/campaigns/active                    # Active campaigns filter
/campaigns/:campaignId               # Campaign detail page
/campaigns/:campaignId/leaderboard   # Leaderboard view
/campaigns/:campaignId/bounties      # Campaign bounties list
```

## Common Integration Patterns

### Display Campaign on Bounty Page
```typescript
// When showing a bounty, display which campaign it belongs to
interface BountyWithCampaignProps {
  bounty: Bounty;
  campaignId?: string;
}

export function BountyWithCampaign({ bounty, campaignId }: BountyWithCampaignProps) {
  if (campaignId) {
    return (
      <>
        <BountyCard bounty={bounty} />
        <p className="campaign-badge">
          Part of <Link href={`/campaigns/${campaignId}`}>Campaign</Link>
        </p>
      </>
    );
  }
  return <BountyCard bounty={bounty} />;
}
```

### Show Bonus on Contributor Profile
```typescript
// In contributor dashboard/profile
interface ContributorCampaignStats {
  campaignId: string;
  earnings: number;
  bonus: number;
  rank: number;
}

export function CampaignEarnings({ stats }: { stats: ContributorCampaignStats[] }) {
  const totalBonusEarnings = stats.reduce(
    (sum, s) => sum + (s.earnings * s.bonus / 100),
    0
  );

  return (
    <div className="campaign-earnings">
      <h3>Campaign Earnings</h3>
      {stats.map(s => (
        <div key={s.campaignId} className="earning-row">
          <span>${s.earnings}</span>
          {s.bonus > 0 && <span className={`bonus-badge bonus-${s.bonus}`}>+{s.bonus}%</span>}
        </div>
      ))}
      <div className="total">
        Total from bonuses: <strong>${totalBonusEarnings.toFixed(2)}</strong>
      </div>
    </div>
  );
}
```

## Testing Integration

```typescript
describe('Campaign Integration', () => {
  it('should display campaign details', async () => {
    render(<CampaignDetailPage params={{ id: 'campaign-123' }} />);
    
    await waitFor(() => {
      expect(screen.getByText('Q4 DevOps Push')).toBeInTheDocument();
    });
  });

  it('should show leaderboard with bonuses', async () => {
    render(<CampaignLeaderboard entries={mockLeaderboard} />);
    
    expect(screen.getByText('🥇 +15%')).toBeInTheDocument();
    expect(screen.getByText('🥈 +10%')).toBeInTheDocument();
    expect(screen.getByText('🥉 +5%')).toBeInTheDocument();
  });
});
```
