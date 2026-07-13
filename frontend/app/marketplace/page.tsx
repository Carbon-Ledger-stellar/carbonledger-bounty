'use client';

import { useState } from 'react';
import { useListings } from '../../lib/api';
import { formatTonnes, stroopsToUSDC } from '../../lib/carbon-utils';
import { colors, spacing } from '../../styles/design-system';

interface FilterState {
  methodology: string;
  vintageYear: string;
  country: string;
  minPrice: string;
  maxPrice: string;
}

export default function MarketplacePage() {
  const [filters, setFilters] = useState<FilterState>({
    methodology: '',
    vintageYear: '',
    country: '',
    minPrice: '',
    maxPrice: '',
  });

  const { data: listings, isLoading } = useListings({
    methodology: filters.methodology || undefined,
    vintage: filters.vintageYear ? Number(filters.vintageYear) : undefined,
    country: filters.country || undefined,
    minPrice: filters.minPrice || undefined,
    maxPrice: filters.maxPrice || undefined,
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: spacing.xl }}>
      <div style={{ marginBottom: spacing.lg }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: colors.neutral[900], margin: '0 0 0.5rem' }}>
          Carbon Credit Marketplace
        </h1>
        <p style={{ color: colors.neutral[500], margin: 0 }}>
          All credits are from verified projects with full satellite monitoring. Prices in USDC.
        </p>
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: spacing.md,
          marginBottom: spacing.lg,
        }}
      >
        <input
          type="text"
          placeholder="Methodology"
          value={filters.methodology}
          onChange={(e) => setFilters({ ...filters, methodology: e.target.value })}
          style={{
            padding: spacing.sm,
            borderRadius: '0.375rem',
            border: `1px solid ${colors.neutral[200]}`,
            fontSize: '0.875rem',
          }}
        />
        <input
          type="number"
          placeholder="Vintage Year"
          value={filters.vintageYear}
          onChange={(e) => setFilters({ ...filters, vintageYear: e.target.value })}
          style={{
            padding: spacing.sm,
            borderRadius: '0.375rem',
            border: `1px solid ${colors.neutral[200]}`,
            fontSize: '0.875rem',
          }}
        />
        <input
          type="text"
          placeholder="Country"
          value={filters.country}
          onChange={(e) => setFilters({ ...filters, country: e.target.value })}
          style={{
            padding: spacing.sm,
            borderRadius: '0.375rem',
            border: `1px solid ${colors.neutral[200]}`,
            fontSize: '0.875rem',
          }}
        />
        <input
          type="number"
          placeholder="Min Price (USDC)"
          value={filters.minPrice}
          onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
          style={{
            padding: spacing.sm,
            borderRadius: '0.375rem',
            border: `1px solid ${colors.neutral[200]}`,
            fontSize: '0.875rem',
          }}
        />
        <input
          type="number"
          placeholder="Max Price (USDC)"
          value={filters.maxPrice}
          onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
          style={{
            padding: spacing.sm,
            borderRadius: '0.375rem',
            border: `1px solid ${colors.neutral[200]}`,
            fontSize: '0.875rem',
          }}
        />
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.neutral[600] }}>
          Loading listings...
        </div>
      ) : listings && listings.length > 0 ? (
        <div>
          <p style={{ fontSize: '0.875rem', color: colors.neutral[500], marginBottom: spacing.md }}>
            {listings.length} listings available
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: spacing.lg,
            }}
          >
            {listings.map((listing) => (
              <div
                key={listing.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '0.75rem',
                  padding: spacing.lg,
                  border: `1px solid ${colors.neutral[200]}`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <p style={{ fontSize: '0.75rem', color: colors.neutral[500], margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>
                    {listing.methodology}
                  </p>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.5rem 0', color: colors.neutral[900] }}>
                    {formatTonnes(listing.amountAvailable)}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: colors.neutral[600], margin: '0.25rem 0' }}>
                    Vintage: {listing.vintageYear}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: colors.neutral[600], margin: '0.25rem 0' }}>
                    {listing.country}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: '1.5rem',
                      fontWeight: 800,
                      color: colors.primary[600],
                      margin: '1rem 0 0.5rem',
                    }}
                  >
                    ${stroopsToUSDC(BigInt(listing.pricePerCredit)).toFixed(2)}/tonne
                  </p>
                  <a
                    href={`/buy?listing=${listing.listingId}`}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: spacing.sm,
                      backgroundColor: colors.primary[500],
                      color: 'white',
                      textAlign: 'center',
                      textDecoration: 'none',
                      borderRadius: '0.375rem',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                    }}
                  >
                    Buy Credits
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: spacing.xl, color: colors.neutral[600] }}>
          No listings found. Try adjusting your filters.
        </div>
      )}
    </div>
  );
}
