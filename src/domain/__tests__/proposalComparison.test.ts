import { describe, it, expect } from 'vitest';
import { calculateProposalVariantComparison } from '../proposalComparison';
import { createSeedAssumptions } from '../seed';
import { ProposalOperation } from '../types';

describe('Proposal Variant Comparison Engine (calculateProposalVariantComparison)', () => {
  const seed = createSeedAssumptions();

  const hireEngOps: ProposalOperation[] = [
    {
      targetKey: 'engineeringFte',
      targetPeriod: 7,
      targetCellId: 'assumption:engineeringFte:M07',
      previousValue: 14,
      proposedValue: 16,
      displayUnit: 'fte',
      changeLabel: '+2 Eng M07'
    }
  ];

  const accelerateGrowthOps: ProposalOperation[] = [
    {
      targetKey: 'revenueGrowthRate',
      targetPeriod: 7,
      targetCellId: 'assumption:revenueGrowthRate:M07',
      previousValue: 0.025,
      proposedValue: 0.035,
      displayUnit: 'percent',
      changeLabel: '+1.0% growth M07'
    }
  ];

  it('produces 24-month comparisons for a single variant against base', () => {
    const result = calculateProposalVariantComparison(seed, hireEngOps);

    expect(result.baseModel.months).toHaveLength(24);
    expect(result.variantAModel.months).toHaveLength(24);
    expect(result.variantBModel).toBeUndefined();

    const fteSeries = result.metrics.totalFte;
    expect(fteSeries.months).toHaveLength(24);

    // M01-M06 should have 0 delta
    expect(fteSeries.months[5]?.variantAAbsoluteDelta).toBe(0);
    expect(fteSeries.months[5]?.variantAPercentageDelta).toBe(0);

    // M07 should have +2 FTE delta
    expect(fteSeries.months[6]?.baseValue).toBe(34); // 14 eng + 20 other
    expect(fteSeries.months[6]?.variantAValue).toBe(36); // 16 eng + 20 other
    expect(fteSeries.months[6]?.variantAAbsoluteDelta).toBe(2);
    expect(fteSeries.months[6]?.variantAPercentageDelta).toBeCloseTo((2 / 34) * 100, 2);

    // Check summary delta
    expect(result.summary.m24TotalFte.base).toBe(42);
    expect(result.summary.m24TotalFte.variantA).toBe(42); // only M07 was edited in hireEngOps
  });

  it('reconciles empty operations gracefully as producing the unchanged base model (0 deltas)', () => {
    const result = calculateProposalVariantComparison(seed, []);

    expect(result.variantAModel.summary.m24Revenue).toBe(result.baseModel.summary.m24Revenue);
    expect(result.variantAModel.summary.m24EndingCash).toBe(result.baseModel.summary.m24EndingCash);

    for (const key of [
      'revenue',
      'totalFte',
      'payroll',
      'totalOperatingExpense',
      'ebitda',
      'endingCash'
    ] as const) {
      for (const m of result.metrics[key].months) {
        expect(m.variantAAbsoluteDelta).toBe(0);
        expect(m.variantAPercentageDelta).toBe(0);
      }
    }

    expect(result.summary.m24Revenue.variantADelta).toBe(0);
    expect(result.summary.m24EndingCash.variantADelta).toBe(0);
  });

  it('compares two variants alongside their shared base (3 series)', () => {
    const result = calculateProposalVariantComparison(seed, hireEngOps, accelerateGrowthOps);

    expect(result.variantBModel).toBeDefined();

    const revSeries = result.metrics.revenue;
    expect(revSeries.months).toHaveLength(24);

    // M07 Revenue comparison
    const m07Rev = revSeries.months[6]!;
    expect(m07Rev.variantBValue).toBeGreaterThan(m07Rev.baseValue);
    expect(m07Rev.variantBAbsoluteDelta).toBeGreaterThan(0);
    expect(m07Rev.variantBVsADelta).toBeDefined();
    // Variant B has higher revenue than Variant A in M07
    expect(m07Rev.variantBVsADelta).toBe(roundMoney(m07Rev.variantBValue! - m07Rev.variantAValue));

    // Summary has both variants
    expect(result.summary.m24Revenue.variantB).toBeDefined();
    expect(result.summary.m24Revenue.variantBDelta).toBeDefined();
    expect(result.summary.m24Revenue.variantBDelta).toBeGreaterThan(0);
  });

  it('handles empty operations in Variant B as unchanged base', () => {
    const result = calculateProposalVariantComparison(seed, hireEngOps, []);

    expect(result.variantBModel).toBeDefined();
    expect(result.summary.m24Revenue.variantB).toBe(result.baseModel.summary.m24Revenue);
    expect(result.summary.m24Revenue.variantBDelta).toBe(0);
  });

  it('safely handles zero base value percentage delta (returns null)', () => {
    // Construct zero starting cash and revenue baseline fixture to test division by zero
    const zeroBase = {
      ...seed,
      startingRevenueUsd: 0,
      startingCashUsd: 0,
      months: seed.months.map((m) => ({ ...m, revenueGrowthRate: 0 }))
    };

    const op: ProposalOperation[] = [
      {
        targetKey: 'startingRevenueUsd',
        targetPeriod: null,
        targetCellId: 'setting:startingRevenueUsd',
        previousValue: 0,
        proposedValue: 100000,
        displayUnit: 'usd',
        changeLabel: 'Non-zero revenue'
      }
    ];

    const result = calculateProposalVariantComparison(zeroBase, op);
    // Base revenue in M01 is 0, so percentage delta must be null
    expect(result.metrics.revenue.months[0]?.baseValue).toBe(0);
    expect(result.metrics.revenue.months[0]?.variantAPercentageDelta).toBeNull();
  });

  it('guarantees model reference independence (non-aliasing) even with empty operations (Fix 7)', () => {
    const result = calculateProposalVariantComparison(seed, [], []);

    expect(result.variantAModel).toBeDefined();
    expect(result.variantBModel).toBeDefined();
    // Distinct object references to prevent accidental in-place mutation aliasing
    expect(result.variantAModel).not.toBe(result.baseModel);
    expect(result.variantBModel).not.toBe(result.baseModel);
    expect(result.variantAModel).not.toBe(result.variantBModel);
  });

  it('throws descriptive error on malformed or out-of-bounds operations in Variant A or Variant B (Fix 4)', () => {
    const invalidOp: ProposalOperation = {
      targetKey: 'engineeringFte',
      targetPeriod: 7,
      targetCellId: 'assumption:engineeringFte:M07',
      previousValue: 14,
      proposedValue: -5, // Negative FTE is strictly invalid
      displayUnit: 'fte',
      changeLabel: 'Negative FTE'
    };

    expect(() => calculateProposalVariantComparison(seed, [invalidOp])).toThrow(
      /Invalid operations in Variant A/
    );

    expect(() => calculateProposalVariantComparison(seed, hireEngOps, [invalidOp])).toThrow(
      /Invalid operations in Variant B/
    );
  });
});

function roundMoney(val: number): number {
  return Math.round(val * 100) / 100;
}
