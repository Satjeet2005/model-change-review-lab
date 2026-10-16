import {
  CalculatedModel,
  CellId,
  ChangeProposal,
  ModelAssumptions,
  ProposalWorkspace,
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
  readonly canUndo: boolean;

  // Backend persistence and synchronization state
  readonly sessionId: string | null;
  readonly stateVersion: number;
  readonly isInitializing: boolean;
  readonly isMutating: boolean;
  readonly networkError: string | null;
  readonly sessionExpiredNotice: boolean;
  readonly configError: string | null;

  // V2 Proposal Workspace State
  readonly workspaceEpoch: number;
  readonly proposalWorkspace: ProposalWorkspace | null;
  readonly archivedStaleWorkspaces: readonly ProposalWorkspace[];
  readonly activeGenerationRequestId: string | null;
  readonly pendingProposal: ChangeProposal | null;
  readonly proposalStatus: ProposalUiStatus;
  readonly proposalError: string | null;
}

/**
 * Creates the initial application state.
 * Baseline and working assumptions are initialized independently from fresh seed objects.
 */
export function createInitialState(isInitializing = false): AppState {
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
    canUndo: false,
    sessionId: null,
    stateVersion: 1,
    isInitializing,
    isMutating: false,
    networkError: null,
    sessionExpiredNotice: false,
    configError: null,
    workspaceEpoch: 0,
    proposalWorkspace: null,
    archivedStaleWorkspaces: [],
    activeGenerationRequestId: null,
    pendingProposal: null,
    proposalStatus: 'idle',
    proposalError: null
  };
}
