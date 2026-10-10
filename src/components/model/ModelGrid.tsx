import React, { useState } from 'react';
import { useAppState } from '@/state/AppProvider';
import {
  AssumptionRowKey,
  CalculatedRowKey,
  CellId,
  MonthIdString,
  PeriodIndex
} from '@/domain/types';
import { EditableAssumptionCell } from './EditableAssumptionCell';
import { CalculatedCell } from './CalculatedCell';
import { GridCoordinates, getNextCoordinates, getNextEditableCell } from './gridKeyboard';

interface AssumptionRowDef {
  key: AssumptionRowKey;
  label: string;
  unit: 'usd' | 'percent' | 'fte';
}

interface CalculatedRowDef {
  key: CalculatedRowKey;
  label: string;
  unit: 'usd' | 'fte';
}

const ASSUMPTION_ROWS: AssumptionRowDef[] = [
  { key: 'revenueGrowthRate', label: 'Revenue Growth', unit: 'percent' },
  { key: 'engineeringFte', label: 'Engineering FTE', unit: 'fte' },
  { key: 'otherFte', label: 'Other FTE', unit: 'fte' },
  { key: 'loadedMonthlyCostPerFteUsd', label: 'Cost per FTE ($)', unit: 'usd' },
  { key: 'otherOperatingExpenseUsd', label: 'Other OpEx ($)', unit: 'usd' }
];

const CALCULATED_ROWS: CalculatedRowDef[] = [
  { key: 'revenue', label: 'Revenue ($)', unit: 'usd' },
  { key: 'totalFte', label: 'Total FTE', unit: 'fte' },
  { key: 'payroll', label: 'Payroll ($)', unit: 'usd' },
  { key: 'totalOperatingExpense', label: 'Total OpEx ($)', unit: 'usd' },
  { key: 'ebitda', label: 'EBITDA ($)', unit: 'usd' },
  { key: 'endingCash', label: 'Ending Cash ($)', unit: 'usd' }
];

const QUARTER_HEADERS = [
  { label: 'Y1 Q1', span: 3 },
  { label: 'Y1 Q2', span: 3 },
  { label: 'Y1 Q3', span: 3 },
  { label: 'Y1 Q4', span: 3 },
  { label: 'Y2 Q1', span: 3 },
  { label: 'Y2 Q2', span: 3 },
  { label: 'Y2 Q3', span: 3 },
  { label: 'Y2 Q4', span: 3 }
];

export function ModelGrid(): React.JSX.Element {
  const { workingAssumptions, calculatedWorkingModel } = useAppState();
  const [focusedCell, setFocusedCell] = useState<GridCoordinates | null>(null);

  function handleNavigate(direction: 'up' | 'down' | 'left' | 'right') {
    if (!focusedCell) {
      setFocusedCell({ rowIndex: 0, colIndex: 0 });
      return;
    }
    const next = getNextCoordinates(focusedCell, direction);
    setFocusedCell(next);
  }

  function handleAdvance(shift: boolean) {
    if (!focusedCell) return;
    const next = getNextEditableCell(focusedCell, shift);
    setFocusedCell(next);
  }

  return (
    <div
      className="bg-white border border-neutral-200 rounded-lg shadow-xs overflow-hidden"
      aria-label="Financial Planning Model Grid"
    >
      {/* Scrollable Container with explicit landmark label */}
      <div
        tabIndex={0}
        aria-label="Planning Grid Table, 24 months, horizontally scrollable"
        className="overflow-x-auto max-h-[70vh] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <table
          className="w-full border-collapse text-left border-spacing-0"
          role="grid"
          aria-readonly="false"
        >
          {/* Header */}
          <thead className="sticky top-0 z-20 bg-neutral-100 text-neutral-700 shadow-xs">
            {/* Row 1: Quarters */}
            <tr className="border-b border-neutral-200">
              <th
                scope="col"
                className="sticky left-0 z-30 bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-800 border-r border-neutral-300 w-52 min-w-[200px]"
              >
                Period Horizon
              </th>
              {QUARTER_HEADERS.map((q, idx) => (
                <th
                  key={idx}
                  colSpan={q.span}
                  scope="colgroup"
                  className="px-2 py-1 text-[11px] font-bold text-center border-r border-neutral-200 bg-neutral-200/50 text-neutral-600 uppercase tracking-wider"
                >
                  {q.label}
                </th>
              ))}
            </tr>

            {/* Row 2: Months M01..M24 */}
            <tr className="border-b border-neutral-300 bg-neutral-100">
              <th
                scope="col"
                className="sticky left-0 z-30 bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-800 border-r border-neutral-300"
              >
                Line Item
              </th>
              {Array.from({ length: 24 }, (_, i) => {
                const period = (i + 1) as PeriodIndex;
                const mStr = period < 10 ? `M0${period}` : `M${period}`;
                return (
                  <th
                    key={mStr}
                    scope="col"
                    className="px-2 py-2 text-xs font-mono font-medium text-center border-r border-neutral-200 w-24 min-w-[96px] text-neutral-700"
                  >
                    {mStr}
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {/* Section 1: Assumptions Header */}
            <tr className="bg-neutral-100/70 border-y border-neutral-200">
              <td
                colSpan={25}
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neutral-600 bg-neutral-50"
              >
                Assumption Inputs (Editable)
              </td>
            </tr>

            {/* 5 Assumption Rows */}
            {ASSUMPTION_ROWS.map((def, rIndex) => (
              <tr
                key={def.key}
                className="hover:bg-neutral-50/50 transition-colors border-b border-neutral-100"
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 border-r border-neutral-300 whitespace-nowrap shadow-xs"
                >
                  {def.label}
                </th>
                {Array.from({ length: 24 }, (_, cIndex) => {
                  const period = (cIndex + 1) as PeriodIndex;
                  const mStr: MonthIdString = period < 10 ? `M0${period}` : `M${period}`;
                  const cellId: CellId = `assumption:${def.key}:${mStr}`;
                  const monthData = workingAssumptions.months[cIndex]!;
                  const val = monthData[def.key];
                  const isFocused =
                    focusedCell?.rowIndex === rIndex && focusedCell?.colIndex === cIndex;

                  return (
                    <EditableAssumptionCell
                      key={cellId}
                      cellId={cellId}
                      rowKey={def.key}
                      rowLabel={def.label}
                      period={period}
                      periodLabel={mStr}
                      value={val}
                      displayUnit={def.unit}
                      isFocused={isFocused}
                      onFocus={() => setFocusedCell({ rowIndex: rIndex, colIndex: cIndex })}
                      onNavigate={handleNavigate}
                      onAdvance={handleAdvance}
                    />
                  );
                })}
              </tr>
            ))}

            {/* Section 2: Calculated Header */}
            <tr className="bg-neutral-100/70 border-y border-neutral-200">
              <td
                colSpan={25}
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-neutral-600 bg-neutral-50"
              >
                Calculated Metrics (Read-only · Click cell to inspect trace)
              </td>
            </tr>

            {/* 6 Calculated Rows */}
            {CALCULATED_ROWS.map((def, rIdxOffset) => {
              const rIndex = 5 + rIdxOffset;
              return (
                <tr
                  key={def.key}
                  className="hover:bg-neutral-50/50 transition-colors border-b border-neutral-100"
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 border-r border-neutral-300 whitespace-nowrap shadow-xs"
                  >
                    {def.label}
                  </th>
                  {Array.from({ length: 24 }, (_, cIndex) => {
                    const period = (cIndex + 1) as PeriodIndex;
                    const mStr: MonthIdString = period < 10 ? `M0${period}` : `M${period}`;
                    const cellId: CellId = `calculated:${def.key}:${mStr}`;
                    const monthData = calculatedWorkingModel.months[cIndex]!;
                    const val = monthData[def.key];
                    const isFocused =
                      focusedCell?.rowIndex === rIndex && focusedCell?.colIndex === cIndex;

                    return (
                      <CalculatedCell
                        key={cellId}
                        cellId={cellId}
                        rowKey={def.key}
                        rowLabel={def.label}
                        period={period}
                        periodLabel={mStr}
                        value={val}
                        displayUnit={def.unit}
                        isFocused={isFocused}
                        onFocus={() => setFocusedCell({ rowIndex: rIndex, colIndex: cIndex })}
                        onNavigate={handleNavigate}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
