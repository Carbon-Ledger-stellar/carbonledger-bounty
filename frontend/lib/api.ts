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
  /** Prerequisites that must be completed before this bounty can be claimed */
  prerequisites?: BountyDependency[];
  /** Bounties that depend on this one */
  dependents?: BountyDependency[];
  /** Whether this bounty is currently locked due to unmet prerequisites */
  isLocked?: boolean;
}

export interface BountyDependency {
  id: string;
  prerequisiteBountyId: string;
  dependentBountyId: string;
  isRequired: boolean;
  createdAt: string;
  prerequisiteBounty?: Bounty;
  dependentBounty?: Bounty;
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

// Dependency management hooks
export function useBountyDependencies(id: string) {
  return useSWR(`${API_URL}/bounties/${id}/dependencies`, fetcher);
}

export function useDependencyGraph(bountyId?: string) {
  const url = bountyId 
    ? `${API_URL}/bounties/dependencies/graph?bountyId=${bountyId}`
    : `${API_URL}/bounties/dependencies/graph`;
  return useSWR(url, fetcher);
}

export async function createDependency(prerequisiteBountyId: string, dependentBountyId: string, isRequired = true) {
  const response = await fetch(`${API_URL}/bounties/dependencies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prerequisiteBountyId, dependentBountyId, isRequired }),
  });
  
  if (!response.ok) throw new Error('Failed to create dependency');
  return response.json();
}

export async function removeDependency(prerequisiteBountyId: string, dependentBountyId: string) {
  const response = await fetch(`${API_URL}/bounties/dependencies`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prerequisiteBountyId, dependentBountyId }),
  });
  
  if (!response.ok) throw new Error('Failed to remove dependency');
  return response.json();
}
