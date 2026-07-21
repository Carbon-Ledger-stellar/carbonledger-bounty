import { Injectable, Logger } from '@nestjs/common';
import { Bounty, BountiesService } from '../bounties/bounties.service';
import { Difficulty } from '../bounties/bounties.dto';
import { SearchTaxonomyQueryDto } from './bounty-taxonomy.dto';
import {
  BOUNTY_TAXONOMY,
  DOMAINS,
  Domain,
  Impact,
  TASK_TYPES,
  TaskType,
  deriveImpact,
} from './bounty-taxonomy';

export interface Categorization {
  domain: Domain;
  area: string | null;
  component: string | null;
  taskType: TaskType | null;
  /** 0-1: fraction of the 4 taxonomy levels confidently assigned via keyword match */
  confidence: number;
  matchedKeywords: string[];
}

export interface IndexedBounty {
  id: string;
  title: string;
  description: string;
  tags: string[];
  difficulty: Difficulty;
  rewardUsd: number;
  impact: Impact;
  domain: Domain;
  area: string | null;
  component: string | null;
  taskType: TaskType | null;
  createdAt: Date;
}

export interface SearchResult {
  data: IndexedBounty[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  tookMs: number;
}

export type FacetCounts = Record<string, Record<string, number>>;

// Minimum characters required before autocomplete returns suggestions
const MIN_AUTOCOMPLETE_PREFIX_LENGTH = 1;

@Injectable()
export class BountyTaxonomyService {
  private readonly logger = new Logger(BountyTaxonomyService.name);

  private readonly index = new Map<string, IndexedBounty>();
  private readonly invertedIndex = new Map<string, Set<string>>();
  private readonly tokensByBountyId = new Map<string, Set<string>>();
  private readonly termFrequency = new Map<string, number>();

  constructor(private readonly bountiesService: BountiesService) {
    this.seedFromExisting();
    this.bountiesService.bountyCreated$.subscribe(bounty => this.indexBounty(bounty));
  }

  // ── Auto-categorization (keyword-pattern based) ─────────────────────────────

  categorize(title: string, description: string, tags: string[] = []): Categorization {
    const text = `${title} ${description} ${tags.join(' ')}`.toLowerCase();

    let bestDomain: Domain = 'other';
    let bestDomainMatches: string[] = [];
    for (const domainKey of DOMAINS) {
      if (domainKey === 'other') continue;
      const node = BOUNTY_TAXONOMY[domainKey];
      const allKeywords = [
        ...node.keywords,
        ...Object.values(node.areas).flatMap(a => [
          ...a.keywords,
          ...Object.values(a.components).flatMap(c => c.keywords),
        ]),
      ];
      const matches = this.matchKeywords(text, allKeywords);
      if (matches.length > bestDomainMatches.length) {
        bestDomain = domainKey;
        bestDomainMatches = matches;
      }
    }

    let bestArea: string | null = null;
    let bestAreaMatches: string[] = [];
    if (bestDomain !== 'other') {
      for (const [areaKey, areaNode] of Object.entries(BOUNTY_TAXONOMY[bestDomain].areas)) {
        const allKeywords = [
          ...areaNode.keywords,
          ...Object.values(areaNode.components).flatMap(c => c.keywords),
        ];
        const matches = this.matchKeywords(text, allKeywords);
        if (matches.length > bestAreaMatches.length) {
          bestArea = areaKey;
          bestAreaMatches = matches;
        }
      }
    }

    let bestComponent: string | null = null;
    let bestComponentMatches: string[] = [];
    if (bestDomain !== 'other' && bestArea) {
      const components = BOUNTY_TAXONOMY[bestDomain].areas[bestArea].components;
      for (const [componentKey, componentNode] of Object.entries(components)) {
        const matches = this.matchKeywords(text, componentNode.keywords);
        if (matches.length > bestComponentMatches.length) {
          bestComponent = componentKey;
          bestComponentMatches = matches;
        }
      }
    }

    let bestTaskType: TaskType | null = null;
    let bestTaskTypeMatches: string[] = [];
    for (const [taskTypeKey, taskTypeNode] of Object.entries(TASK_TYPES) as [TaskType, { label: string; keywords: string[] }][]) {
      const matches = this.matchKeywords(text, taskTypeNode.keywords);
      if (matches.length > bestTaskTypeMatches.length) {
        bestTaskType = taskTypeKey;
        bestTaskTypeMatches = matches;
      }
    }

    const matchedKeywords = Array.from(
      new Set([...bestDomainMatches, ...bestAreaMatches, ...bestComponentMatches, ...bestTaskTypeMatches]),
    );

    const levelsAssigned = [bestDomain !== 'other', bestArea != null, bestComponent != null, bestTaskType != null].filter(
      Boolean,
    ).length;

    return {
      domain: bestDomain,
      area: bestArea,
      component: bestComponent,
      taskType: bestTaskType,
      confidence: levelsAssigned / 4,
      matchedKeywords,
    };
  }

  private matchKeywords(text: string, keywords: string[]): string[] {
    return keywords.filter(kw => kw.length > 0 && text.includes(kw));
  }

  // ── Search indexing ─────────────────────────────────────────────────────────

  /**
   * Categorize and (re-)index a bounty. Called in real time whenever a new
   * bounty is created (see BountiesService.bountyCreated$).
   */
  indexBounty(bounty: Bounty): IndexedBounty {
    const categorization = this.categorize(bounty.title, bounty.description, bounty.tags);

    const entry: IndexedBounty = {
      id: bounty.id,
      title: bounty.title,
      description: bounty.description,
      tags: bounty.tags,
      difficulty: bounty.difficulty,
      rewardUsd: bounty.rewardUsd,
      impact: deriveImpact(bounty.rewardUsd),
      domain: categorization.domain,
      area: categorization.area,
      component: categorization.component,
      taskType: categorization.taskType,
      createdAt: bounty.createdAt,
    };

    this.removeFromInvertedIndex(entry.id);
    this.index.set(entry.id, entry);

    const tokens = this.tokenize(
      [bounty.title, bounty.description, ...bounty.tags, BOUNTY_TAXONOMY[entry.domain].label].join(' '),
    );
    this.tokensByBountyId.set(entry.id, new Set(tokens));
    for (const token of tokens) {
      if (!this.invertedIndex.has(token)) this.invertedIndex.set(token, new Set());
      this.invertedIndex.get(token)!.add(entry.id);
    }

    for (const term of [...bounty.tags, BOUNTY_TAXONOMY[entry.domain].label]) {
      const key = term.toLowerCase();
      this.termFrequency.set(key, (this.termFrequency.get(key) ?? 0) + 1);
    }

    this.logger.log(`Indexed bounty ${entry.id} as ${entry.domain}/${entry.area ?? '-'}/${entry.component ?? '-'}`);
    return entry;
  }

  private removeFromInvertedIndex(bountyId: string): void {
    const tokens = this.tokensByBountyId.get(bountyId);
    if (!tokens) return;
    for (const token of tokens) {
      this.invertedIndex.get(token)?.delete(bountyId);
    }
    this.tokensByBountyId.delete(bountyId);
    this.index.delete(bountyId);
  }

  private tokenize(text: string): string[] {
    return Array.from(
      new Set(
        text
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(t => t.length > 1),
      ),
    );
  }

  private seedFromExisting(): void {
    const { data } = this.bountiesService.listPublic({ page: 1, limit: Number.MAX_SAFE_INTEGER });
    data.forEach(bounty => this.indexBounty(bounty));
  }

  // ── Faceted full-text search ────────────────────────────────────────────────

  search(query: SearchTaxonomyQueryDto): SearchResult {
    const start = Date.now();
    const { page = 1, limit = 20 } = query;

    const results = this.applyFilters(query);
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = results.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const data = results.slice(offset, offset + limit);

    return { data, total, page, totalPages, limit, tookMs: Date.now() - start };
  }

  /**
   * Facet counts for the current filter set — each facet's counts are
   * computed with every *other* active filter applied (but not itself), so
   * facets combine independently and combinatorially in the UI.
   */
  getFacetCounts(query: SearchTaxonomyQueryDto = {}): FacetCounts {
    const { q, domain, area, component, taskType, difficulty, impact, tag } = query;

    const countValues = (items: IndexedBounty[], field: keyof IndexedBounty): Record<string, number> => {
      const bucket: Record<string, number> = {};
      for (const item of items) {
        const value = item[field];
        if (value == null) continue;
        bucket[String(value)] = (bucket[String(value)] ?? 0) + 1;
      }
      return bucket;
    };

    return {
      domain: countValues(this.applyFilters({ q, area, component, taskType, difficulty, impact, tag }), 'domain'),
      area: countValues(this.applyFilters({ q, domain, component, taskType, difficulty, impact, tag }), 'area'),
      component: countValues(this.applyFilters({ q, domain, area, taskType, difficulty, impact, tag }), 'component'),
      taskType: countValues(this.applyFilters({ q, domain, area, component, difficulty, impact, tag }), 'taskType'),
      difficulty: countValues(this.applyFilters({ q, domain, area, component, taskType, impact, tag }), 'difficulty'),
      impact: countValues(this.applyFilters({ q, domain, area, component, taskType, difficulty, tag }), 'impact'),
    };
  }

  private applyFilters(query: SearchTaxonomyQueryDto): IndexedBounty[] {
    const { q, domain, area, component, taskType, difficulty, impact, tag } = query;

    let ids: Set<string> | null = null;
    if (q && q.trim().length > 0) {
      const tokens = this.tokenize(q);
      for (const token of tokens) {
        const matched = this.invertedIndex.get(token) ?? new Set<string>();
        ids = ids === null ? new Set(matched) : this.intersect(ids, matched);
        if (ids.size === 0) break;
      }
      ids = ids ?? new Set<string>();
    }

    let results = ids
      ? (Array.from(ids)
          .map(id => this.index.get(id))
          .filter(Boolean) as IndexedBounty[])
      : Array.from(this.index.values());

    if (domain) results = results.filter(b => b.domain === domain);
    if (area) results = results.filter(b => b.area === area);
    if (component) results = results.filter(b => b.component === component);
    if (taskType) results = results.filter(b => b.taskType === taskType);
    if (difficulty) results = results.filter(b => b.difficulty === difficulty);
    if (impact) results = results.filter(b => b.impact === impact);
    if (tag) results = results.filter(b => b.tags.some(t => t.toLowerCase() === tag.toLowerCase()));

    return results;
  }

  private intersect(a: Set<string>, b: Set<string>): Set<string> {
    const [small, large] = a.size <= b.size ? [a, b] : [b, a];
    const result = new Set<string>();
    for (const item of small) {
      if (large.has(item)) result.add(item);
    }
    return result;
  }

  // ── Autocomplete ─────────────────────────────────────────────────────────────

  /**
   * Tag/term suggestions for a given prefix, ranked by frequency across the
   * indexed bounty set. Backed by an in-memory map, so lookups stay well
   * under the 50ms budget regardless of catalog size.
   */
  autocomplete(prefix: string, limit = 10): string[] {
    const p = prefix.toLowerCase();
    if (p.length < MIN_AUTOCOMPLETE_PREFIX_LENGTH) return [];

    return Array.from(this.termFrequency.entries())
      .filter(([term]) => term.startsWith(p))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([term]) => term);
  }

  getTaxonomyTree() {
    return {
      domains: BOUNTY_TAXONOMY,
      taskTypes: TASK_TYPES,
    };
  }
}
