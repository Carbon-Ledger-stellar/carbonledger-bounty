export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type BountyStatus = 'open' | 'in_progress' | 'closed' | 'cancelled';
export type SortField = 'reward' | 'deadline' | 'difficulty' | 'applications';

export class CreateBountyDto {
  title: string;
  description: string;
  requirements: string[];
  acceptanceCriteria: string[];
  rewardUsd: number;
  difficulty: Difficulty;
  /** ISO 8601 deadline */
  deadline: string;
  bountyType: string;
  reviewerAddress: string;
  reviewerGithub?: string;
  tags?: string[];
  /** Internal bounties are hidden from public marketplace */
  isInternal?: boolean;
}

export class FeatureBountyDto {
  bountyId: string;
  /** true = feature, false = unfeature */
  featured: boolean;
}

export class BountyListQueryDto {
  sort?: SortField;
  order?: 'asc' | 'desc';
  difficulty?: Difficulty;
  minReward?: number;
  maxReward?: number;
  tag?: string;
  search?: string;
  page?: number;
  limit?: number;
}
