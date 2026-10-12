import { roundMoney } from '../utils/math';
import { calculateModel } from './calculation';
import { applyOperationsToDraft } from './operations';
import { validateVariantOperationsForPreview } from './validation';
import {
  CalculatedModel,
  CalculatedRowKey,
  DisplayUnit,
  PeriodIndex,
  ProposalOperation,
  ReadonlyModelAssumptions
} from './types';

export interface MetricMonthlyComparison {
  period: PeriodIndex;
  baseValue: number;
  variantAValue: number;
  variantAAbsoluteDelta: number;
  variantAPercentageDelta: number | null; // null if baseValue === 0
  variantBValue?: number;
  variantBAbsoluteDelta?: number;
  variantBPercentageDelta?: number | null; // null if baseValue === 0
  variantBVsADelta?: number;
}

export interface MetricComparisonSeries {
  metricKey: CalculatedRowKey;
  label: string;
  unit: DisplayUnit;
  months: MetricMonthlyComparison[];
}

export interface ProposalVariantComparisonSummary {
  m24Revenue: {
    base: number;
    variantA: number;
    variantADelta: number;
    variantB?: number;
    variantBDelta?: number;
  };
  m24TotalFte: {
    base: number;
    variantA: number;
    variantADelta: number;
    variantB?: number;
    variantBDelta?: number;
  };
  m24Payroll: {
    base: number;
    variantA: number;
    variantADelta: number;
    variantB?: number;
    variantBDelta?: number;
  };
  m24TotalOperatingExpense: {
    base: number;
    variantA: number;
    variantADelta: number;
    variantB?: number;
    variantBDelta?: number;
  };
  m24Ebitda: {
    base: number;
    variantA: number;
    variantADelta: number;
    variantB?: number;
    variantBDelta?: number;
  };
  m24EndingCash: {
    base: number;
    variantA: number;
    variantADelta: number;
    variantB?: number;
    variantBDelta?: number;
  };
  cumulativeRevenue: {
    base: number;
    variantA: number;
    variantADelta: number;
    variantB?: number;
    variantBDelta?: number;
  };
}

export interface ProposalVariantComparisonResult {
  baseModel: CalculatedModel;
  variantAModel: CalculatedModel;
  variantBModel?: CalculatedModel;
  metrics: Record<CalculatedRowKey, MetricComparisonSeries>;
  summary: ProposalVariantComparisonSummary;
}

const CALCULATED_METRIC_CONFIG: { key: CalculatedRowKey; label: string; unit: DisplayUnit }[] = [
  { key: 'revenue', label: 'Revenue', unit: 'usd' },
  { key: 'totalFte', label: 'Total FTE', unit: 'fte' },
  { key: 'payroll', label: 'Payroll', unit: 'usd' },
  { key: 'totalOperatingExpense', label: 'Total OpEx', unit: 'usd' },
  { key: 'ebitda', label: 'EBITDA', unit: 'usd' },
  { key: 'endingCash', label: 'Ending Cash', unit: 'usd' }
];

function computePercentageDelta(baseValue: number, absoluteDelta: number): number | null {
  if (baseValue === 0) {
    return null;
  }
  return roundMoney((absoluteDelta / Math.abs(baseValue)) * 100);
}

/**
 * Pure calculation helper for comparing proposal variants against the workspace base snapshot.
 * Supports comparing Base vs Variant A, or Base vs Variant A vs Variant B across all 24 periods.
 *
 * Empty-Operation Handling Reconciled:
 * An empty variant operation set (ops.length === 0) is treated gracefully as producing
 * the unchanged base model (0 deltas across all 24 periods).
 */
export function calculateProposalVariantComparison(
  baseAssumptions: ReadonlyModelAssumptions,
  variantAOps: readonly ProposalOperation[] = [],
  variantBOps?: readonly ProposalOperation[]
): ProposalVariantComparisonResult {
  // Strict operation validation for preview/comparison (PRD §4.3, §7.3, §9.1)
  const valA = validateVariantOperationsForPreview(variantAOps, baseAssumptions);
  if (!valA.valid) {
    throw new Error(
      `Invalid operations in Variant A: ${valA.errors.map((e) => e.message).join('; ')}`
    );
  }

  if (variantBOps !== undefined) {
    const valB = validateVariantOperationsForPreview(variantBOps, baseAssumptions);
    if (!valB.valid) {
      throw new Error(
        `Invalid operations in Variant B: ${valB.errors.map((e) => e.message).join('; ')}`
      );
    }
  }

  const baseModel = calculateModel(baseAssumptions);

  // Variant A calculation (independent model instance to prevent reference aliasing)
  let variantAModel: CalculatedModel;
  if (!variantAOps || variantAOps.length === 0) {
    variantAModel = calculateModel(baseAssumptions);
  } else {
    const draftA = applyOperationsToDraft(baseAssumptions, [...variantAOps]);
    variantAModel = calculateModel(draftA);
  }

  // Variant B calculation (independent model instance to prevent reference aliasing)
  let variantBModel: CalculatedModel | undefined;
  if (variantBOps !== undefined) {
    if (variantBOps.length === 0) {
      variantBModel = calculateModel(baseAssumptions);
    } else {
      const draftB = applyOperationsToDraft(baseAssumptions, [...variantBOps]);
      variantBModel = calculateModel(draftB);
    }
  }

  const metrics = {} as Record<CalculatedRowKey, MetricComparisonSeries>;

  for (const { key, label, unit } of CALCULATED_METRIC_CONFIG) {
    const months: MetricMonthlyComparison[] = [];

    for (let i = 0; i < 24; i++) {
      const bMonth = baseModel.months[i]!;
      const aMonth = variantAModel.months[i]!;
      const baseValue = bMonth[key];
      const variantAValue = aMonth[key];
      const variantAAbsoluteDelta = roundMoney(variantAValue - baseValue);
      const variantAPercentageDelta = computePercentageDelta(baseValue, variantAAbsoluteDelta);

      let variantBValue: number | undefined;
      let variantBAbsoluteDelta: number | undefined;
      let variantBPercentageDelta: number | null | undefined;
      let variantBVsADelta: number | undefined;

      if (variantBModel) {
        const bModMonth = variantBModel.months[i]!;
        variantBValue = bModMonth[key];
        variantBAbsoluteDelta = roundMoney(variantBValue - baseValue);
        variantBPercentageDelta = computePercentageDelta(baseValue, variantBAbsoluteDelta);
        variantBVsADelta = roundMoney(variantBValue - variantAValue);
      }

      months.push({
        period: bMonth.period,
        baseValue,
        variantAValue,
        variantAAbsoluteDelta,
        variantAPercentageDelta,
        variantBValue,
        variantBAbsoluteDelta,
        variantBPercentageDelta,
        variantBVsADelta
      });
    }

    metrics[key] = {
      metricKey: key,
      label,
      unit,
      months
    };
  }

  const summary: ProposalVariantComparisonSummary = {
    m24Revenue: {
      base: baseModel.summary.m24Revenue,
      variantA: variantAModel.summary.m24Revenue,
      variantADelta: roundMoney(variantAModel.summary.m24Revenue - baseModel.summary.m24Revenue),
      variantB: variantBModel?.summary.m24Revenue,
      variantBDelta: variantBModel
        ? roundMoney(variantBModel.summary.m24Revenue - baseModel.summary.m24Revenue)
        : undefined
    },
    m24TotalFte: {
      base: baseModel.summary.m24TotalFte,
      variantA: variantAModel.summary.m24TotalFte,
      variantADelta: roundMoney(variantAModel.summary.m24TotalFte - baseModel.summary.m24TotalFte),
      variantB: variantBModel?.summary.m24TotalFte,
      variantBDelta: variantBModel
        ? roundMoney(variantBModel.summary.m24TotalFte - baseModel.summary.m24TotalFte)
        : undefined
    },
    m24Payroll: {
      base: baseModel.summary.m24Payroll,
      variantA: variantAModel.summary.m24Payroll,
      variantADelta: roundMoney(variantAModel.summary.m24Payroll - baseModel.summary.m24Payroll),
      variantB: variantBModel?.summary.m24Payroll,
      variantBDelta: variantBModel
        ? roundMoney(variantBModel.summary.m24Payroll - baseModel.summary.m24Payroll)
        : undefined
    },
    m24TotalOperatingExpense: {
      base: baseModel.summary.m24TotalOperatingExpense,
      variantA: variantAModel.summary.m24TotalOperatingExpense,
      variantADelta: roundMoney(
        variantAModel.summary.m24TotalOperatingExpense - baseModel.summary.m24TotalOperatingExpense
      ),
      variantB: variantBModel?.summary.m24TotalOperatingExpense,
      variantBDelta: variantBModel
        ? roundMoney(
            variantBModel.summary.m24TotalOperatingExpense -
              baseModel.summary.m24TotalOperatingExpense
          )
        : undefined
    },
    m24Ebitda: {
      base: baseModel.summary.m24Ebitda,
      variantA: variantAModel.summary.m24Ebitda,
      variantADelta: roundMoney(variantAModel.summary.m24Ebitda - baseModel.summary.m24Ebitda),
      variantB: variantBModel?.summary.m24Ebitda,
      variantBDelta: variantBModel
        ? roundMoney(variantBModel.summary.m24Ebitda - baseModel.summary.m24Ebitda)
        : undefined
    },
    m24EndingCash: {
      base: baseModel.summary.m24EndingCash,
      variantA: variantAModel.summary.m24EndingCash,
      variantADelta: roundMoney(
        variantAModel.summary.m24EndingCash - baseModel.summary.m24EndingCash
      ),
      variantB: variantBModel?.summary.m24EndingCash,
      variantBDelta: variantBModel
        ? roundMoney(variantBModel.summary.m24EndingCash - baseModel.summary.m24EndingCash)
        : undefined
    },
    cumulativeRevenue: {
      base: baseModel.summary.cumulativeRevenue,
      variantA: variantAModel.summary.cumulativeRevenue,
      variantADelta: roundMoney(
        variantAModel.summary.cumulativeRevenue - baseModel.summary.cumulativeRevenue
      ),
      variantB: variantBModel?.summary.cumulativeRevenue,
      variantBDelta: variantBModel
        ? roundMoney(variantBModel.summary.cumulativeRevenue - baseModel.summary.cumulativeRevenue)
        : undefined
    }
  };

  return {
    baseModel,
    variantAModel,
    variantBModel,
    metrics,
    summary
  };
}
