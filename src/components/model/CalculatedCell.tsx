import React, { useRef, useEffect } from 'react';
import { CellId, PeriodIndex } from '@/domain/types';
import { useAppState, useAppDispatch } from '@/state/AppProvider';
import { formatCurrency, formatInteger } from '@/domain/formatting';

export interface CalculatedCellProps {
  cellId: CellId;
  rowKey: string;
  rowLabel: string;
  period: PeriodIndex;
  periodLabel: string;
  value: number;
  displayUnit: 'usd' | 'fte';
  isFocused?: boolean;
  onFocus?: () => void;
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

export function CalculatedCell({
  cellId,
  rowLabel,
  periodLabel,
  value,
  displayUnit,
  isFocused = false,
  onFocus,
  onNavigate
}: CalculatedCellProps): React.JSX.Element {
  const { selectedTraceCellId } = useAppState();
  const dispatch = useAppDispatch();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isSelectedForTrace = selectedTraceCellId === cellId;
  const isNegative = value < 0;

  useEffect(() => {
    if (isFocused) {
      buttonRef.current?.focus();
    }
  }, [isFocused]);

  function formatDisplay(val: number): string {
    if (displayUnit === 'fte') {
      return formatInteger(val);
    }
    return formatCurrency(val);
  }

  function handleSelect() {
    dispatch({
      type: 'SET_SELECTED_TRACE_CELL',
      cellId
    });
  }

  const accessibleName = `${rowLabel} ${periodLabel}`;

  return (
    <td
      className={`p-0 border-b border-r border-neutral-200 transition-colors ${
        isSelectedForTrace ? 'bg-blue-100 ring-1 ring-blue-400' : 'bg-white hover:bg-neutral-50'
      }`}
      role="gridcell"
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={handleSelect}
        onFocus={onFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSelect();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            onNavigate?.('up');
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            onNavigate?.('down');
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onNavigate?.('left');
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            onNavigate?.('right');
          }
        }}
        aria-label={`${accessibleName}: ${formatDisplay(value)}${
          isSelectedForTrace ? ' (selected for trace)' : ''
        }`}
        title={`Click to inspect calculation trace for ${rowLabel} (${periodLabel})`}
        className={`w-full h-9 px-2 text-xs font-mono tabular-nums text-right cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:z-10 ${
          isNegative ? 'text-red-600 font-semibold' : 'text-neutral-900 font-medium'
        }`}
      >
        {formatDisplay(value)}
      </button>
    </td>
  );
}
