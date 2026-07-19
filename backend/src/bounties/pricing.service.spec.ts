import { BadRequestException } from '@nestjs/common';
import { PricingService, COMPLEXITY_BANDS } from './pricing.service';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    service = new PricingService();
  });

  describe('clampToTier', () => {
    it('clamps below the band minimum up to the minimum', () => {
      expect(service.clampToTier(-50, 'easy')).toBe(0);
      expect(service.clampToTier(50, 'medium')).toBe(COMPLEXITY_BANDS.medium.min);
    });

    it('clamps above the band maximum down to the maximum', () => {
      expect(service.clampToTier(9999, 'easy')).toBe(COMPLEXITY_BANDS.easy.max);
      expect(service.clampToTier(10000, 'hard')).toBe(COMPLEXITY_BANDS.hard.max);
    });

    it('leaves very-hard prices uncapped above the tier minimum', () => {
      expect(service.clampToTier(50000, 'very-hard')).toBe(50000);
      expect(service.clampToTier(500, 'very-hard')).toBe(2000);
    });

    it('passes through prices already within the band', () => {
      expect(service.clampToTier(250, 'medium')).toBe(250);
    });
  });

  describe('computeDecayFactor', () => {
    it('is 1 at week zero', () => {
      const postedAt = new Date('2026-01-01T00:00:00Z');
      expect(service.computeDecayFactor(postedAt, postedAt)).toBe(1);
    });

    it('drops 5% per elapsed week', () => {
      const postedAt = new Date('2026-01-01T00:00:00Z');
      const twoWeeksLater = new Date(postedAt.getTime() + 2 * WEEK);
      expect(service.computeDecayFactor(postedAt, twoWeeksLater)).toBeCloseTo(0.9, 5);
    });

    it('floors at 0.5 no matter how long it has been unclaimed', () => {
      const postedAt = new Date('2026-01-01T00:00:00Z');
      const muchLater = new Date(postedAt.getTime() + 52 * WEEK);
      expect(service.computeDecayFactor(postedAt, muchLater)).toBe(0.5);
    });

    it('never returns a factor below the floor even for negative elapsed time', () => {
      const postedAt = new Date('2026-01-01T00:00:00Z');
      const before = new Date(postedAt.getTime() - WEEK);
      expect(service.computeDecayFactor(postedAt, before)).toBe(1);
    });
  });

  describe('computeMarketMultiplier', () => {
    it('boosts price 20% when fewer than 3 qualified applicants', () => {
      expect(service.computeMarketMultiplier(0)).toBe(1.2);
      expect(service.computeMarketMultiplier(2)).toBe(1.2);
    });

    it('is neutral between 3 and 10 qualified applicants inclusive', () => {
      expect(service.computeMarketMultiplier(3)).toBe(1);
      expect(service.computeMarketMultiplier(10)).toBe(1);
    });

    it('discounts price 10% when more than 10 qualified applicants', () => {
      expect(service.computeMarketMultiplier(11)).toBe(0.9);
      expect(service.computeMarketMultiplier(100)).toBe(0.9);
    });
  });

  describe('computePrice', () => {
    it('returns the base price unchanged at t=0 with a neutral applicant pool', () => {
      const postedAt = new Date('2026-01-01T00:00:00Z');
      const result = service.computePrice({
        basePrice: 400,
        complexityTier: 'medium',
        postedAt,
        qualifiedApplicantCount: 5,
        now: postedAt,
      });

      expect(result.currentPrice).toBe(400);
      expect(result.overrideActive).toBe(false);
    });

    it('never prices below the floor (50% of base price) regardless of combined factors', () => {
      const postedAt = new Date('2026-01-01T00:00:00Z');
      const farFuture = new Date(postedAt.getTime() + 52 * WEEK);
      const result = service.computePrice({
        basePrice: 1000,
        complexityTier: 'hard',
        postedAt,
        qualifiedApplicantCount: 50, // -10% market on top of -50% decay floor
        now: farFuture,
      });

      expect(result.floor).toBe(500);
      expect(result.currentPrice).toBeGreaterThanOrEqual(result.floor);
      expect(result.currentPrice).toBe(500);
    });

    it('never prices above the ceiling (120% of base price) regardless of combined factors', () => {
      const postedAt = new Date('2026-01-01T00:00:00Z');
      const result = service.computePrice({
        basePrice: 1000,
        complexityTier: 'hard',
        postedAt,
        qualifiedApplicantCount: 1, // +20% market, no decay yet
        now: postedAt,
      });

      expect(result.ceiling).toBe(1200);
      expect(result.currentPrice).toBeLessThanOrEqual(result.ceiling);
      expect(result.currentPrice).toBe(1200);
    });

    it('applies an active admin override as the current price', () => {
      const postedAt = new Date('2026-01-01T00:00:00Z');
      const result = service.computePrice(
        { basePrice: 400, complexityTier: 'medium', postedAt, qualifiedApplicantCount: 5, now: postedAt },
        420,
      );

      expect(result.computedPrice).toBe(400);
      expect(result.currentPrice).toBe(420);
      expect(result.overrideActive).toBe(true);
    });
  });

  describe('validateOverride', () => {
    it('accepts an override within +/-30% of the computed price', () => {
      expect(service.validateOverride(1000, 1300)).toBe(1300);
      expect(service.validateOverride(1000, 700)).toBe(700);
      expect(service.validateOverride(1000, 1000)).toBe(1000);
    });

    it('rejects an override outside +/-30% of the computed price', () => {
      expect(() => service.validateOverride(1000, 1301)).toThrow(BadRequestException);
      expect(() => service.validateOverride(1000, 699)).toThrow(BadRequestException);
    });
  });

  describe('equilibrium convergence', () => {
    it('monotonically decreases toward the decay floor and then holds steady (constant applicant pool)', () => {
      const postedAt = new Date('2026-01-01T00:00:00Z');
      const prices: number[] = [];

      for (let week = 0; week <= 20; week++) {
        const now = new Date(postedAt.getTime() + week * WEEK);
        const result = service.computePrice({
          basePrice: 1000,
          complexityTier: 'hard',
          postedAt,
          qualifiedApplicantCount: 5, // neutral market signal throughout
          now,
        });
        prices.push(result.currentPrice);
      }

      // Non-increasing week over week.
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
      }

      // Reaches the floor and stays there — equilibrium.
      const floor = 500;
      expect(prices[prices.length - 1]).toBe(floor);
      expect(prices[10]).toBe(floor); // decay hits 50% exactly at week 10
      expect(prices[15]).toBe(floor);
    });

    it('converges to a stable price when market conditions and time both stabilize', () => {
      const postedAt = new Date('2026-01-01T00:00:00Z');

      // Applicant pool starts thin (bonus), fills up past week 10, then holds steady.
      const applicantCountAtWeek = (week: number) => (week < 4 ? 1 : 6);

      let previous: number | null = null;
      let stableRunLength = 0;

      for (let week = 0; week <= 30; week++) {
        const now = new Date(postedAt.getTime() + week * WEEK);
        const result = service.computePrice({
          basePrice: 1000,
          complexityTier: 'hard',
          postedAt,
          qualifiedApplicantCount: applicantCountAtWeek(week),
          now,
        });

        if (previous !== null && Math.abs(result.currentPrice - previous) < 1e-9) {
          stableRunLength++;
        } else {
          stableRunLength = 0;
        }
        previous = result.currentPrice;
      }

      // Once decay floors out (week 10+) and applicant count is constant (week 4+),
      // the price should settle and stop changing — a long steady run near the end.
      expect(stableRunLength).toBeGreaterThanOrEqual(10);
      expect(previous).toBe(500); // floor, since decay dominates once it bottoms out
    });
  });
});
