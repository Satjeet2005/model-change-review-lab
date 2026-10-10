import { describe, it, expect } from 'vitest';
import { calculateModel } from '../calculation';
import { createSeedAssumptions } from '../seed';
import { commitTransaction } from '../transactions';
import { ProposalOperation } from '../types';

describe('Calculation Engine & Transactions (T-018 / PRD Tests 3-12)', () => {
  it('computes exactly 24 outputs for each calculated row (PRD Test 3)', () => {
    const seed = createSeedAssumptions();
    const result = calculateModel(seed);

    expect(result.months).toHaveLength(24);
    for (let i = 0; i < 24; i++) {
      const m = result.months[i]!;
      expect(m.period).toBe(i + 1);
      expect(typeof m.revenue).toBe('number');
      expect(typeof m.totalFte).toBe('number');
      expect(typeof m.payroll).toBe('number');
      expect(typeof m.totalOperatingExpense).toBe('number');
      expect(typeof m.ebitda).toBe('number');
      expect(typeof m.endingCash).toBe('number');
    }
  });

  it('matches independently verified values for M01 and M07 (PRD Tests 4 & 5)', () => {
    const seed = createSeedAssumptions();
    const result = calculateModel(seed);

    // M01 Independent Verification:
    // Revenue = 750,000 * 1.025 = 768,750.00
    // Total FTE = 12 + 18 = 30
    // Payroll = 30 * 12,000 = 360,000.00
    // Total OpEx = 360,000 + 240,000 = 600,000.00
    // EBITDA = 768,750 - 600,000 = 168,750.00
    // Ending Cash = 3,000,000 + 168,750 = 3,168,750.00
    const m01 = result.months[0]!;
    expect(m01.revenue).toBe(768750);
    expect(m01.totalFte).toBe(30);
    expect(m01.payroll).toBe(360000);
    expect(m01.totalOperatingExpense).toBe(600000);
    expect(m01.ebitda).toBe(168750);
    expect(m01.endingCash).toBe(3168750);

    // M07 Independent Verification:
    // Compounded revenue roll-forward: 891,514.31
    // Total FTE = 14 + 20 = 34
    // Payroll = 34 * 12,000 = 408,000.00
    // Total OpEx = 408,000 + 240,000 = 648,000.00
    // EBITDA = 891,514.31 - 648,000 = 243,514.31
    const m07 = result.months[6]!;
    expect(m07.revenue).toBe(891514.31);
    expect(m07.totalFte).toBe(34);
    expect(m07.payroll).toBe(408000);
    expect(m07.totalOperatingExpense).toBe(648000);
    expect(m07.ebitda).toBe(243514.31);

    // M24 Independent Verification (24-month horizon terminus):
    // Starting Revenue: 750,000 compounding at 2.5% monthly across 24 periods = 1,356,544.45
    // Total FTE = 18 (eng) + 24 (other) = 42
    // Payroll = 42 * 12,000 = 504,000.00
    // Total OpEx = 504,000 + 240,000 = 744,000.00
    // EBITDA = 1,356,544.45 - 744,000 = 612,544.45
    // Ending Cash = rolling sum starting from 3,000,000 + sum(EBITDA M01..M24) = 11,740,322.82
    const m24 = result.months[23]!;
    expect(m24.period).toBe(24);
    expect(m24.revenue).toBe(1356544.45);
    expect(m24.totalFte).toBe(42);
    expect(m24.payroll).toBe(504000);
    expect(m24.totalOperatingExpense).toBe(744000);
    expect(m24.ebitda).toBe(612544.45);
    expect(m24.endingCash).toBe(11740322.82);

    // Calculated Summary Metrics Verification:
    expect(result.summary.m24Revenue).toBe(1356544.45);
    expect(result.summary.m24TotalFte).toBe(42);
    expect(result.summary.m24Payroll).toBe(504000);
    expect(result.summary.m24TotalOperatingExpense).toBe(744000);
    expect(result.summary.m24Ebitda).toBe(612544.45);
    expect(result.summary.m24EndingCash).toBe(11740322.82);
    expect(result.summary.cumulativeRevenue).toBe(24868322.82);
  });

  it('guarantees deterministic output and input immutability (PRD Tests 11 & 12)', () => {
    const seed = createSeedAssumptions();
    const seedSnapshot = JSON.stringify(seed);

    const run1 = calculateModel(seed);
    const run2 = calculateModel(seed);

    // Deterministic equality
    expect(run1).toEqual(run2);

    // Input immutability
    expect(JSON.stringify(seed)).toBe(seedSnapshot);
  });

  it('rejects malformed assumptions arrays with fewer than 24 months', () => {
    const seed = createSeedAssumptions();
    seed.months.pop(); // 23 months

    expect(() => calculateModel(seed)).toThrow(/must contain exactly 24 months/);
  });

  it('orchestrates atomic transaction commits successfully (T-015)', () => {
    const seed = createSeedAssumptions();
    const ops: ProposalOperation[] = [
      {
        targetKey: 'startingRevenueUsd',
        targetPeriod: null,
        targetCellId: 'setting:startingRevenueUsd',
        previousValue: 750000,
        proposedValue: 800000,
        displayUnit: 'usd',
        changeLabel: 'Update starting revenue'
      }
    ];

    const { transaction, newAssumptions, calculatedModel } = commitTransaction(
      seed,
      ops,
      'manual-edit',
      'Test manual edit',
      1
    );

    expect(transaction.resultingRevision).toBe(2);
    expect(transaction.kind).toBe('manual-edit');
    expect(newAssumptions.startingRevenueUsd).toBe(800000);
    expect(seed.startingRevenueUsd).toBe(750000); // Immutability
    expect(calculatedModel.months[0]!.revenue).toBe(820000);
  });

  it('fails atomically without modifying model when operations are invalid', () => {
    const seed = createSeedAssumptions();
    const seedSnapshot = JSON.stringify(seed);

    const badOps: ProposalOperation[] = [
      {
        targetKey: 'engineeringFte',
        targetPeriod: 1,
        targetCellId: 'assumption:engineeringFte:M01',
        previousValue: 12,
        proposedValue: 12.5, // Invalid fractional FTE
        displayUnit: 'fte',
        changeLabel: 'Invalid'
      }
    ];

    expect(() => commitTransaction(seed, badOps, 'manual-edit', 'Invalid edit', 1)).toThrow(
      /must be an integer/
    );

    expect(JSON.stringify(seed)).toBe(seedSnapshot);
  });
});
