import {
  CalculatedModel,
  CellId,
  ModelAssumptions,
  MonthIdString,
  PeriodIndex,
  TraceIndex,
  TraceNode
} from './types';

function formatPeriodId(p: PeriodIndex): MonthIdString {
  return (p < 10 ? `M0${p}` : `M${p}`) as MonthIdString;
}

/**
 * Builds the complete deterministic trace index for a calculated scenario.
 * PRD §9.3 & §9.4: Every calculated cell links explicitly to its formula and dependencies.
 */
export function buildTraceIndex(
  assumptions: ModelAssumptions,
  calculated: CalculatedModel
): TraceIndex {
  const nodes: Record<CellId, TraceNode> = {} as Record<CellId, TraceNode>;

  // 1. Settings nodes
  const startingRevenueId: CellId = 'setting:startingRevenueUsd';
  nodes[startingRevenueId] = {
    id: startingRevenueId,
    kind: 'setting',
    label: 'Starting Revenue',
    period: null,
    value: assumptions.startingRevenueUsd,
    unit: '$',
    inputIds: []
  };

  const startingCashId: CellId = 'setting:startingCashUsd';
  nodes[startingCashId] = {
    id: startingCashId,
    kind: 'setting',
    label: 'Starting Cash',
    period: null,
    value: assumptions.startingCashUsd,
    unit: '$',
    inputIds: []
  };

  // 2. Month assumption nodes
  for (const m of assumptions.months) {
    const mStr = formatPeriodId(m.period);

    const growthId: CellId = `assumption:revenueGrowthRate:${mStr}`;
    nodes[growthId] = {
      id: growthId,
      kind: 'assumption',
      label: `Revenue Growth (${mStr})`,
      period: m.period,
      value: m.revenueGrowthRate,
      unit: '%',
      inputIds: []
    };

    const engFteId: CellId = `assumption:engineeringFte:${mStr}`;
    nodes[engFteId] = {
      id: engFteId,
      kind: 'assumption',
      label: `Engineering FTE (${mStr})`,
      period: m.period,
      value: m.engineeringFte,
      unit: 'FTE',
      inputIds: []
    };

    const otherFteId: CellId = `assumption:otherFte:${mStr}`;
    nodes[otherFteId] = {
      id: otherFteId,
      kind: 'assumption',
      label: `Other FTE (${mStr})`,
      period: m.period,
      value: m.otherFte,
      unit: 'FTE',
      inputIds: []
    };

    const costPerFteId: CellId = `assumption:loadedMonthlyCostPerFteUsd:${mStr}`;
    nodes[costPerFteId] = {
      id: costPerFteId,
      kind: 'assumption',
      label: `Cost per FTE (${mStr})`,
      period: m.period,
      value: m.loadedMonthlyCostPerFteUsd,
      unit: '$',
      inputIds: []
    };

    const opexId: CellId = `assumption:otherOperatingExpenseUsd:${mStr}`;
    nodes[opexId] = {
      id: opexId,
      kind: 'assumption',
      label: `Other OpEx (${mStr})`,
      period: m.period,
      value: m.otherOperatingExpenseUsd,
      unit: '$',
      inputIds: []
    };
  }

  // 3. Calculated nodes
  for (let i = 0; i < 24; i++) {
    const calc = calculated.months[i];
    if (!calc) continue;

    const p = calc.period;
    const mStr = formatPeriodId(p);
    const prevMStr = p > 1 ? formatPeriodId((p - 1) as PeriodIndex) : null;

    // Revenue
    const revId: CellId = `calculated:revenue:${mStr}`;
    const revInputs: CellId[] =
      p === 1
        ? [startingRevenueId, `assumption:revenueGrowthRate:${mStr}`]
        : [`calculated:revenue:${prevMStr!}`, `assumption:revenueGrowthRate:${mStr}`];

    nodes[revId] = {
      id: revId,
      kind: 'calculated',
      label: `Revenue (${mStr})`,
      period: p,
      value: calc.revenue,
      unit: '$',
      formulaLabel:
        p === 1
          ? 'Starting Revenue × (1 + Revenue Growth Rate M01)'
          : `Revenue ${prevMStr} × (1 + Revenue Growth Rate ${mStr})`,
      inputIds: revInputs
    };

    // Total FTE
    const fteId: CellId = `calculated:totalFte:${mStr}`;
    nodes[fteId] = {
      id: fteId,
      kind: 'calculated',
      label: `Total FTE (${mStr})`,
      period: p,
      value: calc.totalFte,
      unit: 'FTE',
      formulaLabel: `Engineering FTE + Other FTE (${mStr})`,
      inputIds: [`assumption:engineeringFte:${mStr}`, `assumption:otherFte:${mStr}`]
    };

    // Payroll
    const payrollId: CellId = `calculated:payroll:${mStr}`;
    nodes[payrollId] = {
      id: payrollId,
      kind: 'calculated',
      label: `Payroll (${mStr})`,
      period: p,
      value: calc.payroll,
      unit: '$',
      formulaLabel: `Total FTE × Loaded Cost per FTE (${mStr})`,
      inputIds: [fteId, `assumption:loadedMonthlyCostPerFteUsd:${mStr}`]
    };

    // Total Operating Expense
    const totalOpexId: CellId = `calculated:totalOperatingExpense:${mStr}`;
    nodes[totalOpexId] = {
      id: totalOpexId,
      kind: 'calculated',
      label: `Total Operating Expense (${mStr})`,
      period: p,
      value: calc.totalOperatingExpense,
      unit: '$',
      formulaLabel: `Payroll + Other Operating Expense (${mStr})`,
      inputIds: [payrollId, `assumption:otherOperatingExpenseUsd:${mStr}`]
    };

    // EBITDA
    const ebitdaId: CellId = `calculated:ebitda:${mStr}`;
    nodes[ebitdaId] = {
      id: ebitdaId,
      kind: 'calculated',
      label: `EBITDA (${mStr})`,
      period: p,
      value: calc.ebitda,
      unit: '$',
      formulaLabel: `Revenue − Total Operating Expense (${mStr})`,
      inputIds: [revId, totalOpexId]
    };

    // Ending Cash
    const cashId: CellId = `calculated:endingCash:${mStr}`;
    const cashInputs: CellId[] =
      p === 1 ? [startingCashId, ebitdaId] : [`calculated:endingCash:${prevMStr!}`, ebitdaId];

    nodes[cashId] = {
      id: cashId,
      kind: 'calculated',
      label: `Ending Cash (${mStr})`,
      period: p,
      value: calc.endingCash,
      unit: '$',
      formulaLabel:
        p === 1 ? 'Starting Cash + EBITDA M01' : `Ending Cash ${prevMStr} + EBITDA ${mStr}`,
      inputIds: cashInputs
    };
  }

  return { nodes };
}
