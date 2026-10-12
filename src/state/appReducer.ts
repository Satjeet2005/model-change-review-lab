import { AppState, NavTabId } from './appState';
import {
  CellId,
  ChangeProposal,
  PeriodIndex,
  ProposalOperation,
  ProposalTemplateId,
  ProposalVariant,
  ProposalWorkspace,
  ReadonlyModelAssumptions,
  TransactionProvenance
} from '@/domain/types';
import { buildTraceIndex } from '@/domain/trace';
import { commitTransaction } from '@/domain/transactions';
import { calculateModel } from '@/domain/calculation';
import { cloneModelAssumptions, cloneProposalOperations } from '@/domain/operations';
import { validateAssumptionValue, validateProposalAcceptance } from '@/domain/validation';
import { parseEditableValue } from '@/domain/formatting';

export type AppAction =
  | { type: 'DIRECT_EDIT_START'; cellId: CellId; initialValue: string }
  | { type: 'DIRECT_EDIT_CHANGE'; value: string }
  | { type: 'DIRECT_EDIT_CANCEL' }
  | { type: 'DIRECT_EDIT_COMMIT'; cellId: CellId; rawValue: number | string }
  | { type: 'SET_SELECTED_TRACE_CELL'; cellId: CellId | null }
  | { type: 'SET_ACTIVE_TAB'; tab: NavTabId }
  | {
      type: 'PROPOSAL_GENERATE_START';
      requestId: string;
      requestRevision?: number;
      requestAssumptions?: ReadonlyModelAssumptions;
    }
  | {
      type: 'PROPOSAL_GENERATE_SUCCESS';
      requestId: string;
      workspace?: ProposalWorkspace;
      proposal?: ChangeProposal;
    }
  | {
      type: 'PROPOSAL_GENERATE_ERROR';
      requestId: string;
      error: string;
    }
  | {
      type: 'PROPOSAL_GENERATE_CANCEL';
      requestId: string;
    }
  | { type: 'WORKSPACE_SELECT_VARIANT'; variantId: string }
  | {
      type: 'WORKSPACE_DUPLICATE_VARIANT';
      sourceVariantId: string;
      newVariantId: string;
      newLabel: string;
      createdAt: string;
    }
  | { type: 'WORKSPACE_REMOVE_VARIANT'; variantId: string }
  | { type: 'WORKSPACE_RESET_VARIANT_EDITS'; variantId: string }
  | {
      type: 'WORKSPACE_EDIT_OPERATION';
      variantId: string;
      targetCellId: CellId;
      proposedValue: number;
    }
  | { type: 'WORKSPACE_SET_COMPARISON_VARIANTS'; variantIds: readonly [string, string?] }
  | { type: 'WORKSPACE_ARCHIVE_STALE' }
  | { type: 'WORKSPACE_DISMISS_STALE' }
  | { type: 'PROPOSAL_EDIT_OPERATION'; targetCellId: CellId; proposedValue: number }
  | { type: 'PROPOSAL_ACCEPT' }
  | { type: 'PROPOSAL_REJECT' }
  | { type: 'PROPOSAL_DISMISS' }
  | { type: 'UNDO_LAST_TRANSACTION' }
  | { type: 'RESET_TO_BASELINE' };

export function getNextVariantLabel(variants: readonly { label: string }[]): string {
  const existingLabels = new Set(variants.map((v) => v.label));
  let nextNum = 2;
  while (existingLabels.has(`Variant ${nextNum}`)) {
    nextNum++;
  }
  return `Variant ${nextNum}`;
}

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

    case 'PROPOSAL_GENERATE_START': {
      // Fix 1: Protect active workspace from silent replacement
      if (state.proposalWorkspace !== null || state.pendingProposal !== null) {
        return {
          ...state,
          proposalError: 'Cannot generate new proposal while a proposal workspace is already active'
        };
      }

      if (!action.requestId) {
        return state;
      }

      return {
        ...state,
        proposalStatus: 'generating',
        proposalError: null,
        activeGenerationRequestId: action.requestId
      };
    }

    case 'PROPOSAL_GENERATE_SUCCESS': {
      // Fix 2: Strict async race correlation: ignore if request IDs don't match active request
      if (
        !state.activeGenerationRequestId ||
        !action.requestId ||
        action.requestId !== state.activeGenerationRequestId
      ) {
        return state;
      }

      let workspace: ProposalWorkspace;
      let legacyProposal: ChangeProposal | null = null;

      if (action.workspace) {
        workspace = action.workspace;
        const selectedVar =
          workspace.variants.find((v) => v.id === workspace.selectedVariantId) ??
          workspace.variants[0];
        legacyProposal = {
          id: workspace.id,
          title: workspace.title,
          description: workspace.description,
          operations: selectedVar ? cloneProposalOperations(selectedVar.operations) : [],
          baseRevision: workspace.baseRevision,
          createdAt: workspace.createdAt
        };
      } else if (action.proposal) {
        legacyProposal = action.proposal;
        const variantId = `var-orig-${action.proposal.id}`;
        const ops = cloneProposalOperations(action.proposal.operations);
        const variant: ProposalVariant = {
          id: variantId,
          label: 'Original proposal',
          sourceTemplateId: (action.proposal.id as ProposalTemplateId) || 'hire-engineers-from-q3',
          operations: ops,
          resetSnapshotOperations: cloneProposalOperations(ops),
          createdAt: action.proposal.createdAt
        };
        workspace = {
          id: `ws-${action.proposal.id}`,
          baseRevision: action.proposal.baseRevision,
          baseAssumptions: cloneModelAssumptions(state.workingAssumptions),
          sourceTemplateId: (action.proposal.id as ProposalTemplateId) || 'hire-engineers-from-q3',
          title: action.proposal.title,
          description: action.proposal.description,
          variants: [variant],
          selectedVariantId: variant.id,
          comparisonVariantIds: [variant.id],
          createdAt: action.proposal.createdAt
        };
      } else {
        return state;
      }

      return {
        ...state,
        proposalWorkspace: workspace,
        pendingProposal: legacyProposal,
        proposalStatus: 'review',
        proposalError: null,
        activeGenerationRequestId: null
      };
    }

    case 'PROPOSAL_GENERATE_ERROR': {
      // Fix 2: Strict async race correlation: ignore error if requestId doesn't match active request
      if (
        !state.activeGenerationRequestId ||
        !action.requestId ||
        action.requestId !== state.activeGenerationRequestId
      ) {
        return state;
      }

      return {
        ...state,
        proposalStatus: 'error',
        proposalError: action.error,
        activeGenerationRequestId: null
      };
    }

    case 'PROPOSAL_GENERATE_CANCEL': {
      // Correlate cancellation with active generation request
      if (
        !state.activeGenerationRequestId ||
        !action.requestId ||
        action.requestId !== state.activeGenerationRequestId
      ) {
        return state;
      }
      return {
        ...state,
        proposalStatus: 'idle',
        proposalError: null,
        activeGenerationRequestId: null
      };
    }

    case 'WORKSPACE_SELECT_VARIANT': {
      if (!state.proposalWorkspace) return state;
      const targetVar = state.proposalWorkspace.variants.find((v) => v.id === action.variantId);
      if (!targetVar) return state;

      const updatedWorkspace: ProposalWorkspace = {
        ...state.proposalWorkspace,
        selectedVariantId: action.variantId
      };

      const updatedPending: ChangeProposal | null = state.pendingProposal
        ? {
            ...state.pendingProposal,
            operations: cloneProposalOperations(targetVar.operations)
          }
        : null;

      return {
        ...state,
        proposalWorkspace: updatedWorkspace,
        pendingProposal: updatedPending
      };
    }

    case 'WORKSPACE_DUPLICATE_VARIANT': {
      if (!state.proposalWorkspace) return state;
      // Max 3 variants rule (PRD §5.1, §6.2)
      if (state.proposalWorkspace.variants.length >= 3) return state;

      const source = state.proposalWorkspace.variants.find((v) => v.id === action.sourceVariantId);
      if (!source) return state;

      const clonedOps = cloneProposalOperations(source.operations);

      const newVariant: ProposalVariant = {
        id: action.newVariantId,
        label: action.newLabel,
        sourceTemplateId: source.sourceTemplateId,
        duplicatedFromVariantId: source.id,
        operations: clonedOps,
        resetSnapshotOperations: cloneProposalOperations(clonedOps),
        createdAt: action.createdAt
      };

      const updatedWorkspace: ProposalWorkspace = {
        ...state.proposalWorkspace,
        variants: [...state.proposalWorkspace.variants, newVariant],
        selectedVariantId: action.newVariantId
      };

      const updatedPending: ChangeProposal | null = state.pendingProposal
        ? {
            ...state.pendingProposal,
            operations: cloneProposalOperations(newVariant.operations)
          }
        : null;

      return {
        ...state,
        proposalWorkspace: updatedWorkspace,
        pendingProposal: updatedPending
      };
    }

    case 'WORKSPACE_REMOVE_VARIANT': {
      if (!state.proposalWorkspace) return state;
      // Cannot delete original variant (first variant, index 0) or if only 1 variant left
      const variantIndex = state.proposalWorkspace.variants.findIndex(
        (v) => v.id === action.variantId
      );
      if (variantIndex <= 0) return state;

      const remainingVariants = state.proposalWorkspace.variants.filter(
        (v) => v.id !== action.variantId
      );
      const newSelectedVariantId =
        state.proposalWorkspace.selectedVariantId === action.variantId
          ? remainingVariants[0]!.id
          : state.proposalWorkspace.selectedVariantId;

      const remainingComp = state.proposalWorkspace.comparisonVariantIds.filter(
        (id) => id !== action.variantId
      );
      const newComparisonVariantIds: readonly [string, string?] =
        remainingComp.length > 0
          ? [remainingComp[0]!, remainingComp[1]]
          : [remainingVariants[0]!.id];

      const updatedWorkspace: ProposalWorkspace = {
        ...state.proposalWorkspace,
        variants: remainingVariants,
        selectedVariantId: newSelectedVariantId,
        comparisonVariantIds: newComparisonVariantIds
      };

      const selectedVar = remainingVariants.find((v) => v.id === newSelectedVariantId);
      const updatedPending: ChangeProposal | null =
        state.pendingProposal && selectedVar
          ? {
              ...state.pendingProposal,
              operations: cloneProposalOperations(selectedVar.operations)
            }
          : null;

      return {
        ...state,
        proposalWorkspace: updatedWorkspace,
        pendingProposal: updatedPending
      };
    }

    case 'WORKSPACE_RESET_VARIANT_EDITS': {
      if (!state.proposalWorkspace) return state;
      const targetVar = state.proposalWorkspace.variants.find((v) => v.id === action.variantId);
      if (!targetVar) return state;

      const updatedVariants = state.proposalWorkspace.variants.map((v) => {
        if (v.id === action.variantId) {
          return {
            ...v,
            operations: cloneProposalOperations(v.resetSnapshotOperations)
          };
        }
        return v;
      });

      const updatedWorkspace: ProposalWorkspace = {
        ...state.proposalWorkspace,
        variants: updatedVariants
      };

      const selectedVar = updatedVariants.find(
        (v) => v.id === state.proposalWorkspace!.selectedVariantId
      );
      const updatedPending: ChangeProposal | null =
        state.pendingProposal && selectedVar
          ? {
              ...state.pendingProposal,
              operations: cloneProposalOperations(selectedVar.operations)
            }
          : null;

      return {
        ...state,
        proposalWorkspace: updatedWorkspace,
        pendingProposal: updatedPending
      };
    }

    case 'WORKSPACE_EDIT_OPERATION': {
      if (!state.proposalWorkspace) return state;

      const updatedVariants = state.proposalWorkspace.variants.map((v) => {
        if (v.id === action.variantId) {
          return {
            ...v,
            operations: v.operations.map((op) => {
              if (op.targetCellId === action.targetCellId) {
                return {
                  ...op,
                  proposedValue: action.proposedValue
                };
              }
              return op;
            })
          };
        }
        return v;
      });

      const updatedWorkspace: ProposalWorkspace = {
        ...state.proposalWorkspace,
        variants: updatedVariants
      };

      const selectedVar = updatedVariants.find(
        (v) => v.id === state.proposalWorkspace!.selectedVariantId
      );
      const updatedPending: ChangeProposal | null =
        state.pendingProposal && selectedVar
          ? {
              ...state.pendingProposal,
              operations: cloneProposalOperations(selectedVar.operations)
            }
          : null;

      return {
        ...state,
        proposalWorkspace: updatedWorkspace,
        pendingProposal: updatedPending
      };
    }

    case 'WORKSPACE_SET_COMPARISON_VARIANTS': {
      if (!state.proposalWorkspace) return state;
      // Fix 9: Validate comparison variant IDs exist in current workspace
      const validIds = action.variantIds.filter(
        (id): id is string =>
          typeof id === 'string' && state.proposalWorkspace!.variants.some((v) => v.id === id)
      );
      if (validIds.length === 0) return state;

      const validComparisonIds: readonly [string, string?] =
        validIds.length > 1 ? [validIds[0]!, validIds[1]!] : [validIds[0]!];

      return {
        ...state,
        proposalWorkspace: {
          ...state.proposalWorkspace,
          comparisonVariantIds: validComparisonIds
        }
      };
    }

    case 'WORKSPACE_ARCHIVE_STALE': {
      if (!state.proposalWorkspace) return state;
      const newArchived = [state.proposalWorkspace, ...state.archivedStaleWorkspaces].slice(0, 3);
      return {
        ...state,
        proposalWorkspace: null,
        pendingProposal: null,
        archivedStaleWorkspaces: newArchived,
        proposalStatus: 'idle',
        proposalError: null,
        activeGenerationRequestId: null
      };
    }

    case 'WORKSPACE_DISMISS_STALE': {
      return {
        ...state,
        proposalWorkspace: null,
        pendingProposal: null,
        proposalStatus: 'idle',
        proposalError: null
      };
    }

    case 'PROPOSAL_EDIT_OPERATION': {
      if (state.proposalWorkspace) {
        const variantId = state.proposalWorkspace.selectedVariantId;
        const updatedVariants = state.proposalWorkspace.variants.map((v) => {
          if (v.id === variantId) {
            return {
              ...v,
              operations: v.operations.map((op) => {
                if (op.targetCellId === action.targetCellId) {
                  return {
                    ...op,
                    proposedValue: action.proposedValue
                  };
                }
                return op;
              })
            };
          }
          return v;
        });

        const updatedPendingOps = state.pendingProposal
          ? state.pendingProposal.operations.map((op) => {
              if (op.targetCellId === action.targetCellId) {
                return { ...op, proposedValue: action.proposedValue };
              }
              return op;
            })
          : [];

        return {
          ...state,
          proposalWorkspace: {
            ...state.proposalWorkspace,
            variants: updatedVariants
          },
          pendingProposal: state.pendingProposal
            ? {
                ...state.pendingProposal,
                operations: updatedPendingOps
              }
            : null
        };
      }

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
      let operations: readonly ProposalOperation[];
      let baseRevision: number;
      let baseAssumptions: ReadonlyModelAssumptions;
      let provenance: TransactionProvenance | undefined;
      let transactionDescription: string;

      if (state.proposalWorkspace) {
        const variant = state.proposalWorkspace.variants.find(
          (v) => v.id === state.proposalWorkspace!.selectedVariantId
        );
        if (!variant) return state;
        operations = variant.operations;
        baseRevision = state.proposalWorkspace.baseRevision;
        baseAssumptions = state.proposalWorkspace.baseAssumptions;
        provenance = {
          proposalWorkspaceId: state.proposalWorkspace.id,
          variantId: variant.id,
          variantLabel: variant.label,
          sourceTemplateId: variant.sourceTemplateId,
          baseRevision: state.proposalWorkspace.baseRevision
        };
        transactionDescription = `Accepted proposal: ${state.proposalWorkspace.title}`;
      } else if (state.pendingProposal) {
        operations = state.pendingProposal.operations;
        baseRevision = state.pendingProposal.baseRevision;
        baseAssumptions = cloneModelAssumptions(state.workingAssumptions);
        transactionDescription = `Accepted proposal: ${state.pendingProposal.title}`;
      } else {
        return state;
      }

      // 1. Revision / Stale guard (PRD §6.8, §6.9, §14): Base revision must strictly match current revision
      if (baseRevision !== state.revision) {
        return {
          ...state,
          proposalError: `Cannot accept stale proposal: generated against revision ${baseRevision}, but model is at revision ${state.revision}.`
        };
      }

      // 2. Prevent duplicate acceptance if already committed
      if (state.proposalStatus === 'accepted') {
        return state;
      }

      // 3. Atomically validate complete operation set against base assumptions
      const opValidation = validateProposalAcceptance(operations, baseAssumptions);
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
          operations,
          'proposal-accepted',
          transactionDescription,
          state.revision,
          provenance
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
          proposalError: null,
          activeGenerationRequestId: null
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
        proposalWorkspace: null,
        pendingProposal: null,
        proposalStatus: 'rejected',
        proposalError: null,
        activeGenerationRequestId: null
      };

    case 'PROPOSAL_DISMISS':
      return {
        ...state,
        proposalWorkspace: null,
        pendingProposal: null,
        proposalStatus: 'idle',
        proposalError: null,
        activeGenerationRequestId: null
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
        validationError: null,
        proposalStatus:
          state.proposalStatus === 'accepted' || state.proposalStatus === 'generating'
            ? 'idle'
            : state.proposalStatus,
        proposalError: state.proposalStatus === 'generating' ? null : state.proposalError,
        activeGenerationRequestId: null
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
        proposalWorkspace: null,
        archivedStaleWorkspaces: [],
        pendingProposal: null,
        proposalStatus: 'idle',
        proposalError: null,
        activeGenerationRequestId: null,
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
