import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { BountiesService, Bounty } from '../bounties/bounties.service';
import {
  ContributorProfile,
  BountyMatchResult,
  LearningPath,
  RecommendationResponse,
  ExperienceLevel,
} from './matching.dto';

/** Map bounty difficulty to the required contributor experience level */
const DIFFICULTY_TO_LEVEL: Record<string, ExperienceLevel> = {
  beginner: 'junior',
  intermediate: 'mid',
  advanced: 'senior',
  expert: 'expert',
};

/** Numeric rank for experience levels (used in delta calculations) */
const LEVEL_RANK: Record<ExperienceLevel, number> = {
  junior: 0,
  mid: 1,
  senior: 2,
  expert: 3,
};

/** Estimated hours to learn a new skill (used in learning path suggestions) */
const ESTIMATED_HOURS_PER_SKILL: Record<string, number> = {
  Soroban: 40,
  Rust: 60,
  WASM: 20,
  'Stellar SDK': 15,
  'smart contract testing': 10,
  'token minting': 10,
  'DeFi protocols': 30,
  'contract security': 25,
  React: 30,
  'Next.js': 20,
  TypeScript: 20,
  CSS: 15,
  'responsive design': 10,
  accessibility: 10,
  SWR: 5,
  'React Query': 5,
  jsPDF: 5,
  html2canvas: 5,
  NestJS: 25,
  'Node.js': 25,
  PostgreSQL: 20,
  Prisma: 10,
  'REST API': 15,
  'JWT auth': 8,
  WebSockets: 12,
  microservices: 30,
  Docker: 15,
  'GitHub Actions': 10,
  'CI/CD': 15,
  Kubernetes: 40,
  AWS: 40,
  Nginx: 10,
  monitoring: 15,
  Prometheus: 15,
  Jest: 10,
  Playwright: 12,
  'unit testing': 8,
  'integration testing': 10,
  'load testing': 12,
  'test coverage': 5,
  TDD: 15,
  'E2E testing': 15,
  OpenAPI: 8,
  Swagger: 8,
  'technical writing': 10,
  'API documentation': 8,
  Markdown: 3,
  Docusaurus: 5,
  JWT: 8,
  OAuth2: 15,
  'input validation': 5,
  'SQL injection prevention': 5,
  'rate limiting': 5,
  CORS: 3,
};

/** Cache entry shape */
interface CacheEntry {
  results: RecommendationResponse;
  timestamp: number;
}

/** TTL for the recommendation cache (60 seconds) */
const CACHE_TTL_MS = 60_000;

@Injectable()
export class SkillMatcherService implements OnModuleInit {
  private readonly logger = new Logger(SkillMatcherService.name);

  /** In-memory contributor store */
  private readonly contributors = new Map<string, ContributorProfile>();

  /** Recommendation result cache: cacheKey → {results, timestamp} */
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly bountiesService: BountiesService) {}

  onModuleInit(): void {
    this.seedDemoContributors();
  }

  // ── Core algorithm ──────────────────────────────────────────────────────────

  /**
   * Compute a 0-100 composite match score for a contributor vs a bounty.
   *
   * Weights:
   *   - Skill overlap  60%
   *   - Experience     25%
   *   - Success rate   15%
   */
  computeMatchScore(profile: ContributorProfile, bounty: Bounty): number {
    // 1. Skill overlap (60%)
    const bountySkills = bounty.tags.length > 0 ? bounty.tags : [];
    const skillScore = this.computeSkillOverlapScore(profile.skills, bountySkills);

    // 2. Experience level (25%)
    const expScore = this.computeExperienceScore(profile.experienceLevel, bounty.difficulty);

    // 3. Past success rate (15%)
    const successScore = profile.successRate * 15;

    const total = skillScore + expScore + successScore;
    return Math.min(100, Math.max(0, Math.round(total)));
  }

  // ── Public service methods ──────────────────────────────────────────────────

  registerContributor(profile: ContributorProfile): ContributorProfile {
    this.contributors.set(profile.contributorId, profile);
    // Invalidate any cached results for this contributor
    this.invalidateCache(profile.contributorId);
    this.logger.log(`Registered contributor: ${profile.contributorId}`);
    return profile;
  }

  getContributorProfile(contributorId: string): ContributorProfile {
    const profile = this.contributors.get(contributorId);
    if (!profile) {
      throw new NotFoundException(`Contributor "${contributorId}" not found`);
    }
    return profile;
  }

  getAllContributors(): ContributorProfile[] {
    return Array.from(this.contributors.values());
  }

  getRecommendations(contributorId: string, limit = 10): RecommendationResponse {
    const cacheKey = `rec:${contributorId}:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.results;
    }

    const start = Date.now();
    const profile = this.getContributorProfile(contributorId);
    const bounties = this.getAvailableBounties();

    const results: BountyMatchResult[] = bounties
      .map(bounty => this.buildMatchResult(profile, bounty))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    const learningPaths = this.computeLearningPaths(profile, bounties);

    const response: RecommendationResponse = {
      contributorId,
      recommendations: results,
      learningPaths,
      computedInMs: Date.now() - start,
    };

    this.cache.set(cacheKey, { results: response, timestamp: Date.now() });
    return response;
  }

  getSuggestedBounties(contributorId: string, minScore = 70): BountyMatchResult[] {
    const profile = this.getContributorProfile(contributorId);
    const bounties = this.getAvailableBounties();

    return bounties
      .map(bounty => this.buildMatchResult(profile, bounty))
      .filter(result => result.matchScore >= minScore)
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  getLearningPaths(contributorId: string): LearningPath[] {
    const profile = this.getContributorProfile(contributorId);
    const bounties = this.getAvailableBounties();
    return this.computeLearningPaths(profile, bounties);
  }

  getBatchRecommendations(contributorIds: string[]): Map<string, RecommendationResponse> {
    const resultMap = new Map<string, RecommendationResponse>();
    for (const id of contributorIds) {
      try {
        resultMap.set(id, this.getRecommendations(id));
      } catch (err) {
        // Skip contributors not found — caller can inspect the map
        this.logger.warn(`Skipping contributor ${id}: ${(err as Error).message}`);
      }
    }
    return resultMap;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private getAvailableBounties(): Bounty[] {
    const { data } = this.bountiesService.listPublic({
      page: 1,
      limit: 1000,
    });
    return data;
  }

  private buildMatchResult(profile: ContributorProfile, bounty: Bounty): BountyMatchResult {
    const score = this.computeMatchScore(profile, bounty);
    const profileSkillsLower = profile.skills.map(s => s.toLowerCase());
    const bountySkillsLower = bounty.tags.map(t => t.toLowerCase());

    const matchedSkills = bounty.tags.filter(t =>
      profileSkillsLower.includes(t.toLowerCase()),
    );
    const missingSkills = bounty.tags.filter(
      t => !profileSkillsLower.includes(t.toLowerCase()),
    );

    return {
      bountyId: bounty.id,
      title: bounty.title,
      rewardUsd: bounty.rewardUsd,
      difficulty: bounty.difficulty,
      tags: bounty.tags,
      matchScore: score,
      matchedSkills,
      missingSkills,
      isLearningBounty: score >= 30 && score <= 70,
      availability: bounty.status === 'open',
    };
  }

  private computeSkillOverlapScore(profileSkills: string[], bountyTags: string[]): number {
    if (bountyTags.length === 0) return 30; // Neutral when no tags specified
    const profileLower = new Set(profileSkills.map(s => s.toLowerCase()));
    const matched = bountyTags.filter(t => profileLower.has(t.toLowerCase())).length;
    return (matched / bountyTags.length) * 60;
  }

  private computeExperienceScore(
    contributorLevel: ExperienceLevel,
    bountyDifficulty: string,
  ): number {
    const requiredLevel = DIFFICULTY_TO_LEVEL[bountyDifficulty] ?? 'junior';
    const contributorRank = LEVEL_RANK[contributorLevel];
    const requiredRank = LEVEL_RANK[requiredLevel];
    const delta = contributorRank - requiredRank;

    if (delta === 0) return 25; // Exact match
    if (delta === 1) return 20; // One level above
    if (delta >= 2) return 15; // Two or more levels above
    return 5; // Below required (contributor is less experienced than needed)
  }

  private computeLearningPaths(profile: ContributorProfile, bounties: Bounty[]): LearningPath[] {
    // Find all skills the contributor is missing across all bounties
    const profileLower = new Set(profile.skills.map(s => s.toLowerCase()));
    const missingSkillMap = new Map<string, BountyMatchResult[]>();

    for (const bounty of bounties) {
      const result = this.buildMatchResult(profile, bounty);
      if (!result.isLearningBounty) continue; // Only 30-70% range bounties

      for (const missingSkill of result.missingSkills) {
        if (!missingSkillMap.has(missingSkill)) {
          missingSkillMap.set(missingSkill, []);
        }
        missingSkillMap.get(missingSkill)!.push(result);
      }
    }

    const paths: LearningPath[] = [];
    for (const [skill, relatedBounties] of missingSkillMap.entries()) {
      paths.push({
        targetSkill: skill,
        relatedBounties: relatedBounties.sort((a, b) => b.matchScore - a.matchScore),
        estimatedHours: ESTIMATED_HOURS_PER_SKILL[skill] ?? 10,
      });
    }

    // Sort by number of related learning opportunities (most bounties first)
    return paths.sort((a, b) => b.relatedBounties.length - a.relatedBounties.length);
  }

  private invalidateCache(contributorId: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(`:${contributorId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  private seedDemoContributors(): void {
    const demos: ContributorProfile[] = [
      {
        contributorId: 'alice-dev',
        skills: ['Soroban', 'Rust', 'smart contract testing', 'WASM'],
        experienceLevel: 'senior',
        pastCompletions: 8,
        successRate: 0.92,
        preferredTypes: ['smart-contracts'],
      },
      {
        contributorId: 'bob-frontend',
        skills: ['React', 'Next.js', 'TypeScript', 'CSS', 'SWR'],
        experienceLevel: 'mid',
        pastCompletions: 12,
        successRate: 0.85,
        preferredTypes: ['frontend'],
      },
      {
        contributorId: 'carol-fullstack',
        skills: ['NestJS', 'Node.js', 'PostgreSQL', 'React', 'TypeScript', 'Jest'],
        experienceLevel: 'mid',
        pastCompletions: 5,
        successRate: 0.80,
        preferredTypes: ['backend', 'frontend'],
      },
      {
        contributorId: 'dave-devops',
        skills: ['Docker', 'GitHub Actions', 'CI/CD', 'AWS', 'monitoring'],
        experienceLevel: 'senior',
        pastCompletions: 15,
        successRate: 0.95,
        preferredTypes: ['devops'],
      },
    ];

    demos.forEach(profile => this.contributors.set(profile.contributorId, profile));
    this.logger.log(`Seeded ${demos.length} demo contributors`);
  }
}
