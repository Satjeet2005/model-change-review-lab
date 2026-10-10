import { roundMoney } from '../utils/math';
import {
  CalculatedModel,
  CalculatedSummary,
  ModelAssumptions,
  MonthCalculated,
  PeriodIndex
} from './types';

/**
 * Pure calculation engine for Model Change Review Lab.
 * Sole source of financial calculation truth (PRD §6.5 & Invariant 1).
 *
 * For each period t in 1..24:
 * 1. Revenue M01 = roundMoney(startingRevenue * (1 + growthRate[1]))
 *    Revenue Mt>1 = roundMoney(revenue[t-1] * (1 + growthRate[t]))
 * 2. Total FTE = engFte + otherFte
 * 3. Payroll = roundMoney(totalFte * costPerFte)
 * 4. Total OpEx = roundMoney(payroll + otherOpEx)
 * 5. EBITDA = roundMoney(revenue - totalOpEx)
 * 6. Ending Cash M01 = roundMoney(startingCash + EBITDA[1])
 *    Ending Cash Mt>1 = roundMoney(endingCash[t-1] + EBITDA[t])
 */
export function calculateModel(assumptions: Readonly<ModelAssumptions>): CalculatedModel {
  if (!assumptions || !Array.isArray(assumptions.months) || assumptions.months.length !== 24) {
    throw new Error(
      `Invalid assumptions: must contain exactly 24 months, received ${assumptions?.months?.length ?? 0}`
    );
  }

  const months: MonthCalculated[] = [];
  let previousRevenue = roundMoney(assumptions.startingRevenueUsd);
  let previousEndingCash = roundMoney(assumptions.startingCashUsd);
  let cumulativeRevenue = 0;

  for (let i = 0; i < 24; i++) {
    const mAssumptions = assumptions.months[i];
    if (!mAssumptions) {
      throw new Error(`Missing month assumption at index ${i}`);
    }

    const expectedPeriod = (i + 1) as PeriodIndex;
    if (mAssumptions.period !== expectedPeriod) {
      throw new Error(
        `Discontinuous period: expected period ${expectedPeriod}, received ${mAssumptions.period}`
      );
    }

    // 1. Revenue roll-forward
    let revenue: number;
    if (i === 0) {
      revenue = roundMoney(assumptions.startingRevenueUsd * (1 + mAssumptions.revenueGrowthRate));
    } else {
      revenue = roundMoney(previousRevenue * (1 + mAssumptions.revenueGrowthRate));
    }
    previousRevenue = revenue;
    cumulativeRevenue = roundMoney(cumulativeRevenue + revenue);

    // 2. Headcount
    const totalFte = mAssumptions.engineeringFte + mAssumptions.otherFte;

    // 3. Payroll
    const payroll = roundMoney(totalFte * mAssumptions.loadedMonthlyCostPerFteUsd);

    // 4. Total Operating Expense
    const totalOperatingExpense = roundMoney(payroll + mAssumptions.otherOperatingExpenseUsd);

    // 5. EBITDA
    const ebitda = roundMoney(revenue - totalOperatingExpense);

    // 6. Ending Cash
    let endingCash: number;
    if (i === 0) {
      endingCash = roundMoney(assumptions.startingCashUsd + ebitda);
    } else {
      endingCash = roundMoney(previousEndingCash + ebitda);
    }
    previousEndingCash = endingCash;

    months.push({
      period: expectedPeriod,
      revenue,
      totalFte,
      payroll,
      totalOperatingExpense,
      ebitda,
      endingCash
    });
  }

  const m24 = months[23];
  if (!m24) {
    throw new Error('Unexpected calculation failure: month 24 output missing');
  }

  const summary: CalculatedSummary = {
    m24Revenue: m24.revenue,
    m24TotalFte: m24.totalFte,
    m24Payroll: m24.payroll,
    m24TotalOperatingExpense: m24.totalOperatingExpense,
    m24Ebitda: m24.ebitda,
    m24EndingCash: m24.endingCash,
    cumulativeRevenue
  };

  return {
    months,
    summary
  };
}
