import useSWR, { SWRConfiguration } from 'swr';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch data');
  }
  return res.json();
};

// ── Projects ────────────────────────────────────────────────────────────────

export interface CarbonProject {
  id: string;
  projectId: string;
  name: string;
  methodology: string;
  country: string;
  projectType: string;
  status: string;
  vintageYear: number;
  totalCreditsIssued: number;
  totalCreditsRetired: number;
  metadataCid: string;
  createdAt: string;
}

export function useProjects(filters?: { methodology?: string; country?: string; status?: string }) {
  const query = new URLSearchParams(filters || {}).toString();
  return useSWR<CarbonProject[]>(`${API_URL}/projects?${query}`, fetcher);
}

export function useProject(projectId: string) {
  return useSWR<CarbonProject>(`${API_URL}/projects/${projectId}`, fetcher);
}

// ── Marketplace ─────────────────────────────────────────────────────────────

export interface MarketListing {
  id: string;
  listingId: string;
  projectId: string;
  batchId: string;
  seller: string;
  amountAvailable: number;
  pricePerCredit: string;
  vintageYear: number;
  methodology: string;
  country: string;
  status: string;
  createdAt: string;
}

export function useListings(filters?: {
  methodology?: string;
  vintage?: number;
  country?: string;
  minPrice?: string;
  maxPrice?: string;
}) {
  const query = new URLSearchParams(filters || {}).toString();
  return useSWR<MarketListing[]>(`${API_URL}/marketplace/listings?${query}`, fetcher);
}

export function useListing(listingId: string) {
  return useSWR<MarketListing>(`${API_URL}/marketplace/listings/${listingId}`, fetcher);
}

export async function purchaseCredits(
  listingId: string,
  amount: number,
  buyerKey: string,
): Promise<{ txHash: string; batchId: string }> {
  const res = await fetch(`${API_URL}/marketplace/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ listingId, amount, buyerKey }),
  });

  if (!res.ok) throw new Error('Purchase failed');
  return res.json();
}

// ── Credits ─────────────────────────────────────────────────────────────────

export interface CreditBatch {
  id: string;
  batchId: string;
  projectId: string;
  vintageYear: number;
  amount: number;
  serialStart: string;
  serialEnd: string;
  status: string;
  metadataCid: string;
  issuedAt: string;
}

export function useBatch(batchId: string) {
  return useSWR<CreditBatch>(`${API_URL}/credits/batch/${batchId}`, fetcher);
}

export async function retireCredits(dto: {
  batchId: string;
  projectId: string;
  amount: number;
  beneficiary: string;
  retirementReason: string;
  holderPublicKey: string;
}): Promise<{ txHash: string; retirementId: string }> {
  const res = await fetch(`${API_URL}/credits/retire`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });

  if (!res.ok) throw new Error('Retirement failed');
  return res.json();
}

// ── Retirements ─────────────────────────────────────────────────────────────

export interface RetirementRecord {
  id: string;
  retirementId: string;
  batchId: string;
  projectId: string;
  amount: number;
  retiredBy: string;
  beneficiary: string;
  retirementReason: string;
  vintageYear: number;
  serialNumbers: string[];
  txHash: string;
  retiredAt: string;
}

export function useRetirements() {
  return useSWR<RetirementRecord[]>(`${API_URL}/retirements`, fetcher);
}

export function useRetirement(retirementId: string) {
  return useSWR<RetirementRecord>(`${API_URL}/retirements/${retirementId}`, fetcher);
}

// ── Stats ───────────────────────────────────────────────────────────────────

export interface PlatformStats {
  totalProjects: number;
  verifiedProjects: number;
  totalCreditsIssued: number;
  totalCreditsRetired: number;
  activeListings: number;
  totalRetirements: number;
  retirementRate: number;
}

export function usePlatformStats() {
  return useSWR<PlatformStats>(`${API_URL}/stats/platform`, fetcher);
}

// ── Oracle ──────────────────────────────────────────────────────────────────

export interface OracleStatus {
  projectId: string;
  status: string;
  lastUpdated: string | null;
  freshness: 'current' | 'stale' | 'unknown';
}

export function useOracleStatus(projectId: string) {
  return useSWR<OracleStatus>(`${API_URL}/oracle/status/${projectId}`, fetcher);
}

// ── Bounty Marketplace ──────────────────────────────────────────────────────

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type BountyStatus = 'open' | 'in_progress' | 'closed' | 'cancelled';

export interface Bounty {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  acceptanceCriteria: string[];
  rewardUsd: number;
  difficulty: Difficulty;
  deadline: string;
  bountyType: string;
  status: BountyStatus;
  reviewerAddress: string;
  reviewerGithub?: string;
  tags: string[];
  isInternal: boolean;
  featured: boolean;
  applicationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BountyListResponse {
  data: Bounty[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export function useBounties(params?: {
  sort?: string;
  order?: 'asc' | 'desc';
  difficulty?: Difficulty;
  minReward?: number;
  maxReward?: number;
  tag?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams(
    Object.entries(params || {})
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return useSWR<BountyListResponse>(`${API_URL}/bounties?${query}`, fetcher);
}

export function useTrendingBounties(limit = 10) {
  return useSWR<Bounty[]>(`${API_URL}/bounties/trending?limit=${limit}`, fetcher);
}

export function useRecentBounties(limit = 10) {
  return useSWR<Bounty[]>(`${API_URL}/bounties/recent?limit=${limit}`, fetcher);
}

export function useFeaturedBounties() {
  return useSWR<Bounty[]>(`${API_URL}/bounties/featured`, fetcher);
}

export function useBounty(id: string) {
  return useSWR<Bounty>(id ? `${API_URL}/bounties/${id}` : null, fetcher);
}

// ── Analytics (maintainer only) ──────────────────────────────────────────────

const authFetcher = (token: string) => async (url: string) => {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Analytics fetch failed: ${res.status}`);
  return res.json();
};

export interface CoreMetrics {
  bountiesOpen: number;
  applicationsPending: number;
  avgVelocityHours: number | null;
  completionRate: number;
  avgTimeToCompleteHours: number | null;
  costPerTask: number | null;
  totalCompletions: number;
  totalPayoutsUsd: number;
  uniqueContributors: number;
  computedAt: string;
}

export interface TrendPoint {
  date: string;
  bountiesOpen: number;
  completions: number;
  applicationsPending: number;
  avgVelocityHours: number | null;
}

export interface TrendAnalysis {
  window: '7d' | '30d' | '90d';
  points: TrendPoint[];
  completionVelocityTrend: 'accelerating' | 'decelerating' | 'stable';
  completionGrowthPct: number;
  previousWindowAvgCompletions: number;
  currentWindowAvgCompletions: number;
  comparison: {
    '7d': { completions: number; avgVelocity: number | null };
    '30d': { completions: number; avgVelocity: number | null };
    '90d': { completions: number; avgVelocity: number | null };
  };
}

export interface CohortRow {
  cohortMonth: string;
  contributorsInCohort: number;
  returnedFor2nd: number;
  returnedFor2ndPct: number;
  returnedFor3rd: number;
  returnedFor3rdPct: number;
}

export interface RetentionData {
  cohorts: CohortRow[];
  overallRetentionFor2nd: number;
  overallRetentionFor3rd: number;
}

export interface DistributionBucket {
  rank: number;
  contributorId: string;
  totalEarnedUsd: number;
  completions: number;
  pctOfTotalPayout: number;
}

export interface PaymentDistribution {
  topPercentile: number;
  topPercentileEarningsPct: number;
  totalPayoutsUsd: number;
  totalContributors: number;
  buckets: DistributionBucket[];
  giniCoefficient: number;
}

export interface AnalyticsSnapshot {
  snapshotAt: string;
  bountiesOpen: number;
  bountiesCompleted: number;
  applicationsPending: number;
  avgTimeToCompleteHours: number | null;
  completionRate: number | null;
  costPerTask: number | null;
  totalPayoutsUsd: number;
  uniqueContributorsEver: number;
}

export function useAnalyticsMetrics(token: string | null) {
  return useSWR<CoreMetrics>(
    token ? `${API_URL}/analytics/metrics` : null,
    authFetcher(token ?? ''),
    { refreshInterval: 60_000 },
  );
}

export function useAnalyticsTrends(token: string | null, window: '7d' | '30d' | '90d' = '30d') {
  return useSWR<TrendAnalysis>(
    token ? `${API_URL}/analytics/trends?window=${window}` : null,
    authFetcher(token ?? ''),
  );
}

export function useAnalyticsRetention(token: string | null) {
  return useSWR<RetentionData>(
    token ? `${API_URL}/analytics/retention` : null,
    authFetcher(token ?? ''),
  );
}

export function useAnalyticsDistribution(token: string | null) {
  return useSWR<PaymentDistribution>(
    token ? `${API_URL}/analytics/distribution` : null,
    authFetcher(token ?? ''),
  );
}

export function useAnalyticsSnapshots(token: string | null, limit = 48) {
  return useSWR<AnalyticsSnapshot[]>(
    token ? `${API_URL}/analytics/snapshots?limit=${limit}` : null,
    authFetcher(token ?? ''),
  );
}

export function analyticsReportUrl(
  type: 'pdf' | 'csv',
  period: 'weekly' | 'monthly' | 'quarterly',
  token: string,
): string {
  return `${API_URL}/analytics/report/${type}?period=${period}&token=${encodeURIComponent(token)}`;
}
