import useSWR from 'swr';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch matching data');
  return res.json();
};

// ── Types ────────────────────────────────────────────────────────────────────

export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'expert';

export interface ContributorProfile {
  contributorId: string;
  skills: string[];
  experienceLevel: ExperienceLevel;
  pastCompletions: number;
  successRate: number;
  preferredTypes: string[];
}

export interface BountyMatchResult {
  bountyId: string;
  title: string;
  rewardUsd: number;
  difficulty: string;
  tags: string[];
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  isLearningBounty: boolean;
  availability: boolean;
}

export interface LearningPath {
  targetSkill: string;
  relatedBounties: BountyMatchResult[];
  estimatedHours: number;
}

export interface RecommendationResponse {
  contributorId: string;
  recommendations: BountyMatchResult[];
  learningPaths: LearningPath[];
  computedInMs: number;
}

export interface SkillTaxonomyResponse {
  categories: Record<string, string[]>;
  allSkills: string[];
  skillToCategory: Record<string, string>;
  totalSkills: number;
}

// ── SWR Hooks ────────────────────────────────────────────────────────────────

export function useContributorProfile(contributorId: string) {
  return useSWR<ContributorProfile>(
    contributorId ? `${API_URL}/matching/contributors/${contributorId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}

export function useAllContributors() {
  return useSWR<ContributorProfile[]>(`${API_URL}/matching/contributors`, fetcher, {
    revalidateOnFocus: false,
  });
}

export function useRecommendations(contributorId: string, limit = 10) {
  return useSWR<RecommendationResponse>(
    contributorId ? `${API_URL}/matching/recommendations/${contributorId}?limit=${limit}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}

export function useTopMatches(contributorId: string, minScore = 70) {
  return useSWR<BountyMatchResult[]>(
    contributorId
      ? `${API_URL}/matching/recommendations/${contributorId}/top?minScore=${minScore}`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}

export function useLearningPaths(contributorId: string) {
  return useSWR<LearningPath[]>(
    contributorId ? `${API_URL}/matching/learning-paths/${contributorId}` : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}

export function useSkillTaxonomy() {
  return useSWR<SkillTaxonomyResponse>(`${API_URL}/matching/taxonomy`, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
  });
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
  dto: {
    contributorId: string;
    skills: string[];
    experienceLevel: ExperienceLevel;
    pastCompletions: number;
    successRate: number;
    preferredTypes?: string[];
  },
  token: string,
): Promise<ContributorProfile> {
  return authPost('/matching/contributors', dto, token);
}

export async function getBatchRecommendations(
  contributorIds: string[],
  token: string,
): Promise<Record<string, RecommendationResponse>> {
  return authPost('/matching/batch-recommendations', { contributorIds }, token);
}
