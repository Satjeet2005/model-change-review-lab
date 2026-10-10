/**
 * Domain Type Definitions for Model Change Review Lab
 * Pure TypeScript — Zero React or Browser API dependencies (NFR-001)
 */

export type PeriodIndex =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24;

export interface MonthAssumptions {
  period: PeriodIndex;
  revenueGrowthRate: number; // e.g. 0.025 for 2.5%
  engineeringFte: number; // integer
  otherFte: number; // integer
  loadedMonthlyCostPerFteUsd: number;
  otherOperatingExpenseUsd: number;
}

export interface ModelAssumptions {
  startingRevenueUsd: number;
  startingCashUsd: number;
  months: MonthAssumptions[]; // strictly 24 periods
}

export interface MonthCalculated {
  period: PeriodIndex;
  revenue: number;
  totalFte: number;
  payroll: number;
  totalOperatingExpense: number;
  ebitda: number;
  endingCash: number;
}

export interface CalculatedSummary {
  m24Revenue: number;
  m24TotalFte: number;
  m24Payroll: number;
  m24TotalOperatingExpense: number;
  m24Ebitda: number;
  m24EndingCash: number;
  cumulativeRevenue: number;
}

export interface CalculatedModel {
  months: MonthCalculated[];
  summary: CalculatedSummary;
}

export type SettingKey = 'startingRevenueUsd' | 'startingCashUsd';
export type AssumptionRowKey = keyof Omit<MonthAssumptions, 'period'>;
export type CalculatedRowKey = keyof Omit<MonthCalculated, 'period'>;

export type MonthIdString = `M${string}`;

export type CellId =
  | `setting:${SettingKey}`
  | `assumption:${AssumptionRowKey}:${MonthIdString}`
  | `calculated:${CalculatedRowKey}:${MonthIdString}`;

export type TraceNodeKind = 'setting' | 'assumption' | 'calculated';

export interface TraceNode {
  id: CellId;
  kind: TraceNodeKind;
  label: string;
  period: PeriodIndex | null;
  value: number;
  unit: string;
  formulaLabel?: string;
  inputIds: CellId[];
}

export interface TraceIndex {
  nodes: Record<CellId, TraceNode>;
}

export type DisplayUnit = 'usd' | 'fte' | 'percent';

export interface ProposalOperation {
  targetKey: string;
  targetPeriod: PeriodIndex | null;
  targetCellId: CellId;
  previousValue: number;
  proposedValue: number;
  displayUnit: DisplayUnit;
  changeLabel: string;
}

export interface ChangeProposal {
  id: string;
  title: string;
  description: string;
  operations: ProposalOperation[];
  baseRevision: number;
  createdAt: string;
}

export type TransactionKind = 'manual-edit' | 'proposal-accepted';

export interface TransactionRecord {
  id: string;
  timestamp: string;
  kind: TransactionKind;
  description: string;
  affectedCellIds: CellId[];
  previousAssumptions: ModelAssumptions;
  newAssumptions: ModelAssumptions;
  resultingRevision: number;
}

export interface ValidationError {
  targetKey: string;
  targetPeriod: PeriodIndex | null;
  message: string;
  rejectedValue: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface MetricDelta {
  period: PeriodIndex;
  metricKey: CalculatedRowKey;
  baselineValue: number;
  workingValue: number;
  absoluteDelta: number;
  percentageDelta: number | null; // null if baseline is zero
}

export interface ScenarioSummaryComparison {
  cumulativeRevenueBaseline: number;
  cumulativeRevenueWorking: number;
  cumulativeRevenueAbsoluteDelta: number;
  cumulativeRevenuePercentageDelta: number | null;
  m24EndingCashBaseline: number;
  m24EndingCashWorking: number;
  m24EndingCashAbsoluteDelta: number;
  m24EndingCashPercentageDelta: number | null;
}

export interface ScenarioComparison {
  metrics: Record<CalculatedRowKey, MetricDelta[]>;
  summary: ScenarioSummaryComparison;
}
