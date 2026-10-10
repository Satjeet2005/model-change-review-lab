import { AppState, NavTabId } from './appState';
import { CellId, ChangeProposal, PeriodIndex, ProposalOperation } from '@/domain/types';
import { buildTraceIndex } from '@/domain/trace';
import { commitTransaction } from '@/domain/transactions';
import { calculateModel } from '@/domain/calculation';
import { cloneModelAssumptions } from '@/domain/operations';
import { validateAssumptionValue, validateOperationSet } from '@/domain/validation';
import { parseEditableValue } from '@/domain/formatting';

export type AppAction =
  | { type: 'DIRECT_EDIT_START'; cellId: CellId; initialValue: string }
  | { type: 'DIRECT_EDIT_CHANGE'; value: string }
  | { type: 'DIRECT_EDIT_CANCEL' }
  | { type: 'DIRECT_EDIT_COMMIT'; cellId: CellId; rawValue: number | string }
  | { type: 'SET_SELECTED_TRACE_CELL'; cellId: CellId | null }
  | { type: 'SET_ACTIVE_TAB'; tab: NavTabId }
  | { type: 'PROPOSAL_GENERATE_START' }
  | { type: 'PROPOSAL_GENERATE_SUCCESS'; proposal: ChangeProposal }
  | { type: 'PROPOSAL_GENERATE_ERROR'; error: string }
  | { type: 'PROPOSAL_EDIT_OPERATION'; targetCellId: CellId; proposedValue: number }
  | { type: 'PROPOSAL_ACCEPT' }
  | { type: 'PROPOSAL_REJECT' }
  | { type: 'PROPOSAL_DISMISS' }
  | { type: 'UNDO_LAST_TRANSACTION' }
  | { type: 'RESET_TO_BASELINE' };

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

    case 'PROPOSAL_GENERATE_START':
      return {
        ...state,
        proposalStatus: 'generating',
        proposalError: null
      };

    case 'PROPOSAL_GENERATE_SUCCESS':
      return {
        ...state,
        pendingProposal: action.proposal,
        proposalStatus: 'review',
        proposalError: null
      };

    case 'PROPOSAL_GENERATE_ERROR':
      return {
        ...state,
        proposalStatus: 'error',
        proposalError: action.error
      };

    case 'PROPOSAL_EDIT_OPERATION': {
      if (!state.pendingProposal) return state;

      const updatedOperations = state.pendingProposal.operations.map((op) => {
        if (op.targetCellId === action.targetCellId) {
          return {
            ...op,
            proposedValue: action.proposedValue
          };
        }
        return op;
      });

      return {
        ...state,
        pendingProposal: {
          ...state.pendingProposal,
          operations: updatedOperations
        }
      };
    }

    case 'PROPOSAL_ACCEPT': {
      if (!state.pendingProposal) return state;

      // 1. Revision / Stale guard (PRD §6.8, §6.9, §14): Base revision must strictly match current revision
      if (state.pendingProposal.baseRevision !== state.revision) {
        return {
          ...state,
          proposalError: `Cannot accept stale proposal: generated against revision ${state.pendingProposal.baseRevision}, but model is at revision ${state.revision}.`
        };
      }

      // 2. Prevent duplicate acceptance if already committed
      if (state.proposalStatus === 'accepted') {
        return state;
      }

      // 3. Atomically validate complete operation set before commit
      const opValidation = validateOperationSet(state.pendingProposal.operations);
      if (!opValidation.valid) {
        const errorMessages = opValidation.errors.map((e) => e.message).join('; ');
        return {
          ...state,
          proposalError: `Cannot accept invalid proposal: ${errorMessages}`
        };
      }

      // 4. Commit atomic transaction using domain engine
      try {
        const { transaction, newAssumptions, calculatedModel } = commitTransaction(
          state.workingAssumptions,
          state.pendingProposal.operations,
          'proposal-accepted',
          `Accepted proposal: ${state.pendingProposal.title}`,
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
          proposalStatus: 'accepted',
          proposalError: null
        };
      } catch (err) {
        return {
          ...state,
          proposalError: err instanceof Error ? err.message : 'Failed to commit proposal'
        };
      }
    }

    case 'PROPOSAL_REJECT':
      // PRD §7.5 & §16.3: Discard proposal draft; canonical state is completely untouched
      return {
        ...state,
        pendingProposal: null,
        proposalStatus: 'rejected',
        proposalError: null
      };

    case 'PROPOSAL_DISMISS':
      return {
        ...state,
        pendingProposal: null,
        proposalStatus: 'idle',
        proposalError: null
      };

    case 'UNDO_LAST_TRANSACTION': {
      // 1. If history is empty, undo is a no-op
      if (state.changeHistory.length === 0) {
        return state;
      }

      // 2. Pop the latest transaction
      const [latestTx, ...remainingHistory] = state.changeHistory;
      if (!latestTx) {
        return state;
      }

      // 3. Restore previous assumptions from snapshot (deep clone to prevent reference aliasing)
      const restoredAssumptions = cloneModelAssumptions(latestTx.previousAssumptions);

      // 4. Recalculate derived outputs through canonical calculation engine
      const recalculatedModel = calculateModel(restoredAssumptions);

      // 5. Rebuild trace index with synchronized outputs
      const refreshedTraceIndex = buildTraceIndex(restoredAssumptions, recalculatedModel);

      // 6. Monotonically increment revision token to ensure stale proposal safety (PRD §6.8, §8.5, T-064)
      const nextRevision = state.revision + 1;

      return {
        ...state,
        workingAssumptions: restoredAssumptions,
        calculatedWorkingModel: recalculatedModel,
        traceIndex: refreshedTraceIndex,
        revision: nextRevision,
        changeHistory: remainingHistory,
        editingCell: null,
        editingValue: '',
        validationError: null
      };
    }

    case 'RESET_TO_BASELINE': {
      // 1. Restore working assumptions from immutable baseline (deep clone)
      const restoredAssumptions = cloneModelAssumptions(state.baselineAssumptions);

      // 2. Recompute through pure calculation engine
      const recalculatedModel = calculateModel(restoredAssumptions);

      // 3. Rebuild trace index for freshly reset scenario
      const refreshedTraceIndex = buildTraceIndex(restoredAssumptions, recalculatedModel);

      // 4. Monotonically increment revision token (PRD §6.8, §8.5, T-064)
      const nextRevision = state.revision + 1;

      return {
        ...state,
        workingAssumptions: restoredAssumptions,
        calculatedWorkingModel: recalculatedModel,
        traceIndex: refreshedTraceIndex,
        revision: nextRevision,
        changeHistory: [],
        pendingProposal: null,
        proposalStatus: 'idle',
        proposalError: null,
        editingCell: null,
        editingValue: '',
        validationError: null,
        selectedTraceCellId: null
      };
    }

    default:
      return state;
  }
}
