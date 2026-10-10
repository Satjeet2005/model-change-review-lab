import { describe, it, expect } from 'vitest';
import { calculateModel } from '../calculation';
import { applyOperationsToDraft } from '../operations';
import { calculateScenarioDelta } from '../scenarioComparison';
import { createSeedAssumptions } from '../seed';
import { CellId, MonthIdString, PeriodIndex, ProposalOperation } from '../types';

describe('Scenario Comparison Calculations (T-022 / PRD Tests 19-20)', () => {
  it('calculates correct absolute and percentage deltas across 24 periods', () => {
    const baselineAssumptions = createSeedAssumptions();
    const baselineCalculated = calculateModel(baselineAssumptions);

    // Create a working scenario where engineering FTE is increased by 2 for M07-M24
    const ops: ProposalOperation[] = [];
    for (let p = 7; p <= 24; p++) {
      const period = p as PeriodIndex;
      const mStr = (period < 10 ? `M0${period}` : `M${period}`) as MonthIdString;
      const targetCellId: CellId = `assumption:engineeringFte:${mStr}`;
      ops.push({
        targetKey: 'engineeringFte',
        targetPeriod: period,
        targetCellId,
        previousValue: 14,
        proposedValue: 16,
        displayUnit: 'fte',
        changeLabel: '+2 Eng FTE'
      });
    }

    const workingAssumptions = applyOperationsToDraft(baselineAssumptions, ops);
    const workingCalculated = calculateModel(workingAssumptions);

    const delta = calculateScenarioDelta(baselineCalculated, workingCalculated);

    expect(delta.metrics.revenue).toHaveLength(24);
    expect(delta.metrics.totalFte).toHaveLength(24);

    // M01: No change
    expect(delta.metrics.totalFte[0]!.absoluteDelta).toBe(0);
    expect(delta.metrics.totalFte[0]!.percentageDelta).toBe(0);

    // M07: Total FTE increases by 2 from 34 to 36
    const m07Fte = delta.metrics.totalFte[6]!;
    expect(m07Fte.baselineValue).toBe(34);
    expect(m07Fte.workingValue).toBe(36);
    expect(m07Fte.absoluteDelta).toBe(2);
    // (2 / 34) * 100 = 5.88%
    expect(m07Fte.percentageDelta).toBeCloseTo(5.88, 2);

    // M07: Payroll increases by 2 * 12,000 = $24,000
    const m07Payroll = delta.metrics.payroll[6]!;
    expect(m07Payroll.absoluteDelta).toBe(24000);
  });

  it('handles zero-baseline values by returning null for percentageDelta (PRD Test 19)', () => {
    const baseline = calculateModel(createSeedAssumptions());
    const working = calculateModel(createSeedAssumptions());

    // Inject 0 into baseline EBITDA for test period M05
    baseline.months[4]!.ebitda = 0;
    working.months[4]!.ebitda = 50000;

    const delta = calculateScenarioDelta(baseline, working);
    const m05Ebitda = delta.metrics.ebitda[4]!;

    expect(m05Ebitda.baselineValue).toBe(0);
    expect(m05Ebitda.workingValue).toBe(50000);
    expect(m05Ebitda.absoluteDelta).toBe(50000);
    expect(m05Ebitda.percentageDelta).toBeNull(); // Must be null, not Infinity or NaN
  });

  it('correctly handles negative baselines and sums cumulative revenue (PRD Test 20)', () => {
    const baseline = calculateModel(createSeedAssumptions());
    const working = calculateModel(createSeedAssumptions());

    // Negative baseline EBITDA
    baseline.months[10]!.ebitda = -100000;
    working.months[10]!.ebitda = -80000;

    const delta = calculateScenarioDelta(baseline, working);
    const m11Ebitda = delta.metrics.ebitda[10]!;

    expect(m11Ebitda.absoluteDelta).toBe(20000);
    // absoluteDelta / abs(baseline) * 100 = 20000 / 100000 * 100 = 20%
    expect(m11Ebitda.percentageDelta).toBe(20);

    // Cumulative revenue summary is sum of all monthly revenues
    let manualSum = 0;
    for (const m of baseline.months) {
      manualSum += m.revenue;
    }
    expect(delta.summary.cumulativeRevenueBaseline).toBeCloseTo(manualSum, 2);
  });
});
