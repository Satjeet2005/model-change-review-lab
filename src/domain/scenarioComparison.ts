import { roundMoney } from '../utils/math';
import {
  CalculatedModel,
  CalculatedRowKey,
  MetricDelta,
  ScenarioComparison,
  ScenarioSummaryComparison
} from './types';

const CALCULATED_METRIC_KEYS: CalculatedRowKey[] = [
  'revenue',
  'totalFte',
  'payroll',
  'totalOperatingExpense',
  'ebitda',
  'endingCash'
];

/**
 * Computes percentage variance following PRD convention:
 * absoluteDelta / abs(baselineValue) * 100
 * Returns null if baselineValue is 0.
 */
function computePercentageDelta(baselineValue: number, absoluteDelta: number): number | null {
  if (baselineValue === 0) {
    return null;
  }
  return roundMoney((absoluteDelta / Math.abs(baselineValue)) * 100);
}

/**
 * Compares two calculated scenarios (Baseline vs Working) across 24 periods.
 * PRD §11 & §16.2 (T-016): Pure comparison calculations.
 */
export function calculateScenarioDelta(
  baseline: CalculatedModel,
  working: CalculatedModel
): ScenarioComparison {
  if (baseline.months.length !== 24 || working.months.length !== 24) {
    throw new Error('Both scenarios must have exactly 24 periods for comparison');
  }

  const metrics = {} as Record<CalculatedRowKey, MetricDelta[]>;

  for (const key of CALCULATED_METRIC_KEYS) {
    metrics[key] = [];
    for (let i = 0; i < 24; i++) {
      const bMonth = baseline.months[i]!;
      const wMonth = working.months[i]!;
      const period = bMonth.period;

      const baselineVal = bMonth[key];
      const workingVal = wMonth[key];
      const absoluteDelta = roundMoney(workingVal - baselineVal);
      const percentageDelta = computePercentageDelta(baselineVal, absoluteDelta);

      metrics[key].push({
        period,
        metricKey: key,
        baselineValue: baselineVal,
        workingValue: workingVal,
        absoluteDelta,
        percentageDelta
      });
    }
  }

  // Summary Deltas
  const cumRevBaseline = baseline.summary.cumulativeRevenue;
  const cumRevWorking = working.summary.cumulativeRevenue;
  const cumRevAbsDelta = roundMoney(cumRevWorking - cumRevBaseline);
  const cumRevPctDelta = computePercentageDelta(cumRevBaseline, cumRevAbsDelta);

  const m24CashBaseline = baseline.summary.m24EndingCash;
  const m24CashWorking = working.summary.m24EndingCash;
  const m24CashAbsDelta = roundMoney(m24CashWorking - m24CashBaseline);
  const m24CashPctDelta = computePercentageDelta(m24CashBaseline, m24CashAbsDelta);

  const summary: ScenarioSummaryComparison = {
    cumulativeRevenueBaseline: cumRevBaseline,
    cumulativeRevenueWorking: cumRevWorking,
    cumulativeRevenueAbsoluteDelta: cumRevAbsDelta,
    cumulativeRevenuePercentageDelta: cumRevPctDelta,
    m24EndingCashBaseline: m24CashBaseline,
    m24EndingCashWorking: m24CashWorking,
    m24EndingCashAbsoluteDelta: m24CashAbsDelta,
    m24EndingCashPercentageDelta: m24CashPctDelta
  };

  return {
    metrics,
    summary
  };
}
