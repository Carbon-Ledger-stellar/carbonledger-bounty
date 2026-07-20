import useSWR from 'swr';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch portfolio data');
  return res.json();
};

// ── Types ────────────────────────────────────────────────────────────────────

export type PipelineStage =
  | 'applied'
  | 'claimed'
  | 'in-progress'
  | 'submitted'
  | 'under-review'
  | 'completed';

export const PIPELINE_STAGES: PipelineStage[] = [
  'applied',
  'claimed',
  'in-progress',
  'submitted',
  'under-review',
  'completed',
];

export interface ContributorDashboard {
  contributorId: string;
  activeBounties: number;
  completedBounties: number;
  totalEarnings: number;
  rating: number;
  pipelineByStage: Record<PipelineStage, number>;
}

export interface PipelineItem {
  id: string;
  contributorId: string;
  bountyId: string;
  bountyTitle: string;
  rewardUsd: number;
  tags: string[];
  stage: PipelineStage;
  addedAt: string;
  updatedAt: string;
}

/** Kanban response: each key is a stage, value is array of items */
export type PipelineResponse = Record<PipelineStage, PipelineItem[]>;

export interface Milestone {
  id: string;
  bountyId: string;
  bountyTitle: string;
  earningsUsd: number;
  completedAt: string;
  skills: string[];
}

export interface SkillGrowth {
  skill: string;
  acquiredAt: string;
}

export interface EarningsProjection {
  annualEstimate: number;
  monthlyAverage: number;
  basedOnMonths: number;
  disclaimer: string;
}

// ── SWR Hooks ────────────────────────────────────────────────────────────────

export function usePortfolioDashboard(contributorId: string) {
  return useSWR<ContributorDashboard>(
    contributorId ? `${API_URL}/portfolio/${contributorId}/dashboard` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}

export function usePortfolioPipeline(contributorId: string) {
  return useSWR<PipelineResponse>(
    contributorId ? `${API_URL}/portfolio/${contributorId}/pipeline` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}

export function usePortfolioMilestones(contributorId: string) {
  return useSWR<Milestone[]>(
    contributorId ? `${API_URL}/portfolio/${contributorId}/milestones` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}

export function useSkillGrowth(contributorId: string) {
  return useSWR<SkillGrowth[]>(
    contributorId ? `${API_URL}/portfolio/${contributorId}/skill-growth` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}

export function useEarningsProjection(contributorId: string) {
  return useSWR<EarningsProjection>(
    contributorId ? `${API_URL}/portfolio/${contributorId}/earnings-projection` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}

// ── Mutation helpers ─────────────────────────────────────────────────────────

async function authPost<T>(endpoint: string, body: unknown, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json();
}

export async function registerContributor(
  dto: { contributorId: string; skills: string[]; walletAddress?: string },
  token: string,
) {
  return authPost('/portfolio/register', dto, token);
}

export async function addToPipeline(
  contributorId: string,
  dto: { bountyId: string; stage: PipelineStage },
  token: string,
) {
  return authPost(`/portfolio/${contributorId}/pipeline/add`, dto, token);
}

export async function movePipeline(
  contributorId: string,
  dto: { bountyId: string; newStage: PipelineStage },
  token: string,
) {
  return authPost(`/portfolio/${contributorId}/pipeline/move`, dto, token);
}

export async function completeBounty(
  contributorId: string,
  dto: { bountyId: string; earningsUsd: number; skills: string[] },
  token: string,
) {
  return authPost(`/portfolio/${contributorId}/complete`, dto, token);
}
