import React, { useState } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppProvider';
import { useAppCommands } from '@/api/useAppCommands';
import { formatCurrency, parseEditableValue } from '@/domain/formatting';
import { Button } from '@/components/ui/Button';

export function ModelSettings(): React.JSX.Element {
  const { workingAssumptions, baselineAssumptions, editingCell, validationError } = useAppState();
  const dispatch = useAppDispatch();
  const commands = useAppCommands();

  const [revInput, setRevInput] = useState<string>(String(workingAssumptions.startingRevenueUsd));
  const [cashInput, setCashInput] = useState<string>(String(workingAssumptions.startingCashUsd));

  const isEditingRev = editingCell === 'setting:startingRevenueUsd';
  const isEditingCash = editingCell === 'setting:startingCashUsd';

  const revError = isEditingRev ? validationError : null;
  const cashError = isEditingCash ? validationError : null;

  function handleStartRev() {
    setRevInput(String(workingAssumptions.startingRevenueUsd));
    dispatch({
      type: 'DIRECT_EDIT_START',
      cellId: 'setting:startingRevenueUsd',
      initialValue: String(workingAssumptions.startingRevenueUsd)
    });
  }

  async function handleCommitRev() {
    const val = parseEditableValue(revInput, false);
    if (Number.isNaN(val)) {
      dispatch({
        type: 'DIRECT_EDIT_COMMIT',
        cellId: 'setting:startingRevenueUsd',
        rawValue: revInput
      });
      return;
    }
    const success = await commands.directEdit('setting:startingRevenueUsd', val);
    if (success) {
      dispatch({ type: 'DIRECT_EDIT_CANCEL' });
    }
  }

  function handleStartCash() {
    setCashInput(String(workingAssumptions.startingCashUsd));
    dispatch({
      type: 'DIRECT_EDIT_START',
      cellId: 'setting:startingCashUsd',
      initialValue: String(workingAssumptions.startingCashUsd)
    });
  }

  async function handleCommitCash() {
    const val = parseEditableValue(cashInput, false);
    if (Number.isNaN(val)) {
      dispatch({
        type: 'DIRECT_EDIT_COMMIT',
        cellId: 'setting:startingCashUsd',
        rawValue: cashInput
      });
      return;
    }
    const success = await commands.directEdit('setting:startingCashUsd', val);
    if (success) {
      dispatch({ type: 'DIRECT_EDIT_CANCEL' });
    }
  }

  function handleCancel() {
    dispatch({ type: 'DIRECT_EDIT_CANCEL' });
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-xs mb-6">
      <div className="flex items-center justify-between mb-3 border-b border-neutral-100 pb-2">
        <h2 className="text-sm font-semibold text-neutral-800 tracking-wide uppercase">
          Model Baseline Settings
        </h2>
        <span className="text-xs text-neutral-500">Horizon: M01–M24 · Monthly increments</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Starting Revenue */}
        <div className="p-3 bg-neutral-50 rounded-md border border-neutral-200">
          <div className="flex justify-between items-start mb-1">
            <label
              htmlFor="starting-revenue-input"
              className="text-xs font-medium text-neutral-700"
            >
              Starting Revenue (USD)
            </label>
            <span className="text-[11px] text-neutral-500">
              Baseline: {formatCurrency(baselineAssumptions.startingRevenueUsd)}
            </span>
          </div>

          {isEditingRev ? (
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex items-center gap-2">
                <input
                  id="starting-revenue-input"
                  type="text"
                  value={revInput}
                  onChange={(e) => setRevInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitRev();
                    if (e.key === 'Escape') handleCancel();
                  }}
                  aria-invalid={revError ? 'true' : undefined}
                  aria-describedby={revError ? 'rev-error-msg' : undefined}
                  className="flex-1 px-2 py-1 text-sm font-mono bg-white border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                  autoFocus
                />
                <Button size="sm" onClick={handleCommitRev}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
              {revError && (
                <p id="rev-error-msg" role="alert" className="text-xs text-red-600 font-medium">
                  {revError}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between mt-1">
              <span className="text-base font-semibold font-mono tabular-nums text-neutral-900">
                {formatCurrency(workingAssumptions.startingRevenueUsd)}
              </span>
              <Button size="sm" variant="outline" onClick={handleStartRev}>
                Edit
              </Button>
            </div>
          )}
        </div>

        {/* Starting Cash */}
        <div className="p-3 bg-neutral-50 rounded-md border border-neutral-200">
          <div className="flex justify-between items-start mb-1">
            <label htmlFor="starting-cash-input" className="text-xs font-medium text-neutral-700">
              Starting Cash (USD)
            </label>
            <span className="text-[11px] text-neutral-500">
              Baseline: {formatCurrency(baselineAssumptions.startingCashUsd)}
            </span>
          </div>

          {isEditingCash ? (
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex items-center gap-2">
                <input
                  id="starting-cash-input"
                  type="text"
                  value={cashInput}
                  onChange={(e) => setCashInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCommitCash();
                    if (e.key === 'Escape') handleCancel();
                  }}
                  aria-invalid={cashError ? 'true' : undefined}
                  aria-describedby={cashError ? 'cash-error-msg' : undefined}
                  className="flex-1 px-2 py-1 text-sm font-mono bg-white border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                  autoFocus
                />
                <Button size="sm" onClick={handleCommitCash}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
              {cashError && (
                <p id="cash-error-msg" role="alert" className="text-xs text-red-600 font-medium">
                  {cashError}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between mt-1">
              <span className="text-base font-semibold font-mono tabular-nums text-neutral-900">
                {formatCurrency(workingAssumptions.startingCashUsd)}
              </span>
              <Button size="sm" variant="outline" onClick={handleStartCash}>
                Edit
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
