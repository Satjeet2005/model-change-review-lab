import {
  CalculatedModel,
  CellId,
  ChangeProposal,
  ModelAssumptions,
  TraceIndex,
  TransactionRecord
} from '@/domain/types';
import { calculateModel } from '@/domain/calculation';
import { createSeedAssumptions } from '@/domain/seed';
import { buildTraceIndex } from '@/domain/trace';

export type NavTabId = 'model' | 'compare' | 'history' | 'performance';

export type ProposalUiStatus = 'idle' | 'generating' | 'review' | 'accepted' | 'rejected' | 'error';

export interface AppState {
  readonly baselineAssumptions: ModelAssumptions;
  readonly workingAssumptions: ModelAssumptions;
  readonly calculatedWorkingModel: CalculatedModel;
  readonly traceIndex: TraceIndex;
  readonly revision: number;
  readonly activeTab: NavTabId;
  readonly editingCell: CellId | null;
  readonly editingValue: string;
  readonly validationError: string | null;
  readonly selectedTraceCellId: CellId | null;
  readonly changeHistory: readonly TransactionRecord[];
  readonly pendingProposal: ChangeProposal | null;
  readonly proposalStatus: ProposalUiStatus;
  readonly proposalError: string | null;
}

/**
 * Creates the initial application state.
 * Baseline and working assumptions are initialized independently from fresh seed objects.
 */
export function createInitialState(): AppState {
  const baseline = createSeedAssumptions();
  const working = createSeedAssumptions();
  const calculatedWorkingModel = calculateModel(working);
  const traceIndex = buildTraceIndex(working, calculatedWorkingModel);

  return {
    baselineAssumptions: baseline,
    workingAssumptions: working,
    calculatedWorkingModel,
    traceIndex,
    revision: 1,
    activeTab: 'model',
    editingCell: null,
    editingValue: '',
    validationError: null,
    selectedTraceCellId: null,
    changeHistory: [],
    pendingProposal: null,
    proposalStatus: 'idle',
    proposalError: null
  };
}
