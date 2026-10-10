import { CellId, PeriodIndex } from '@/domain/types';

export interface GridCoordinates {
  rowIndex: number; // 0..10
  colIndex: number; // 0..23 (M01..M24)
}

export const TOTAL_GRID_ROWS = 11;
export const TOTAL_GRID_COLS = 24;
export const ASSUMPTION_ROW_COUNT = 5;

export const ROW_KEYS = [
  'revenueGrowthRate',
  'engineeringFte',
  'otherFte',
  'loadedMonthlyCostPerFteUsd',
  'otherOperatingExpenseUsd',
  'revenue',
  'totalFte',
  'payroll',
  'totalOperatingExpense',
  'ebitda',
  'endingCash'
] as const;

export type RowKey = (typeof ROW_KEYS)[number];

export function getCellIdForCoords(rowIndex: number, colIndex: number): CellId {
  const period = (colIndex + 1) as PeriodIndex;
  const mStr = period < 10 ? `M0${period}` : `M${period}`;
  const key = ROW_KEYS[rowIndex]!;

  if (rowIndex < ASSUMPTION_ROW_COUNT) {
    return `assumption:${key}:${mStr}` as CellId;
  }
  return `calculated:${key}:${mStr}` as CellId;
}

export function getNextCoordinates(
  current: GridCoordinates,
  direction: 'up' | 'down' | 'left' | 'right'
): GridCoordinates {
  let { rowIndex, colIndex } = current;

  switch (direction) {
    case 'up':
      if (rowIndex > 0) rowIndex--;
      break;
    case 'down':
      if (rowIndex < TOTAL_GRID_ROWS - 1) rowIndex++;
      break;
    case 'left':
      if (colIndex > 0) colIndex--;
      break;
    case 'right':
      if (colIndex < TOTAL_GRID_COLS - 1) colIndex++;
      break;
  }

  return { rowIndex, colIndex };
}

/**
 * Returns the next editable assumption cell coordinates for Tab navigation.
 * Tab advances through editable rows (0..4) and cycles or advances period.
 */
export function getNextEditableCell(
  current: GridCoordinates,
  shift: boolean = false
): GridCoordinates {
  let { rowIndex, colIndex } = current;

  if (shift) {
    // Shift+Tab: backward
    if (rowIndex > 0) {
      rowIndex--;
    } else {
      rowIndex = ASSUMPTION_ROW_COUNT - 1;
      colIndex = colIndex > 0 ? colIndex - 1 : TOTAL_GRID_COLS - 1;
    }
  } else {
    // Tab: forward
    if (rowIndex < ASSUMPTION_ROW_COUNT - 1) {
      rowIndex++;
    } else {
      rowIndex = 0;
      colIndex = colIndex < TOTAL_GRID_COLS - 1 ? colIndex + 1 : 0;
    }
  }

  return { rowIndex, colIndex };
}
