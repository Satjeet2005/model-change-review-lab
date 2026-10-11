import React, { useState } from 'react';
import { ProposalOperation } from '@/domain/types';
import {
  formatCurrency,
  formatPercentage,
  formatInteger,
  formatDelta,
  parseEditableValue
} from '@/domain/formatting';
import { validateAssumptionValue } from '@/domain/validation';
import { Button } from '@/components/ui/Button';

export interface ProposalDiffProps {
  operations: readonly ProposalOperation[];
  onEditOperation?: (
    targetCellId: ProposalOperation['targetCellId'],
    proposedValue: number
  ) => void;
  readOnly?: boolean;
}

export function ProposalDiff({
  operations,
  onEditOperation,
  readOnly = false
}: ProposalDiffProps): React.JSX.Element {
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);

  function formatValue(val: number, unit: ProposalOperation['displayUnit']): string {
    if (unit === 'usd') return formatCurrency(val);
    if (unit === 'percent') return formatPercentage(val);
    if (unit === 'fte') return formatInteger(val);
    return String(val);
  }

  function formatOperationDelta(deltaVal: number, unit: ProposalOperation['displayUnit']): string {
    if (unit === 'usd') return formatDelta(deltaVal, 'currency');
    if (unit === 'percent') return formatDelta(deltaVal, 'percent');
    if (unit === 'fte') return formatDelta(deltaVal, 'integer');
    return formatDelta(deltaVal, 'integer');
  }

  function handleStartEdit(op: ProposalOperation) {
    if (readOnly || !onEditOperation) return;
    setEditingCellId(op.targetCellId);
    if (op.displayUnit === 'percent') {
      setEditInput(`${(op.proposedValue * 100).toFixed(1)}%`);
    } else {
      setEditInput(String(op.proposedValue));
    }
    setEditError(null);
  }

  function handleSaveEdit(op: ProposalOperation) {
    const isPercent = op.displayUnit === 'percent';
    const parsed = parseEditableValue(editInput, isPercent);

    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      setEditError('Enter a valid number');
      return;
    }

    const valErr = validateAssumptionValue(op.targetKey, parsed, op.targetPeriod);
    if (valErr) {
      setEditError(valErr.message);
      return;
    }

    onEditOperation?.(op.targetCellId, parsed);
    setEditingCellId(null);
    setEditError(null);
  }

  function handleCancelEdit() {
    setEditingCellId(null);
    setEditError(null);
  }

  // Range grouping summary: e.g. "M07–M24 (18 months)"
  const firstOp = operations[0];
  const lastOp = operations[operations.length - 1];
  const rangeSummary =
    operations.length > 1 && firstOp?.targetPeriod && lastOp?.targetPeriod
      ? `M${firstOp.targetPeriod < 10 ? '0' + firstOp.targetPeriod : firstOp.targetPeriod}–M${
          lastOp.targetPeriod < 10 ? '0' + lastOp.targetPeriod : lastOp.targetPeriod
        } (${operations.length} periods)`
      : `${operations.length} operations`;

  // Display limited rows by default when range is long, but allow expanding to see all individual operations
  const visibleOperations = expanded ? operations : operations.slice(0, 6);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
          Proposed Modifications ({rangeSummary})
        </span>
        {operations.length > 6 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 cursor-pointer underline"
          >
            {expanded ? 'Collapse to summary' : `Inspect all ${operations.length} values`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto border border-neutral-200 rounded-md bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-700">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">
                Period
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Target Assumption
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-right">
                Current (Working)
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-right">
                Proposed
              </th>
              <th scope="col" className="px-3 py-2 font-semibold text-right">
                Delta
              </th>
              {!readOnly && onEditOperation && (
                <th scope="col" className="px-3 py-2 font-semibold text-center w-24">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {visibleOperations.map((op) => {
              const isEditing = editingCellId === op.targetCellId;
              const delta = op.proposedValue - op.previousValue;
              const periodLabel = op.targetPeriod
                ? `M${op.targetPeriod < 10 ? '0' + op.targetPeriod : op.targetPeriod}`
                : 'Model Setting';

              return (
                <tr key={op.targetCellId} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="px-3 py-2 font-mono font-medium text-neutral-800">
                    {periodLabel}
                  </td>
                  <td className="px-3 py-2 text-neutral-700">{op.changeLabel}</td>
                  <td className="px-3 py-2 font-mono tabular-nums text-right text-neutral-600">
                    {formatValue(op.previousValue, op.displayUnit)}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-right text-neutral-900 font-semibold">
                    {isEditing ? (
                      <div className="flex flex-col items-end gap-1">
                        <input
                          type="text"
                          value={editInput}
                          onChange={(e) => setEditInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(op);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="w-24 px-1.5 py-0.5 text-xs font-mono text-right border border-blue-500 rounded focus:ring-1 focus:ring-blue-400"
                          autoFocus
                        />
                        {editError && <span className="text-[10px] text-red-600">{editError}</span>}
                      </div>
                    ) : (
                      formatValue(op.proposedValue, op.displayUnit)
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-right font-medium">
                    <span
                      className={
                        delta > 0
                          ? 'text-green-700'
                          : delta < 0
                            ? 'text-red-700'
                            : 'text-neutral-500'
                      }
                    >
                      {formatOperationDelta(delta, op.displayUnit)}
                    </span>
                  </td>
                  {!readOnly && onEditOperation && (
                    <td className="px-3 py-2 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => handleSaveEdit(op)}
                          >
                            Done
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => handleStartEdit(op)}
                        >
                          Edit
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!expanded && operations.length > 6 && (
        <p className="text-[11px] text-neutral-500 italic">
          Showing 6 of {operations.length} operations. Click &ldquo;Inspect all&rdquo; to view and
          edit every monthly value.
        </p>
      )}
    </div>
  );
}
