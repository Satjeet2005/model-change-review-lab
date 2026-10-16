import React, { useState, useEffect, useRef } from 'react';
import { CellId, PeriodIndex } from '@/domain/types';
import { useAppState, useAppDispatch } from '@/state/AppProvider';
import { useAppCommands } from '@/api/useAppCommands';
import {
  formatCurrency,
  formatInteger,
  formatPercentage,
  parseEditableValue
} from '@/domain/formatting';

export interface EditableAssumptionCellProps {
  cellId: CellId;
  rowKey: string;
  rowLabel: string;
  period: PeriodIndex;
  periodLabel: string;
  value: number;
  displayUnit: 'usd' | 'percent' | 'fte';
  isFocused?: boolean;
  onFocus?: () => void;
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onAdvance?: (shift: boolean) => void;
}

export function EditableAssumptionCell({
  cellId,
  rowLabel,
  periodLabel,
  value,
  displayUnit,
  isFocused = false,
  onFocus,
  onNavigate,
  onAdvance
}: EditableAssumptionCellProps): React.JSX.Element {
  const { editingCell, validationError, isMutating } = useAppState();
  const dispatch = useAppDispatch();
  const commands = useAppCommands();

  const isEditing = editingCell === cellId;
  const isCellError = isEditing && Boolean(validationError);

  const [draftValue, setDraftValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Synchronize draft value when entering edit mode
  useEffect(() => {
    if (isEditing) {
      if (displayUnit === 'percent') {
        // e.g. 0.025 -> "2.5%"
        setDraftValue(`${(value * 100).toFixed(1)}%`);
      } else {
        setDraftValue(String(value));
      }
    }
  }, [isEditing, value, displayUnit]);

  // Focus input when entering edit mode, or button when navigable
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (isFocused) {
      buttonRef.current?.focus();
    }
  }, [isEditing, isFocused]);

  function formatDisplay(val: number): string {
    switch (displayUnit) {
      case 'percent':
        return formatPercentage(val);
      case 'usd':
        return formatCurrency(val);
      case 'fte':
        return formatInteger(val);
    }
  }

  function handleStartEdit() {
    if (isMutating) return;
    let initialStr = String(value);
    if (displayUnit === 'percent') {
      initialStr = `${(value * 100).toFixed(1)}%`;
    }
    dispatch({
      type: 'DIRECT_EDIT_START',
      cellId,
      initialValue: initialStr
    });
  }

  async function handleCommit() {
    const isPercent = displayUnit === 'percent';
    const parsed = parseEditableValue(draftValue, isPercent);
    if (Number.isNaN(parsed)) {
      dispatch({
        type: 'DIRECT_EDIT_COMMIT',
        cellId,
        rawValue: draftValue
      });
      return;
    }
    const success = await commands.directEdit(cellId, parsed);
    if (success) {
      dispatch({ type: 'DIRECT_EDIT_CANCEL' });
    }
  }

  function handleCancel() {
    dispatch({ type: 'DIRECT_EDIT_CANCEL' });
  }

  const accessibleName = `${rowLabel} ${periodLabel}`;
  const errorId = `error-${cellId.replace(/[:.]/g, '-')}`;

  if (isEditing) {
    return (
      <td className="p-1 relative border-b border-r border-neutral-200 bg-blue-50/70">
        <div className="flex flex-col">
          <input
            ref={inputRef}
            type="text"
            value={draftValue}
            onChange={(e) => {
              setDraftValue(e.target.value);
              dispatch({ type: 'DIRECT_EDIT_CHANGE', value: e.target.value });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCommit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
              } else if (e.key === 'Tab') {
                e.preventDefault();
                handleCommit();
                onAdvance?.(e.shiftKey);
              }
            }}
            onBlur={() => {
              // Auto-commit on blur if no error was raised, or cancel
              if (!isCellError) {
                handleCommit();
              }
            }}
            aria-label={accessibleName}
            aria-invalid={isCellError ? 'true' : undefined}
            aria-describedby={isCellError ? errorId : undefined}
            className={`w-full px-1.5 py-1 text-xs font-mono text-right bg-white rounded border ${
              isCellError
                ? 'border-red-500 ring-2 ring-red-400 focus:outline-none'
                : 'border-blue-500 ring-2 ring-blue-400 focus:outline-none'
            }`}
          />
          {isCellError && (
            <div
              id={errorId}
              role="alert"
              className="absolute left-0 top-full mt-1 z-20 w-48 p-1.5 bg-red-50 border border-red-300 rounded shadow-md text-[11px] text-red-700 leading-tight"
            >
              <span className="font-semibold">Error:</span> {validationError}
            </div>
          )}
        </div>
      </td>
    );
  }

  return (
    <td className="p-0 border-b border-r border-neutral-200 bg-blue-50/30 hover:bg-blue-50 transition-colors">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleStartEdit}
        onDoubleClick={handleStartEdit}
        onFocus={onFocus}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleStartEdit();
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
        aria-label={`${accessibleName}: ${formatDisplay(value)}`}
        className="w-full h-9 px-2 text-xs font-mono tabular-nums text-right text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:z-10 cursor-pointer select-none"
      >
        {formatDisplay(value)}
      </button>
    </td>
  );
}
