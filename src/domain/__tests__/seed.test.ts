import { describe, it, expect } from 'vitest';
import { createSeedAssumptions } from '../seed';

describe('Seed Model Fixture (T-017 / PRD Tests 1-2)', () => {
  it('generates exactly 24 ordered, unique periods matching PRD defaults', () => {
    const seed = createSeedAssumptions();

    expect(seed.startingRevenueUsd).toBe(750000);
    expect(seed.startingCashUsd).toBe(3000000);
    expect(seed.months).toHaveLength(24);

    const periods = seed.months.map((m) => m.period);
    expect(periods).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));

    // Verify FTE ramp steps
    for (let i = 0; i < 24; i++) {
      const p = i + 1;
      const m = seed.months[i]!;

      expect(m.period).toBe(p);
      expect(m.revenueGrowthRate).toBe(0.025);
      expect(m.loadedMonthlyCostPerFteUsd).toBe(12000);
      expect(m.otherOperatingExpenseUsd).toBe(240000);

      if (p <= 6) {
        expect(m.engineeringFte).toBe(12);
        expect(m.otherFte).toBe(18);
      } else if (p <= 12) {
        expect(m.engineeringFte).toBe(14);
        expect(m.otherFte).toBe(20);
      } else if (p <= 18) {
        expect(m.engineeringFte).toBe(16);
        expect(m.otherFte).toBe(22);
      } else {
        expect(m.engineeringFte).toBe(18);
        expect(m.otherFte).toBe(24);
      }
    }
  });

  it('returns independent object instances on subsequent invocations (PRD Test 2)', () => {
    const seedA = createSeedAssumptions();
    const seedB = createSeedAssumptions();

    expect(seedA).not.toBe(seedB);
    expect(seedA.months).not.toBe(seedB.months);
    expect(seedA.months[0]).not.toBe(seedB.months[0]);

    // Mutate seedA
    seedA.startingRevenueUsd = 999999;
    seedA.months[0]!.engineeringFte = 99;

    // Verify seedB is unaffected
    expect(seedB.startingRevenueUsd).toBe(750000);
    expect(seedB.months[0]!.engineeringFte).toBe(12);
  });
});
