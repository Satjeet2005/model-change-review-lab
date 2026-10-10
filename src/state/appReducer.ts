import { AppState, NavTabId } from './appState';
import { CellId, PeriodIndex, ProposalOperation } from '@/domain/types';
import { buildTraceIndex } from '@/domain/trace';
import { commitTransaction } from '@/domain/transactions';
import { validateAssumptionValue } from '@/domain/validation';
import { parseEditableValue } from '@/domain/formatting';

export type AppAction =
  | { type: 'DIRECT_EDIT_START'; cellId: CellId; initialValue: string }
  | { type: 'DIRECT_EDIT_CHANGE'; value: string }
  | { type: 'DIRECT_EDIT_CANCEL' }
  | { type: 'DIRECT_EDIT_COMMIT'; cellId: CellId; rawValue: number | string }
  | { type: 'SET_SELECTED_TRACE_CELL'; cellId: CellId | null }
  | { type: 'SET_ACTIVE_TAB'; tab: NavTabId };

interface ParsedTarget {
  targetKey: string;
  targetPeriod: PeriodIndex | null;
  previousValue: number;
  displayUnit: 'usd' | 'percent' | 'fte';
}

function parseCellTarget(cellId: CellId, state: AppState): ParsedTarget | null {
  if (cellId === 'setting:startingRevenueUsd') {
    return {
      targetKey: 'startingRevenueUsd',
      targetPeriod: null,
      previousValue: state.workingAssumptions.startingRevenueUsd,
      displayUnit: 'usd'
    };
  }

  if (cellId === 'setting:startingCashUsd') {
    return {
      targetKey: 'startingCashUsd',
      targetPeriod: null,
      previousValue: state.workingAssumptions.startingCashUsd,
      displayUnit: 'usd'
    };
  }

  const parts = cellId.split(':');
  if (parts.length === 3 && parts[0] === 'assumption') {
    const targetKey = parts[1]!;
    const periodStr = parts[2]!; // e.g. "M01", "M12"
    const periodNum = parseInt(periodStr.replace('M', ''), 10);
    if (periodNum >= 1 && periodNum <= 24) {
      const targetPeriod = periodNum as PeriodIndex;
      const monthObj = state.workingAssumptions.months[targetPeriod - 1];
      if (monthObj && targetKey in monthObj) {
        const previousValue = (monthObj as unknown as Record<string, number>)[targetKey] ?? 0;
        let displayUnit: 'usd' | 'percent' | 'fte' = 'usd';
        if (targetKey === 'revenueGrowthRate') displayUnit = 'percent';
        else if (targetKey === 'engineeringFte' || targetKey === 'otherFte') displayUnit = 'fte';

        return {
          targetKey,
          targetPeriod,
          previousValue,
          displayUnit
        };
      }
    }
  }

  return null;
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'DIRECT_EDIT_START':
      return {
        ...state,
        editingCell: action.cellId,
        editingValue: action.initialValue,
        validationError: null
      };

    case 'DIRECT_EDIT_CHANGE':
      return {
        ...state,
        editingValue: action.value,
        validationError: null
      };

    case 'DIRECT_EDIT_CANCEL':
      return {
        ...state,
        editingCell: null,
        editingValue: '',
        validationError: null
      };

    case 'DIRECT_EDIT_COMMIT': {
      const target = parseCellTarget(action.cellId, state);
      if (!target) {
        return {
          ...state,
          validationError: `Unknown target cell: ${action.cellId}`
        };
      }

      // 1. Parse numeric value
      let parsedValue: number;
      if (typeof action.rawValue === 'number') {
        parsedValue = action.rawValue;
      } else {
        const isPercent = target.displayUnit === 'percent';
        parsedValue = parseEditableValue(action.rawValue, isPercent);
      }

      if (Number.isNaN(parsedValue) || !Number.isFinite(parsedValue)) {
        return {
          ...state,
          validationError: 'Please enter a valid numeric value'
        };
      }

      // 2. Validate value against PRD domain rules
      const valError = validateAssumptionValue(target.targetKey, parsedValue, target.targetPeriod);

      if (valError) {
        return {
          ...state,
          validationError: valError.message
        };
      }

      // 3. Construct single operation and commit transaction
      const operation: ProposalOperation = {
        targetKey: target.targetKey,
        targetPeriod: target.targetPeriod,
        targetCellId: action.cellId,
        previousValue: target.previousValue,
        proposedValue: parsedValue,
        displayUnit: target.displayUnit,
        changeLabel: `Manual edit: ${target.targetKey}`
      };

      try {
        const { transaction, newAssumptions, calculatedModel } = commitTransaction(
          state.workingAssumptions,
          [operation],
          'manual-edit',
          `Manual edit to ${action.cellId}`,
          state.revision
        );

        const newTraceIndex = buildTraceIndex(newAssumptions, calculatedModel);

        return {
          ...state,
          workingAssumptions: newAssumptions,
          calculatedWorkingModel: calculatedModel,
          traceIndex: newTraceIndex,
          revision: transaction.resultingRevision,
          changeHistory: [transaction, ...state.changeHistory],
          editingCell: null,
          editingValue: '',
          validationError: null
        };
      } catch (err) {
        return {
          ...state,
          validationError: err instanceof Error ? err.message : 'Transaction failed'
        };
      }
    }

    case 'SET_SELECTED_TRACE_CELL':
      return {
        ...state,
        selectedTraceCellId: action.cellId
      };

    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTab: action.tab
      };

    default:
      return state;
  }
}
