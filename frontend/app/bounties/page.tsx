'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  useBounties,
  useFeaturedBounties,
  useTrendingBounties,
  useRecentBounties,
  Bounty,
  Difficulty,
} from '../../lib/api';
import { colors, spacing, shadows, borderRadius } from '../../styles/design-system';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DIFFICULTY_COLORS: Record<Difficulty, { bg: string; text: string }> = {
  beginner:     { bg: '#dcfce7', text: '#166534' },
  intermediate: { bg: '#fef9c3', text: '#854d0e' },
  advanced:     { bg: '#ffedd5', text: '#9a3412' },
  expert:       { bg: '#fee2e2', text: '#991b1b' },
};

function daysUntil(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function formatReward(usd: number): string {
  return usd >= 1000 ? `$${(usd / 1000).toFixed(1)}k` : `$${usd}`;
}

// ── Bounty Card ───────────────────────────────────────────────────────────────

function BountyCard({ bounty, featured = false }: { bounty: Bounty; featured?: boolean }) {
  const diffColor = DIFFICULTY_COLORS[bounty.difficulty];
  const days = daysUntil(bounty.deadline);
  const deadlineColor = days <= 3 ? colors.semantic.error : days <= 7 ? colors.semantic.warning : colors.neutral[500];

  return (
    <Link
      href={`/bounties/${bounty.id}`}
      style={{ textDecoration: 'none', display: 'block' }}
      aria-label={`View bounty: ${bounty.title}`}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: borderRadius.lg,
          padding: spacing.lg,
          border: featured
            ? `2px solid ${colors.primary[500]}`
            : `1px solid ${colors.neutral[200]}`,
          boxShadow: featured ? shadows.md : shadows.sm,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.xs,
          transition: 'box-shadow 150ms ease-in-out',
          cursor: 'pointer',
          height: '100%',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = shadows.lg;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = featured ? shadows.md : shadows.sm;
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.xs }}>
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: colors.neutral[500],
            }}
          >
            {bounty.bountyType}
          </span>
          {featured && (
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                backgroundColor: colors.primary[100],
                color: colors.primary[700],
                padding: '2px 8px',
                borderRadius: '999px',
              }}
            >
              ⭐ Featured
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: colors.neutral[900],
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {bounty.title}
        </h3>

        {/* Description excerpt */}
        <p
          style={{
            fontSize: '0.875rem',
            color: colors.neutral[500],
            margin: 0,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {bounty.description}
        </p>

        {/* Tags */}
        {bounty.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {bounty.tags.slice(0, 4).map(tag => (
              <span
                key={tag}
                style={{
                  fontSize: '0.7rem',
                  backgroundColor: colors.neutral[100],
                  color: colors.neutral[700],
                  padding: '2px 8px',
                  borderRadius: '999px',
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'auto',
            paddingTop: spacing.xs,
            borderTop: `1px solid ${colors.neutral[100]}`,
          }}
        >
          <span
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: colors.primary[600],
            }}
          >
            {formatReward(bounty.rewardUsd)}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                backgroundColor: diffColor.bg,
                color: diffColor.text,
                padding: '3px 10px',
                borderRadius: '999px',
              }}
            >
              {bounty.difficulty}
            </span>
            <span style={{ fontSize: '0.75rem', color: deadlineColor, fontWeight: 600 }}>
              {days > 0 ? `${days}d left` : 'Expired'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Section skeleton ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      style={{
        backgroundColor: colors.neutral[100],
        borderRadius: borderRadius.lg,
        height: '200px',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
      aria-hidden="true"
    />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type SortOption = 'reward-desc' | 'reward-asc' | 'deadline' | 'difficulty' | 'applications';

const SORT_MAP: Record<SortOption, { sort: string; order: 'asc' | 'desc' }> = {
  'reward-desc':  { sort: 'reward',       order: 'desc' },
  'reward-asc':   { sort: 'reward',       order: 'asc'  },
  'deadline':     { sort: 'deadline',     order: 'asc'  },
  'difficulty':   { sort: 'difficulty',   order: 'asc'  },
  'applications': { sort: 'applications', order: 'desc' },
};

export default function BountiesPage() {
  const [search, setSearch]       = useState('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('reward-desc');
  const [minReward, setMinReward] = useState('');
  const [maxReward, setMaxReward] = useState('');
  const [page, setPage] = useState(1);

  const { sort, order } = SORT_MAP[sortOption];

  const { data: listResp, isLoading: listLoading } = useBounties({
    search: search || undefined,
    difficulty: (difficulty as Difficulty) || undefined,
    sort,
    order,
    minReward: minReward ? Number(minReward) : undefined,
    maxReward: maxReward ? Number(maxReward) : undefined,
    page,
    limit: 12,
  });

  const { data: featured, isLoading: featuredLoading } = useFeaturedBounties();
  const { data: trending } = useTrendingBounties(6);
  const { data: recent }   = useRecentBounties(6);

  const hasFilters = search || difficulty || minReward || maxReward;

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: `${spacing.xl} ${spacing.lg}` }}>

      {/* Hero */}
      <header style={{ marginBottom: spacing.xl }}>
        <h1
          style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 800,
            color: colors.neutral[900],
            margin: 0,
          }}
        >
          Bounty Marketplace
        </h1>
        <p style={{ color: colors.neutral[500], marginTop: spacing.xs, fontSize: '1.05rem' }}>
          Browse open bounties — no account needed. Apply when you&apos;re ready to build.
        </p>
      </header>

      {/* Featured section (hide when searching) */}
      {!hasFilters && featured && featured.length > 0 && (
        <section aria-labelledby="featured-heading" style={{ marginBottom: spacing.xl }}>
          <h2
            id="featured-heading"
            style={{ fontSize: '1.125rem', fontWeight: 700, color: colors.neutral[900], marginBottom: spacing.md }}
          >
            ⭐ Featured Bounties
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: spacing.md,
            }}
          >
            {featuredLoading
              ? [1, 2].map(k => <SkeletonCard key={k} />)
              : featured.map(b => <BountyCard key={b.id} bounty={b} featured />)
            }
          </div>
        </section>
      )}

      {/* Trending + Recent (hide when searching) */}
      {!hasFilters && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: spacing.xl,
            marginBottom: spacing.xl,
          }}
        >
          {/* Trending */}
          {trending && trending.length > 0 && (
            <section aria-labelledby="trending-heading">
              <h2
                id="trending-heading"
                style={{ fontSize: '1.125rem', fontWeight: 700, color: colors.neutral[900], marginBottom: spacing.md }}
              >
                🔥 Trending (last 7 days)
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                {trending.slice(0, 5).map((b, i) => (
                  <Link
                    key={b.id}
                    href={`/bounties/${b.id}`}
                    style={{
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: spacing.sm,
                      borderRadius: borderRadius.md,
                      border: `1px solid ${colors.neutral[200]}`,
                      backgroundColor: 'white',
                    }}
                    aria-label={`Trending bounty: ${b.title}`}
                  >
                    <span
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: colors.primary[100],
                        color: colors.primary[700],
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          color: colors.neutral[900],
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {b.title}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: colors.neutral[500] }}>
                        {b.applicationCount} application{b.applicationCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span style={{ fontWeight: 700, color: colors.primary[600], fontSize: '0.875rem', flexShrink: 0 }}>
                      {formatReward(b.rewardUsd)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Recent */}
          {recent && recent.length > 0 && (
            <section aria-labelledby="recent-heading">
              <h2
                id="recent-heading"
                style={{ fontSize: '1.125rem', fontWeight: 700, color: colors.neutral[900], marginBottom: spacing.md }}
              >
                🆕 Recently Added
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
                {recent.slice(0, 5).map(b => (
                  <Link
                    key={b.id}
                    href={`/bounties/${b.id}`}
                    style={{
                      textDecoration: 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: spacing.sm,
                      borderRadius: borderRadius.md,
                      border: `1px solid ${colors.neutral[200]}`,
                      backgroundColor: 'white',
                    }}
                    aria-label={`New bounty: ${b.title}`}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          color: colors.neutral[900],
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {b.title}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: colors.neutral[500] }}>
                        {new Date(b.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span style={{ fontWeight: 700, color: colors.primary[600], fontSize: '0.875rem', flexShrink: 0 }}>
                      {formatReward(b.rewardUsd)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Divider */}
      <hr style={{ border: 'none', borderTop: `1px solid ${colors.neutral[200]}`, margin: `${spacing.lg} 0` }} />

      {/* All bounties with filters */}
      <section aria-labelledby="all-bounties-heading">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: spacing.sm,
            marginBottom: spacing.md,
          }}
        >
          <h2
            id="all-bounties-heading"
            style={{ fontSize: '1.125rem', fontWeight: 700, color: colors.neutral[900], margin: 0 }}
          >
            All Open Bounties
          </h2>
          {listResp && (
            <span style={{ fontSize: '0.875rem', color: colors.neutral[500] }}>
              {listResp.total.toLocaleString()} bounties
            </span>
          )}
        </div>

        {/* Filter bar */}
        <div
          role="search"
          aria-label="Filter bounties"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: spacing.sm,
            marginBottom: spacing.lg,
          }}
        >
          <input
            type="search"
            placeholder="Search bounties…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            aria-label="Search bounties"
            style={{
              padding: '0.625rem 0.875rem',
              borderRadius: borderRadius.sm,
              border: `1px solid ${colors.neutral[200]}`,
              fontSize: '0.875rem',
              gridColumn: 'span 2',
            }}
          />

          <select
            value={difficulty}
            onChange={e => { setDifficulty(e.target.value); setPage(1); }}
            aria-label="Filter by difficulty"
            style={{
              padding: '0.625rem 0.875rem',
              borderRadius: borderRadius.sm,
              border: `1px solid ${colors.neutral[200]}`,
              fontSize: '0.875rem',
              backgroundColor: 'white',
            }}
          >
            <option value="">All difficulties</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>

          <select
            value={sortOption}
            onChange={e => { setSortOption(e.target.value as SortOption); setPage(1); }}
            aria-label="Sort bounties"
            style={{
              padding: '0.625rem 0.875rem',
              borderRadius: borderRadius.sm,
              border: `1px solid ${colors.neutral[200]}`,
              fontSize: '0.875rem',
              backgroundColor: 'white',
            }}
          >
            <option value="reward-desc">Reward: High → Low</option>
            <option value="reward-asc">Reward: Low → High</option>
            <option value="deadline">Deadline: Soonest</option>
            <option value="difficulty">Difficulty: Easiest</option>
            <option value="applications">Most Applied</option>
          </select>

          <input
            type="number"
            placeholder="Min reward ($)"
            value={minReward}
            onChange={e => { setMinReward(e.target.value); setPage(1); }}
            aria-label="Minimum reward in USD"
            min={0}
            style={{
              padding: '0.625rem 0.875rem',
              borderRadius: borderRadius.sm,
              border: `1px solid ${colors.neutral[200]}`,
              fontSize: '0.875rem',
            }}
          />

          <input
            type="number"
            placeholder="Max reward ($)"
            value={maxReward}
            onChange={e => { setMaxReward(e.target.value); setPage(1); }}
            aria-label="Maximum reward in USD"
            min={0}
            style={{
              padding: '0.625rem 0.875rem',
              borderRadius: borderRadius.sm,
              border: `1px solid ${colors.neutral[200]}`,
              fontSize: '0.875rem',
            }}
          />
        </div>

        {/* Grid */}
        {listLoading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: spacing.md,
            }}
          >
            {[1, 2, 3, 4, 5, 6].map(k => <SkeletonCard key={k} />)}
          </div>
        ) : listResp && listResp.data.length > 0 ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: spacing.md,
              }}
            >
              {listResp.data.map(b => <BountyCard key={b.id} bounty={b} />)}
            </div>

            {/* Pagination */}
            {listResp.totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: spacing.sm,
                  marginTop: spacing.xl,
                }}
              >
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  aria-label="Previous page"
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: borderRadius.sm,
                    border: `1px solid ${colors.neutral[200]}`,
                    backgroundColor: page === 1 ? colors.neutral[100] : 'white',
                    color: page === 1 ? colors.neutral[500] : colors.neutral[900],
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                >
                  ← Prev
                </button>

                <span style={{ fontSize: '0.875rem', color: colors.neutral[500] }}>
                  Page {listResp.page} of {listResp.totalPages}
                </span>

                <button
                  onClick={() => setPage(p => Math.min(listResp.totalPages, p + 1))}
                  disabled={page === listResp.totalPages}
                  aria-label="Next page"
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: borderRadius.sm,
                    border: `1px solid ${colors.neutral[200]}`,
                    backgroundColor: page === listResp.totalPages ? colors.neutral[100] : 'white',
                    color: page === listResp.totalPages ? colors.neutral[500] : colors.neutral[900],
                    cursor: page === listResp.totalPages ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        ) : (
          <div
            role="status"
            style={{
              textAlign: 'center',
              padding: spacing.xl,
              color: colors.neutral[500],
              border: `1px dashed ${colors.neutral[200]}`,
              borderRadius: borderRadius.lg,
            }}
          >
            No bounties found. Try adjusting your filters.
          </div>
        )}
      </section>
    </main>
  );
}
