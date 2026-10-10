import { ModelAssumptions, MonthAssumptions, PeriodIndex } from './types';

/**
 * Creates the deterministic baseline seed assumptions.
 * PRD §6.3: 24-month seed fixture with exact starting settings and stepped FTE ramps.
 * Returns a fresh, unshared object on every invocation.
 */
export function createSeedAssumptions(): ModelAssumptions {
  const months: MonthAssumptions[] = [];

  for (let p = 1; p <= 24; p++) {
    const period = p as PeriodIndex;

    let engineeringFte = 12;
    if (period >= 19) {
      engineeringFte = 18;
    } else if (period >= 13) {
      engineeringFte = 16;
    } else if (period >= 7) {
      engineeringFte = 14;
    }

    let otherFte = 18;
    if (period >= 19) {
      otherFte = 24;
    } else if (period >= 13) {
      otherFte = 22;
    } else if (period >= 7) {
      otherFte = 20;
    }

    months.push({
      period,
      revenueGrowthRate: 0.025,
      engineeringFte,
      otherFte,
      loadedMonthlyCostPerFteUsd: 12000,
      otherOperatingExpenseUsd: 240000
    });
  }

  return {
    startingRevenueUsd: 750000,
    startingCashUsd: 3000000,
    months
  };
}
