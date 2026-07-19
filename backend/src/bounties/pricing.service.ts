import { BadRequestException, Injectable } from '@nestjs/common';
import { Difficulty } from './bounties.dto';

export type ComplexityTier = 'easy' | 'medium' | 'hard' | 'very-hard';

/**
 * Base price bands per complexity tier (USD).
 * `max: null` means unbounded (very-hard has no ceiling on the base price itself).
 */
export const COMPLEXITY_BANDS: Record<ComplexityTier, { min: number; max: number | null }> = {
  easy: { min: 0, max: 100 },
  medium: { min: 100, max: 500 },
  hard: { min: 500, max: 2000 },
  'very-hard': { min: 2000, max: null },
};

// Existing Bounty.difficulty uses a different vocabulary than the pricing
// engine's complexity tiers; this is the single mapping between the two.
export const DIFFICULTY_TO_TIER: Record<Difficulty, ComplexityTier> = {
  beginner: 'easy',
  intermediate: 'medium',
  advanced: 'hard',
  expert: 'very-hard',
};

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// Time decay: price drops 5% per week unclaimed, floors at 50% of base price.
const WEEKLY_DECAY_RATE = 0.05;
const MIN_DECAY_FACTOR = 0.5;

// Market adjustment based on qualified applicant pool size.
const LOW_APPLICANT_THRESHOLD = 3; // fewer than this -> under-served, raise reward
const HIGH_APPLICANT_THRESHOLD = 10; // more than this -> over-subscribed, lower reward
const LOW_APPLICANT_MULTIPLIER = 1.2;
const HIGH_APPLICANT_MULTIPLIER = 0.9;
const NEUTRAL_MULTIPLIER = 1;

// Admin override must stay within this fraction of the current computed price.
const ADMIN_OVERRIDE_BOUND = 0.3;

export interface PricingInput {
  basePrice: number;
  complexityTier: ComplexityTier;
  /** When the bounty was posted / became unclaimed. */
  postedAt: Date;
  /** Number of applicants meeting the bounty's stated requirements. */
  qualifiedApplicantCount: number;
  now?: Date;
}

export interface PricingBreakdown {
  complexityTier: ComplexityTier;
  basePrice: number;
  decayFactor: number;
  marketMultiplier: number;
  floor: number;
  ceiling: number;
  /** Market-computed price before any admin override. */
  computedPrice: number;
  /** computedPrice unless an admin override is active. */
  currentPrice: number;
  overrideActive: boolean;
}

@Injectable()
export class PricingService {
  /**
   * Clamp a proposed base price into the valid band for its complexity tier.
   */
  clampToTier(price: number, tier: ComplexityTier): number {
    const band = COMPLEXITY_BANDS[tier];
    const withMin = Math.max(price, band.min);
    return band.max == null ? withMin : Math.min(withMin, band.max);
  }

  /**
   * Multiplicative decay factor for time spent unclaimed: -5%/week, floors at 0.5.
   */
  computeDecayFactor(postedAt: Date, now: Date = new Date()): number {
    const weeksElapsed = Math.max(0, (now.getTime() - postedAt.getTime()) / MS_PER_WEEK);
    return Math.max(MIN_DECAY_FACTOR, 1 - WEEKLY_DECAY_RATE * weeksElapsed);
  }

  /**
   * Market multiplier from the qualified applicant pool size.
   */
  computeMarketMultiplier(qualifiedApplicantCount: number): number {
    if (qualifiedApplicantCount < LOW_APPLICANT_THRESHOLD) return LOW_APPLICANT_MULTIPLIER;
    if (qualifiedApplicantCount > HIGH_APPLICANT_THRESHOLD) return HIGH_APPLICANT_MULTIPLIER;
    return NEUTRAL_MULTIPLIER;
  }

  /**
   * Full pricing breakdown for a bounty at a point in time.
   * currentPrice is always clamped to [floor, ceiling] to prevent extreme
   * fluctuations regardless of how decay/market factors combine.
   */
  computePrice(input: PricingInput, overridePrice?: number): PricingBreakdown {
    const basePrice = this.clampToTier(input.basePrice, input.complexityTier);
    const decayFactor = this.computeDecayFactor(input.postedAt, input.now ?? new Date());
    const marketMultiplier = this.computeMarketMultiplier(input.qualifiedApplicantCount);

    const floor = basePrice * MIN_DECAY_FACTOR;
    const ceiling = basePrice * LOW_APPLICANT_MULTIPLIER;

    const raw = basePrice * decayFactor * marketMultiplier;
    const computedPrice = Math.min(Math.max(raw, floor), ceiling);

    const overrideActive = overridePrice != null;
    const currentPrice = overrideActive ? overridePrice! : computedPrice;

    return {
      complexityTier: input.complexityTier,
      basePrice,
      decayFactor,
      marketMultiplier,
      floor,
      ceiling,
      computedPrice,
      currentPrice,
      overrideActive,
    };
  }

  /**
   * Validate an admin override against the current market-computed price.
   * Throws if outside the allowed +/-30% band. Returns the validated price.
   */
  validateOverride(computedPrice: number, overridePrice: number): number {
    const lower = computedPrice * (1 - ADMIN_OVERRIDE_BOUND);
    const upper = computedPrice * (1 + ADMIN_OVERRIDE_BOUND);

    if (overridePrice < lower || overridePrice > upper) {
      throw new BadRequestException(
        `Override price $${overridePrice.toFixed(2)} is outside the allowed +/-${
          ADMIN_OVERRIDE_BOUND * 100
        }% bound of the computed price ($${lower.toFixed(2)} - $${upper.toFixed(2)})`,
      );
    }

    return overridePrice;
  }
}
