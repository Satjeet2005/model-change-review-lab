import { describe, it, expect } from 'vitest';
import { createInitialState, AppState } from '../appState';
import { appReducer, getNextVariantLabel, AppAction } from '../appReducer';
import { ChangeProposal, ProposalVariant, ProposalWorkspace } from '@/domain/types';
import { cloneModelAssumptions } from '@/domain/operations';
import { SessionSnapshot } from '@/api/types';

function startAndSucceedProposal(
  state: AppState,
  payload: { proposal?: ChangeProposal; workspace?: ProposalWorkspace; requestId?: string }
): AppState {
  const requestId =
    payload.requestId ?? `req-test-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const started = appReducer(state, {
    type: 'PROPOSAL_GENERATE_START',
    requestId
  });
  return appReducer(started, {
    type: 'PROPOSAL_GENERATE_SUCCESS',
    requestId,
    ...(payload.proposal ? { proposal: payload.proposal } : {}),
    ...(payload.workspace ? { workspace: payload.workspace } : {})
  });
}

describe('Application Reducer & State Management (T-029)', () => {
  it('initializes state with independent baseline and working models', () => {
    const state = createInitialState();

    expect(state.revision).toBe(1);
    expect(state.activeTab).toBe('model');
    expect(state.editingCell).toBeNull();
    expect(state.validationError).toBeNull();
    expect(state.selectedTraceCellId).toBeNull();
    expect(state.changeHistory).toHaveLength(0);

    // Baseline and working objects must be independent instances
    expect(state.baselineAssumptions).not.toBe(state.workingAssumptions);
    expect(state.baselineAssumptions.months).not.toBe(state.workingAssumptions.months);
    expect(state.baselineAssumptions.months[0]).not.toBe(state.workingAssumptions.months[0]);

    // Initial calculation outputs match PRD verified values
    expect(state.calculatedWorkingModel.months[0]!.revenue).toBe(768750);
    expect(state.calculatedWorkingModel.months[23]!.revenue).toBe(1356544.45);
  });

  it('commits a valid manual edit to a monthly assumption and updates model atomically', () => {
    const initialState = createInitialState();
    const baselineSnapshot = JSON.stringify(initialState.baselineAssumptions);

    // Initial M07 Eng FTE is 14
    expect(initialState.workingAssumptions.months[6]!.engineeringFte).toBe(14);
    expect(initialState.calculatedWorkingModel.months[6]!.totalFte).toBe(34);

    // Commit change: +2 Eng FTE in M07 -> 16
    const nextState = appReducer(initialState, {
      type: 'DIRECT_EDIT_COMMIT',
      cellId: 'assumption:engineeringFte:M07',
      rawValue: 16
    });

    // 1. Revision incremented
    expect(nextState.revision).toBe(2);

    // 2. Working assumption updated
    expect(nextState.workingAssumptions.months[6]!.engineeringFte).toBe(16);

    // 3. Calculated outputs recomputed: Total FTE M07 is now 16 + 20 = 36
    expect(nextState.calculatedWorkingModel.months[6]!.totalFte).toBe(36);
    expect(nextState.calculatedWorkingModel.months[6]!.payroll).toBe(36 * 12000);

    // 4. Change history recorded
    expect(nextState.changeHistory).toHaveLength(1);
    expect(nextState.changeHistory[0]!.kind).toBe('manual-edit');

    // 5. Baseline remains strictly unmutated
    expect(JSON.stringify(nextState.baselineAssumptions)).toBe(baselineSnapshot);
    expect(nextState.baselineAssumptions.months[6]!.engineeringFte).toBe(14);

    // 6. Trace index updated
    expect(nextState.traceIndex.nodes['calculated:totalFte:M07']!.value).toBe(36);
  });

  it('commits a valid edit to starting settings and recalculates entire horizon', () => {
    const initialState = createInitialState();

    const nextState = appReducer(initialState, {
      type: 'DIRECT_EDIT_COMMIT',
      cellId: 'setting:startingRevenueUsd',
      rawValue: 800000
    });

    expect(nextState.revision).toBe(2);
    expect(nextState.workingAssumptions.startingRevenueUsd).toBe(800000);
    expect(nextState.calculatedWorkingModel.months[0]!.revenue).toBe(820000);
    expect(initialState.baselineAssumptions.startingRevenueUsd).toBe(750000);
  });

  it('rejects an invalid manual edit and preserves canonical state intact', () => {
    const initialState = createInitialState();
    const workingSnapshot = JSON.stringify(initialState.workingAssumptions);

    // Fractional FTE is invalid per PRD §6.9
    const nextState = appReducer(initialState, {
      type: 'DIRECT_EDIT_COMMIT',
      cellId: 'assumption:engineeringFte:M07',
      rawValue: 14.5
    });

    expect(nextState.validationError).toMatch(/must be an integer/);
    expect(nextState.revision).toBe(1);
    expect(JSON.stringify(nextState.workingAssumptions)).toBe(workingSnapshot);
    expect(nextState.changeHistory).toHaveLength(0);
  });

  it('handles edit lifecycle: start, change, cancel without mutating state', () => {
    const state0 = createInitialState();

    const state1 = appReducer(state0, {
      type: 'DIRECT_EDIT_START',
      cellId: 'assumption:revenueGrowthRate:M01',
      initialValue: '2.5%'
    });
    expect(state1.editingCell).toBe('assumption:revenueGrowthRate:M01');
    expect(state1.editingValue).toBe('2.5%');

    const state2 = appReducer(state1, {
      type: 'DIRECT_EDIT_CHANGE',
      value: '3.0%'
    });
    expect(state2.editingValue).toBe('3.0%');

    const state3 = appReducer(state2, {
      type: 'DIRECT_EDIT_CANCEL'
    });
    expect(state3.editingCell).toBeNull();
    expect(state3.editingValue).toBe('');
    expect(state3.workingAssumptions.months[0]!.revenueGrowthRate).toBe(0.025);
  });

  it('updates selected trace cell target', () => {
    const state0 = createInitialState();
    const state1 = appReducer(state0, {
      type: 'SET_SELECTED_TRACE_CELL',
      cellId: 'calculated:ebitda:M07'
    });
    expect(state1.selectedTraceCellId).toBe('calculated:ebitda:M07');
  });

  it('generates proposal without mutating working assumptions or calculated outputs (FR-007, FR-008)', () => {
    const state0 = createInitialState();
    const workingSnapshot = JSON.stringify(state0.workingAssumptions);
    const calculatedSnapshot = JSON.stringify(state0.calculatedWorkingModel);

    const mockProposal = {
      id: 'hire-engineers-from-q3',
      title: 'Hire 2 Engineers',
      description: 'Add 2 engineers',
      operations: [
        {
          targetKey: 'engineeringFte',
          targetPeriod: 7 as const,
          targetCellId: 'assumption:engineeringFte:M07' as const,
          previousValue: 14,
          proposedValue: 16,
          displayUnit: 'fte' as const,
          changeLabel: '+2 Eng FTE'
        }
      ],
      baseRevision: 1,
      createdAt: new Date().toISOString()
    };

    const state1 = startAndSucceedProposal(state0, { proposal: mockProposal });

    expect(state1.proposalStatus).toBe('review');
    expect(state1.pendingProposal).toEqual(mockProposal);
    expect(state1.revision).toBe(1);
    expect(JSON.stringify(state1.workingAssumptions)).toBe(workingSnapshot);
    expect(JSON.stringify(state1.calculatedWorkingModel)).toBe(calculatedSnapshot);
  });

  it('allows editing proposal operations without mutating canonical model (FR-009)', () => {
    const state0 = createInitialState();
    const mockProposal = {
      id: 'hire-engineers-from-q3',
      title: 'Hire 2 Engineers',
      description: 'Add 2 engineers',
      operations: [
        {
          targetKey: 'engineeringFte',
          targetPeriod: 7 as const,
          targetCellId: 'assumption:engineeringFte:M07' as const,
          previousValue: 14,
          proposedValue: 16,
          displayUnit: 'fte' as const,
          changeLabel: '+2 Eng FTE'
        }
      ],
      baseRevision: 1,
      createdAt: new Date().toISOString()
    };

    const state1 = startAndSucceedProposal(state0, { proposal: mockProposal });

    // User edits proposed value from 16 to 18
    const state2 = appReducer(state1, {
      type: 'PROPOSAL_EDIT_OPERATION',
      targetCellId: 'assumption:engineeringFte:M07',
      proposedValue: 18
    });

    expect(state2.pendingProposal!.operations[0]!.proposedValue).toBe(18);
    // Working model is still completely untouched at 14
    expect(state2.workingAssumptions.months[6]!.engineeringFte).toBe(14);
  });

  it('accepts proposal and commits edited values atomically (FR-010, FR-015)', () => {
    const state0 = createInitialState();
    const mockProposal = {
      id: 'hire-engineers-from-q3',
      title: 'Hire 2 Engineers',
      description: 'Add 2 engineers',
      operations: [
        {
          targetKey: 'engineeringFte',
          targetPeriod: 7 as const,
          targetCellId: 'assumption:engineeringFte:M07' as const,
          previousValue: 14,
          proposedValue: 18,
          displayUnit: 'fte' as const,
          changeLabel: '+4 Eng FTE'
        }
      ],
      baseRevision: 1,
      createdAt: new Date().toISOString()
    };

    const state1 = startAndSucceedProposal(state0, { proposal: mockProposal });

    const state2 = appReducer(state1, { type: 'PROPOSAL_ACCEPT' });

    expect(state2.proposalStatus).toBe('accepted');
    expect(state2.revision).toBe(2);
    expect(state2.workingAssumptions.months[6]!.engineeringFte).toBe(18);
    expect(state2.calculatedWorkingModel.months[6]!.totalFte).toBe(38);
    expect(state2.changeHistory).toHaveLength(1);
    expect(state2.changeHistory[0]!.kind).toBe('proposal-accepted');
  });

  it('blocks accepting a stale proposal generated against older revision (FR-012, PROP-002)', () => {
    const state0 = createInitialState();
    const mockProposal = {
      id: 'hire-engineers-from-q3',
      title: 'Hire 2 Engineers',
      description: 'Add 2 engineers',
      operations: [
        {
          targetKey: 'engineeringFte',
          targetPeriod: 7 as const,
          targetCellId: 'assumption:engineeringFte:M07' as const,
          previousValue: 14,
          proposedValue: 16,
          displayUnit: 'fte' as const,
          changeLabel: '+2 Eng FTE'
        }
      ],
      baseRevision: 1, // generated against revision 1
      createdAt: new Date().toISOString()
    };

    const state1 = startAndSucceedProposal(state0, { proposal: mockProposal });

    // Model advances to revision 2 via a manual edit
    const state2 = appReducer(state1, {
      type: 'DIRECT_EDIT_COMMIT',
      cellId: 'setting:startingRevenueUsd',
      rawValue: 800000
    });
    expect(state2.revision).toBe(2);

    // Attempting to accept proposal generated against revision 1
    const state3 = appReducer(state2, { type: 'PROPOSAL_ACCEPT' });

    expect(state3.proposalError).toMatch(/stale proposal/i);
    expect(state3.revision).toBe(2);
    // Working model starting revenue is still 800000, M07 eng FTE was not changed
    expect(state3.workingAssumptions.months[6]!.engineeringFte).toBe(14);
  });

  it('rejects proposal without altering canonical model or incrementing revision (FR-011)', () => {
    const state0 = createInitialState();
    const workingSnapshot = JSON.stringify(state0.workingAssumptions);
    const mockProposal = {
      id: 'hire-engineers-from-q3',
      title: 'Hire 2 Engineers',
      description: 'Add 2 engineers',
      operations: [
        {
          targetKey: 'engineeringFte',
          targetPeriod: 7 as const,
          targetCellId: 'assumption:engineeringFte:M07' as const,
          previousValue: 14,
          proposedValue: 16,
          displayUnit: 'fte' as const,
          changeLabel: '+2 Eng FTE'
        }
      ],
      baseRevision: 1,
      createdAt: new Date().toISOString()
    };

    const state1 = startAndSucceedProposal(state0, { proposal: mockProposal });

    const state2 = appReducer(state1, { type: 'PROPOSAL_REJECT' });

    expect(state2.proposalStatus).toBe('rejected');
    expect(state2.pendingProposal).toBeNull();
    expect(state2.revision).toBe(1);
    expect(JSON.stringify(state2.workingAssumptions)).toBe(workingSnapshot);
    expect(state2.changeHistory).toHaveLength(0);
  });

  describe('Proposal Workspace, Immutability & Race Safety (V2 / Task 3)', () => {
    const createMockWorkspace = (revision = 1): ProposalWorkspace => {
      const state = createInitialState();
      const variant: ProposalVariant = {
        id: 'var-1',
        label: 'Original proposal',
        sourceTemplateId: 'hire-engineers-from-q3',
        operations: [
          {
            targetKey: 'engineeringFte',
            targetPeriod: 7,
            targetCellId: 'assumption:engineeringFte:M07',
            previousValue: 14,
            proposedValue: 16,
            displayUnit: 'fte',
            changeLabel: '+2 Eng FTE'
          }
        ],
        resetSnapshotOperations: [
          {
            targetKey: 'engineeringFte',
            targetPeriod: 7,
            targetCellId: 'assumption:engineeringFte:M07',
            previousValue: 14,
            proposedValue: 16,
            displayUnit: 'fte',
            changeLabel: '+2 Eng FTE'
          }
        ],
        createdAt: new Date().toISOString()
      };

      return {
        id: 'ws-1',
        baseRevision: revision,
        baseAssumptions: cloneModelAssumptions(state.workingAssumptions),
        sourceTemplateId: 'hire-engineers-from-q3',
        title: 'Hire 2 Engineers from Q3',
        description: 'Add 2 engineers starting M07',
        variants: [variant],
        selectedVariantId: 'var-1',
        comparisonVariantIds: ['var-1'],
        createdAt: new Date().toISOString()
      };
    };

    it('drops obsolete async generation success when requestId does not match active request', () => {
      const state0 = createInitialState();
      const state1 = appReducer(state0, {
        type: 'PROPOSAL_GENERATE_START',
        requestId: 'req-current'
      });
      expect(state1.activeGenerationRequestId).toBe('req-current');

      // Obsolete response arrives with older requestId
      const obsoleteWorkspace = createMockWorkspace();
      const state2 = appReducer(state1, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        requestId: 'req-old',
        workspace: obsoleteWorkspace
      });

      // Obsolete response is dropped
      expect(state2.proposalWorkspace).toBeNull();
      expect(state2.proposalStatus).toBe('generating');
      expect(state2.activeGenerationRequestId).toBe('req-current');

      // Matching response succeeds
      const currentWorkspace = createMockWorkspace();
      const state3 = appReducer(state2, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        requestId: 'req-current',
        workspace: currentWorkspace
      });
      expect(state3.proposalWorkspace).toEqual(currentWorkspace);
      expect(state3.proposalStatus).toBe('review');
      expect(state3.activeGenerationRequestId).toBeNull();
    });

    it('drops obsolete async generation error when requestId does not match active request', () => {
      const state0 = createInitialState();
      const state1 = appReducer(state0, {
        type: 'PROPOSAL_GENERATE_START',
        requestId: 'req-current'
      });

      // Obsolete error arrives
      const state2 = appReducer(state1, {
        type: 'PROPOSAL_GENERATE_ERROR',
        requestId: 'req-old',
        error: 'Network timeout'
      });

      expect(state2.proposalStatus).toBe('generating');
      expect(state2.proposalError).toBeNull();

      // Correlated error applies
      const state3 = appReducer(state2, {
        type: 'PROPOSAL_GENERATE_ERROR',
        requestId: 'req-current',
        error: 'Failed to generate'
      });
      expect(state3.proposalStatus).toBe('error');
      expect(state3.proposalError).toBe('Failed to generate');
      expect(state3.activeGenerationRequestId).toBeNull();
    });

    it('duplicates variant with independent operations and reset snapshots, capping at 3 variants', () => {
      const state0 = createInitialState();
      const ws = createMockWorkspace();
      const state1 = startAndSucceedProposal(state0, { workspace: ws });

      // Duplicate variant 1 -> Variant 2
      const state2 = appReducer(state1, {
        type: 'WORKSPACE_DUPLICATE_VARIANT',
        sourceVariantId: 'var-1',
        newVariantId: 'var-2',
        newLabel: 'Variant 2',
        createdAt: '2026-10-12T00:00:00.000Z'
      });
      expect(state2.proposalWorkspace!.variants).toHaveLength(2);
      const var2 = state2.proposalWorkspace!.variants[1]!;
      expect(var2.label).toBe('Variant 2');
      expect(var2.duplicatedFromVariantId).toBe('var-1');
      expect(state2.proposalWorkspace!.selectedVariantId).toBe('var-2');

      // Duplicate variant 2 -> Variant 3
      const state3 = appReducer(state2, {
        type: 'WORKSPACE_DUPLICATE_VARIANT',
        sourceVariantId: var2.id,
        newVariantId: 'var-3',
        newLabel: 'Variant 3',
        createdAt: '2026-10-12T00:00:01.000Z'
      });
      expect(state3.proposalWorkspace!.variants).toHaveLength(3);

      // Attempting 4th variant is blocked by max 3 limit
      const state4 = appReducer(state3, {
        type: 'WORKSPACE_DUPLICATE_VARIANT',
        sourceVariantId: var2.id,
        newVariantId: 'var-4',
        newLabel: 'Variant 4',
        createdAt: '2026-10-12T00:00:02.000Z'
      });
      expect(state4.proposalWorkspace!.variants).toHaveLength(3);
    });

    it('ensures copy-on-write isolation: editing a variant does not mutate siblings or reset snapshots', () => {
      const state0 = createInitialState();
      const ws = createMockWorkspace();
      const state1 = startAndSucceedProposal(state0, { workspace: ws });

      const state2 = appReducer(state1, {
        type: 'WORKSPACE_DUPLICATE_VARIANT',
        sourceVariantId: 'var-1',
        newVariantId: 'var-2',
        newLabel: 'Variant 2',
        createdAt: '2026-10-12T00:00:00.000Z'
      });
      const var2Id = state2.proposalWorkspace!.variants[1]!.id;

      // Edit Variant 2 operations
      const state3 = appReducer(state2, {
        type: 'WORKSPACE_EDIT_OPERATION',
        variantId: var2Id,
        targetCellId: 'assumption:engineeringFte:M07',
        proposedValue: 20
      });

      const originalVar = state3.proposalWorkspace!.variants.find((v) => v.id === 'var-1')!;
      const editedVar = state3.proposalWorkspace!.variants.find((v) => v.id === var2Id)!;

      // Original variant operations remain untouched at 16
      expect(originalVar.operations[0]!.proposedValue).toBe(16);
      // Edited variant operations updated to 20
      expect(editedVar.operations[0]!.proposedValue).toBe(20);
      // Reset snapshot of edited variant remains at creation snapshot (16)
      expect(editedVar.resetSnapshotOperations[0]!.proposedValue).toBe(16);

      // Reset edits restores Variant 2 back to 16
      const state4 = appReducer(state3, {
        type: 'WORKSPACE_RESET_VARIANT_EDITS',
        variantId: var2Id
      });
      const resetVar = state4.proposalWorkspace!.variants.find((v) => v.id === var2Id)!;
      expect(resetVar.operations[0]!.proposedValue).toBe(16);
    });

    it('prevents removing original variant, but allows removing duplicates with safe selection fallback', () => {
      const state0 = createInitialState();
      const ws = createMockWorkspace();
      const state1 = startAndSucceedProposal(state0, { workspace: ws });

      // Attempting to remove original variant is rejected
      const state2 = appReducer(state1, {
        type: 'WORKSPACE_REMOVE_VARIANT',
        variantId: 'var-1'
      });
      expect(state2.proposalWorkspace!.variants).toHaveLength(1);

      // Add duplicate and remove it
      const state3 = appReducer(state1, {
        type: 'WORKSPACE_DUPLICATE_VARIANT',
        sourceVariantId: 'var-1',
        newVariantId: 'var-dup-1',
        newLabel: 'Variant 2',
        createdAt: '2026-10-12T00:00:00.000Z'
      });
      const dupId = state3.proposalWorkspace!.variants[1]!.id;
      expect(state3.proposalWorkspace!.selectedVariantId).toBe(dupId);

      const state4 = appReducer(state3, {
        type: 'WORKSPACE_REMOVE_VARIANT',
        variantId: dupId
      });
      expect(state4.proposalWorkspace!.variants).toHaveLength(1);
      expect(state4.proposalWorkspace!.selectedVariantId).toBe('var-1');
    });

    it('rejects acceptance of no-op proposals with zero revision increment and zero transactions', () => {
      const state0 = createInitialState();
      const ws = createMockWorkspace();
      // Set proposedValue equal to previousValue (no effective changes)
      const noOpWs: ProposalWorkspace = {
        ...ws,
        variants: [
          {
            ...ws.variants[0]!,
            operations: [
              {
                ...ws.variants[0]!.operations[0]!,
                proposedValue: 14 // equals previousValue 14
              }
            ]
          }
        ]
      };

      const state1 = startAndSucceedProposal(state0, { workspace: noOpWs });

      const state2 = appReducer(state1, { type: 'PROPOSAL_ACCEPT' });

      expect(state2.proposalError).toMatch(/No changes to apply/);
      expect(state2.revision).toBe(1);
      expect(state2.changeHistory).toHaveLength(0);
      expect(state2.workingAssumptions.months[6]!.engineeringFte).toBe(14);
    });

    it('accepts proposal variant with provenance metadata attached to transaction', () => {
      const state0 = createInitialState();
      const ws = createMockWorkspace();
      const state1 = startAndSucceedProposal(state0, { workspace: ws });

      const state2 = appReducer(state1, { type: 'PROPOSAL_ACCEPT' });

      expect(state2.proposalStatus).toBe('accepted');
      expect(state2.revision).toBe(2);
      expect(state2.changeHistory).toHaveLength(1);

      const tx = state2.changeHistory[0]!;
      expect(tx.provenance).toBeDefined();
      expect(tx.provenance?.proposalWorkspaceId).toBe('ws-1');
      expect(tx.provenance?.variantId).toBe('var-1');
      expect(tx.provenance?.variantLabel).toBe('Original proposal');
      expect(tx.provenance?.sourceTemplateId).toBe('hire-engineers-from-q3');
      expect(tx.provenance?.baseRevision).toBe(1);
    });

    it('manages bounded stale archive FIFO up to 3 workspaces', () => {
      const state0 = createInitialState();
      const ws1 = { ...createMockWorkspace(), id: 'ws-1' };
      const ws2 = { ...createMockWorkspace(), id: 'ws-2' };
      const ws3 = { ...createMockWorkspace(), id: 'ws-3' };
      const ws4 = { ...createMockWorkspace(), id: 'ws-4' };

      const s1 = startAndSucceedProposal(state0, { workspace: ws1 });
      const s2 = appReducer(s1, { type: 'WORKSPACE_ARCHIVE_STALE' });
      expect(s2.archivedStaleWorkspaces).toHaveLength(1);
      expect(s2.archivedStaleWorkspaces[0]!.id).toBe('ws-1');

      const s3 = startAndSucceedProposal(s2, { workspace: ws2 });
      const s4 = appReducer(s3, { type: 'WORKSPACE_ARCHIVE_STALE' });
      expect(s4.archivedStaleWorkspaces).toHaveLength(2);

      const s5 = startAndSucceedProposal(s4, { workspace: ws3 });
      const s6 = appReducer(s5, { type: 'WORKSPACE_ARCHIVE_STALE' });
      expect(s6.archivedStaleWorkspaces).toHaveLength(3);

      // 4th archive drops the oldest (ws-1)
      const s7 = startAndSucceedProposal(s6, { workspace: ws4 });
      const s8 = appReducer(s7, { type: 'WORKSPACE_ARCHIVE_STALE' });
      expect(s8.archivedStaleWorkspaces).toHaveLength(3);
      expect(s8.archivedStaleWorkspaces.map((w) => w.id)).toEqual(['ws-4', 'ws-3', 'ws-2']);
    });

    it('resets to baseline clears proposalWorkspace and archivedStaleWorkspaces while advancing revision', () => {
      const state0 = createInitialState();
      const ws = createMockWorkspace();
      const s1 = startAndSucceedProposal(state0, { workspace: ws });
      const s2 = appReducer(s1, { type: 'WORKSPACE_ARCHIVE_STALE' });
      const s3 = startAndSucceedProposal(s2, { workspace: ws });

      const s4 = appReducer(s3, { type: 'RESET_TO_BASELINE' });
      expect(s4.proposalWorkspace).toBeNull();
      expect(s4.archivedStaleWorkspaces).toHaveLength(0);
      expect(s4.revision).toBe(2);
      expect(s4.changeHistory).toHaveLength(0);
    });

    it('protects active workspaces from silent preset replacement (Fix 1)', () => {
      const state0 = createInitialState();
      const ws = createMockWorkspace();
      const state1 = startAndSucceedProposal(state0, { workspace: ws });

      // Attempting PROPOSAL_GENERATE_START while a workspace is active is blocked
      const state2 = appReducer(state1, {
        type: 'PROPOSAL_GENERATE_START',
        requestId: 'req-preset-new'
      });
      expect(state2.proposalError).toBe(
        'Cannot generate new proposal while a proposal workspace is already active'
      );
      expect(state2.proposalWorkspace).toBe(ws);
      expect(state2.activeGenerationRequestId).toBeNull();
    });

    it('strictly correlates request IDs and drops late responses after reset, reject, dismiss, cancel, and undo (Fix 2, Fix 3)', () => {
      const state0 = createInitialState();
      const ws = createMockWorkspace();

      // 1. Unsolicited response when no active request exists (null activeGenerationRequestId) is ignored
      const unrequested = appReducer(state0, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        requestId: 'req-unsolicited',
        workspace: ws
      });
      expect(unrequested.proposalWorkspace).toBeNull();

      // Runtime check: omitted requestId (bypassing TS) is safely ignored without throwing
      const missingId = appReducer(state0, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        workspace: ws
      } as unknown as AppAction);
      expect(missingId.proposalWorkspace).toBeNull();

      // 2. Late response after RESET_TO_BASELINE is dropped
      const start1 = appReducer(state0, {
        type: 'PROPOSAL_GENERATE_START',
        requestId: 'req-1'
      });
      const resetState = appReducer(start1, { type: 'RESET_TO_BASELINE' });
      expect(resetState.activeGenerationRequestId).toBeNull();
      const lateResetSuccess = appReducer(resetState, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        requestId: 'req-1',
        workspace: ws
      });
      expect(lateResetSuccess.proposalWorkspace).toBeNull();

      // 3. Late response after PROPOSAL_REJECT is dropped
      const start2 = appReducer(state0, {
        type: 'PROPOSAL_GENERATE_START',
        requestId: 'req-2'
      });
      const rejectState = appReducer(start2, { type: 'PROPOSAL_REJECT' });
      expect(rejectState.activeGenerationRequestId).toBeNull();
      const lateRejectSuccess = appReducer(rejectState, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        requestId: 'req-2',
        workspace: ws
      });
      expect(lateRejectSuccess.proposalWorkspace).toBeNull();

      // 4. Late response after PROPOSAL_DISMISS is dropped
      const start3 = appReducer(state0, {
        type: 'PROPOSAL_GENERATE_START',
        requestId: 'req-3'
      });
      const dismissState = appReducer(start3, { type: 'PROPOSAL_DISMISS' });
      expect(dismissState.activeGenerationRequestId).toBeNull();
      const lateDismissSuccess = appReducer(dismissState, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        requestId: 'req-3',
        workspace: ws
      });
      expect(lateDismissSuccess.proposalWorkspace).toBeNull();

      // 5. Late response after PROPOSAL_GENERATE_CANCEL is dropped
      const start4 = appReducer(state0, {
        type: 'PROPOSAL_GENERATE_START',
        requestId: 'req-4'
      });
      const cancelState = appReducer(start4, {
        type: 'PROPOSAL_GENERATE_CANCEL',
        requestId: 'req-4'
      });
      expect(cancelState.activeGenerationRequestId).toBeNull();
      expect(cancelState.proposalStatus).toBe('idle');
      const lateCancelSuccess = appReducer(cancelState, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        requestId: 'req-4',
        workspace: ws
      });
      expect(lateCancelSuccess.proposalWorkspace).toBeNull();

      // 6. Undo transaction resets proposalStatus from 'accepted' to 'idle' and clears activeGenerationRequestId (Fix 3)
      const stateWithProposal = startAndSucceedProposal(state0, { workspace: ws });
      const accepted = appReducer(stateWithProposal, { type: 'PROPOSAL_ACCEPT' });
      expect(accepted.proposalStatus).toBe('accepted');

      const undone = appReducer(accepted, { type: 'UNDO_LAST_TRANSACTION' });
      expect(undone.proposalStatus).toBe('idle');
      expect(undone.activeGenerationRequestId).toBeNull();
    });

    it('generates non-colliding duplicate variant labels when variants are deleted and created (Fix 9)', () => {
      const state0 = createInitialState();
      const ws = createMockWorkspace();
      const state1 = startAndSucceedProposal(state0, { workspace: ws });

      // Duplicate Variant 1 -> Variant 2
      const newLabel2 = getNextVariantLabel(state1.proposalWorkspace!.variants);
      const state2 = appReducer(state1, {
        type: 'WORKSPACE_DUPLICATE_VARIANT',
        sourceVariantId: 'var-1',
        newVariantId: 'var-2',
        newLabel: newLabel2,
        createdAt: '2026-10-12T00:00:00.000Z'
      });
      const var2Id = state2.proposalWorkspace!.variants[1]!.id;
      expect(state2.proposalWorkspace!.variants[1]!.label).toBe('Variant 2');

      // Duplicate Variant 2 -> Variant 3
      const newLabel3 = getNextVariantLabel(state2.proposalWorkspace!.variants);
      const state3 = appReducer(state2, {
        type: 'WORKSPACE_DUPLICATE_VARIANT',
        sourceVariantId: var2Id,
        newVariantId: 'var-3',
        newLabel: newLabel3,
        createdAt: '2026-10-12T00:00:01.000Z'
      });
      expect(state3.proposalWorkspace!.variants[2]!.label).toBe('Variant 3');

      // Remove Variant 2 -> remains Variant 1 and Variant 3
      const state4 = appReducer(state3, {
        type: 'WORKSPACE_REMOVE_VARIANT',
        variantId: var2Id
      });
      expect(state4.proposalWorkspace!.variants.map((v) => v.label)).toEqual([
        'Original proposal',
        'Variant 3'
      ]);

      // Duplicate Variant 3 -> should name it Variant 2 (since Variant 2 is available), not colliding with Variant 3!
      const newLabelNext = getNextVariantLabel(state4.proposalWorkspace!.variants);
      expect(newLabelNext).toBe('Variant 2');
      const state5 = appReducer(state4, {
        type: 'WORKSPACE_DUPLICATE_VARIANT',
        sourceVariantId: state4.proposalWorkspace!.variants[1]!.id,
        newVariantId: 'var-4',
        newLabel: newLabelNext,
        createdAt: '2026-10-12T00:00:02.000Z'
      });
      expect(state5.proposalWorkspace!.variants[2]!.label).toBe('Variant 2');

      // Validate comparison variant IDs filters out non-existent IDs
      const state6 = appReducer(state5, {
        type: 'WORKSPACE_SET_COMPARISON_VARIANTS',
        variantIds: ['var-1', 'non-existent-id']
      });
      expect(state6.proposalWorkspace!.comparisonVariantIds).toEqual(['var-1']);
    });

    it('transitions proposalStatus to idle and clears activeGenerationRequestId when undoing during proposal generation (Fix 1)', () => {
      // 1. Setup state with a committed transaction so history is not empty
      const state0 = createInitialState();
      const stateWithTx = appReducer(state0, {
        type: 'DIRECT_EDIT_COMMIT',
        cellId: 'setting:startingRevenueUsd',
        rawValue: 120000
      });
      expect(stateWithTx.changeHistory).toHaveLength(1);
      expect(stateWithTx.revision).toBe(2);

      // 2. Start proposal generation
      const reqId = 'req-undo-during-gen';
      const generatingState = appReducer(stateWithTx, {
        type: 'PROPOSAL_GENERATE_START',
        requestId: reqId
      });
      expect(generatingState.proposalStatus).toBe('generating');
      expect(generatingState.activeGenerationRequestId).toBe(reqId);

      // 3. User clicks Undo while generation is in flight
      const undoneState = appReducer(generatingState, {
        type: 'UNDO_LAST_TRANSACTION'
      });

      // Status must not remain stuck in 'generating'; request ID must be cleared
      expect(undoneState.proposalStatus).toBe('idle');
      expect(undoneState.activeGenerationRequestId).toBeNull();
      expect(undoneState.proposalError).toBeNull();
      expect(undoneState.revision).toBe(3); // Monotonic increment
      expect(undoneState.changeHistory).toHaveLength(0);

      // 4. Late PROPOSAL_GENERATE_SUCCESS with the old requestId must be ignored
      const lateSuccessState = appReducer(undoneState, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        requestId: reqId,
        workspace: createMockWorkspace()
      });
      expect(lateSuccessState).toBe(undoneState);
      expect(lateSuccessState.proposalStatus).toBe('idle');
      expect(lateSuccessState.proposalWorkspace).toBeNull();

      // 5. Late PROPOSAL_GENERATE_ERROR with the old requestId must also be ignored
      const lateErrorState = appReducer(undoneState, {
        type: 'PROPOSAL_GENERATE_ERROR',
        requestId: reqId,
        error: 'Network timeout'
      });
      expect(lateErrorState).toBe(undoneState);
      expect(lateErrorState.proposalStatus).toBe('idle');
      expect(lateErrorState.proposalError).toBeNull();
    });

    it('ensures duplicate-variant creation is deterministic given identical action payload (Fix 2)', () => {
      const state0 = createInitialState();
      const ws = createMockWorkspace();
      const state1 = startAndSucceedProposal(state0, { workspace: ws });

      const duplicateAction = {
        type: 'WORKSPACE_DUPLICATE_VARIANT' as const,
        sourceVariantId: 'var-1',
        newVariantId: 'var-1-copy',
        newLabel: 'Variant 2',
        createdAt: '2026-10-12T12:00:00.000Z'
      };

      const result1 = appReducer(state1, duplicateAction);
      const result2 = appReducer(state1, duplicateAction);

      // Calling reducer with identical state and action produces exactly identical results
      expect(result1).toEqual(result2);

      const duplicatedVariant = result1.proposalWorkspace!.variants.find(
        (v) => v.id === 'var-1-copy'
      )!;
      expect(duplicatedVariant).toBeDefined();
      expect(duplicatedVariant.id).toBe('var-1-copy');
      expect(duplicatedVariant.label).toBe('Variant 2');
      expect(duplicatedVariant.createdAt).toBe('2026-10-12T12:00:00.000Z');
      expect(duplicatedVariant.duplicatedFromVariantId).toBe('var-1');
      expect(result1.proposalWorkspace!.selectedVariantId).toBe('var-1-copy');

      // Operations and reset snapshots must be deeply equal but independent references
      expect(duplicatedVariant.operations).toEqual(duplicatedVariant.resetSnapshotOperations);
      expect(duplicatedVariant.operations).not.toBe(duplicatedVariant.resetSnapshotOperations);
      expect(duplicatedVariant.operations).toEqual(
        state1.proposalWorkspace!.variants[0]!.operations
      );
      expect(duplicatedVariant.operations).not.toBe(
        state1.proposalWorkspace!.variants[0]!.operations
      );
    });

    it('correlates PROPOSAL_GENERATE_CANCEL with the active generation request and rejects stale cancellation', () => {
      const state0 = createInitialState();
      const ws = createMockWorkspace();

      // 1 & 2. Start request A from initial state
      const stateA = appReducer(state0, {
        type: 'PROPOSAL_GENERATE_START',
        requestId: 'req-A'
      });
      expect(stateA.proposalStatus).toBe('generating');
      expect(stateA.activeGenerationRequestId).toBe('req-A');

      // Cancellation for mismatched request (e.g. stale 'req-stale') while req-A is active is ignored
      const mismatchedCancel = appReducer(stateA, {
        type: 'PROPOSAL_GENERATE_CANCEL',
        requestId: 'req-stale'
      });
      expect(mismatchedCancel).toBe(stateA);
      expect(mismatchedCancel.proposalStatus).toBe('generating');
      expect(mismatchedCancel.activeGenerationRequestId).toBe('req-A');

      // Cancellation when no request is active (null activeGenerationRequestId) is ignored
      const idleCancel = appReducer(state0, {
        type: 'PROPOSAL_GENERATE_CANCEL',
        requestId: 'req-A'
      });
      expect(idleCancel).toBe(state0);

      // 3. Dispatch PROPOSAL_GENERATE_START for req-B from stateA (where req-A was in progress)
      const stateB = appReducer(stateA, {
        type: 'PROPOSAL_GENERATE_START',
        requestId: 'req-B'
      });

      // 4. Assert that req-B is now the active request
      expect(stateB.proposalStatus).toBe('generating');
      expect(stateB.activeGenerationRequestId).toBe('req-B');

      // 5 & 6. Dispatch PROPOSAL_GENERATE_CANCEL for req-A; reducer ignores stale cancellation and preserves req-B
      const staleCancelB = appReducer(stateB, {
        type: 'PROPOSAL_GENERATE_CANCEL',
        requestId: 'req-A'
      });
      expect(staleCancelB).toBe(stateB);
      expect(staleCancelB.activeGenerationRequestId).toBe('req-B');

      // 7. Assert proposalStatus remains 'generating'
      expect(staleCancelB.proposalStatus).toBe('generating');

      // 8. Dispatch late success and error for req-A; verify they do not replace or invalidate request B
      const lateSuccessA = appReducer(staleCancelB, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        requestId: 'req-A',
        workspace: ws
      });
      expect(lateSuccessA).toBe(staleCancelB);
      expect(lateSuccessA.activeGenerationRequestId).toBe('req-B');
      expect(lateSuccessA.proposalStatus).toBe('generating');
      expect(lateSuccessA.proposalWorkspace).toBeNull();

      const lateErrorA = appReducer(staleCancelB, {
        type: 'PROPOSAL_GENERATE_ERROR',
        requestId: 'req-A',
        error: 'Late failure from req-A'
      });
      expect(lateErrorA).toBe(staleCancelB);
      expect(lateErrorA.activeGenerationRequestId).toBe('req-B');
      expect(lateErrorA.proposalStatus).toBe('generating');
      expect(lateErrorA.proposalError).toBeNull();

      // 9. Matching cancellation for req-B transitions application to idle and invalidates req-B ID
      const matchedCancel = appReducer(staleCancelB, {
        type: 'PROPOSAL_GENERATE_CANCEL',
        requestId: 'req-B'
      });
      expect(matchedCancel.proposalStatus).toBe('idle');
      expect(matchedCancel.activeGenerationRequestId).toBeNull();
      expect(matchedCancel.proposalError).toBeNull();

      // 10. Subsequent late success and error responses for cancelled req-B are ignored
      const lateSuccessB = appReducer(matchedCancel, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        requestId: 'req-B',
        workspace: ws
      });
      expect(lateSuccessB).toBe(matchedCancel);
      expect(lateSuccessB.proposalWorkspace).toBeNull();
      expect(lateSuccessB.proposalStatus).toBe('idle');

      const lateErrorB = appReducer(matchedCancel, {
        type: 'PROPOSAL_GENERATE_ERROR',
        requestId: 'req-B',
        error: 'Late failure from req-B'
      });
      expect(lateErrorB).toBe(matchedCancel);
      expect(lateErrorB.proposalError).toBeNull();
      expect(lateErrorB.proposalStatus).toBe('idle');
    });

    it('guards SERVER_SNAPSHOT_APPLIED against stale revisions and stateVersions while accepting session resets', () => {
      const state0 = createInitialState();
      const mockSnapshot1: SessionSnapshot = {
        sessionId: 'session-123',
        stateVersion: 5,
        revision: 2,
        baselineAssumptions: state0.baselineAssumptions,
        workingAssumptions: state0.workingAssumptions,
        activeWorkspace: null,
        archivedWorkspaces: [],
        changeHistory: [],
        canUndo: true
      };

      // 1. Initial snapshot applies successfully and sets sessionId, revision, and stateVersion
      const state1 = appReducer(state0, {
        type: 'SERVER_SNAPSHOT_APPLIED',
        snapshot: mockSnapshot1
      });
      expect(state1.sessionId).toBe('session-123');
      expect(state1.revision).toBe(2);
      expect(state1.stateVersion).toBe(5);

      // 2. Stale snapshot for the same session (revision 1 < 2) is rejected by ordering guard
      const staleSnapshot: SessionSnapshot = {
        ...mockSnapshot1,
        revision: 1
      };
      const state2 = appReducer(state1, {
        type: 'SERVER_SNAPSHOT_APPLIED',
        snapshot: staleSnapshot
      });
      expect(state2.revision).toBe(2);
      expect(state2.stateVersion).toBe(5);
      expect(state2.sessionId).toBe('session-123');

      // 3. Stale snapshot for the same session with SAME revision (2 == 2) but lower stateVersion (4 < 5) is rejected
      const staleVersionSnapshot: SessionSnapshot = {
        ...mockSnapshot1,
        revision: 2,
        stateVersion: 4
      };
      const state2b = appReducer(state1, {
        type: 'SERVER_SNAPSHOT_APPLIED',
        snapshot: staleVersionSnapshot
      });
      expect(state2b.revision).toBe(2);
      expect(state2b.stateVersion).toBe(5);
      expect(state2b.sessionId).toBe('session-123');

      // 4. Newer snapshot for same session with same revision (2 == 2) but higher stateVersion (6 > 5) is accepted
      const newerVersionSnapshot: SessionSnapshot = {
        ...mockSnapshot1,
        revision: 2,
        stateVersion: 6
      };
      const state2c = appReducer(state1, {
        type: 'SERVER_SNAPSHOT_APPLIED',
        snapshot: newerVersionSnapshot
      });
      expect(state2c.revision).toBe(2);
      expect(state2c.stateVersion).toBe(6);

      // 5. Newer snapshot for same session (revision 3 > 2) is accepted
      const newerSnapshot: SessionSnapshot = {
        ...mockSnapshot1,
        revision: 3,
        stateVersion: 7
      };
      const state3 = appReducer(state2c, {
        type: 'SERVER_SNAPSHOT_APPLIED',
        snapshot: newerSnapshot
      });
      expect(state3.revision).toBe(3);
      expect(state3.stateVersion).toBe(7);

      // 6. Legitimate session reset (different sessionId) with revision 1 and stateVersion 1 is accepted
      const resetSnapshot: SessionSnapshot = {
        ...mockSnapshot1,
        sessionId: 'session-456-reset',
        revision: 1,
        stateVersion: 1,
        sessionResetBecauseExpired: true
      };
      const state4 = appReducer(state3, {
        type: 'SERVER_SNAPSHOT_APPLIED',
        snapshot: resetSnapshot
      });
      expect(state4.sessionId).toBe('session-456-reset');
      expect(state4.revision).toBe(1);
      expect(state4.stateVersion).toBe(1);
      expect(state4.sessionExpiredNotice).toBe(true);
    });

    it('synchronizes global stateVersion across proposal lifecycle and protects against delayed/equal-version snapshots (Round 5 P1)', () => {
      const state0 = createInitialState();
      const mockSnapshot1: SessionSnapshot = {
        sessionId: 'session-order-test',
        stateVersion: 1,
        revision: 1,
        baselineAssumptions: state0.baselineAssumptions,
        workingAssumptions: state0.workingAssumptions,
        activeWorkspace: null,
        archivedWorkspaces: [],
        changeHistory: [],
        canUndo: false
      };

      // 1. Establish session at stateVersion 1
      const sessionState = appReducer(state0, {
        type: 'SERVER_SNAPSHOT_APPLIED',
        snapshot: mockSnapshot1
      });
      expect(sessionState.stateVersion).toBe(1);

      // 2. Proposal generation updates global stateVersion from workspace
      const startState = appReducer(sessionState, {
        type: 'PROPOSAL_GENERATE_START',
        requestId: 'req-gen-1'
      });
      expect(startState.proposalStatus).toBe('generating');

      // Delayed equal-version snapshot arrives while generation is in flight -> rejected, generation preserved
      const delayedDuringGen = appReducer(startState, {
        type: 'SERVER_SNAPSHOT_APPLIED',
        snapshot: mockSnapshot1
      });
      expect(delayedDuringGen.proposalStatus).toBe('generating');
      expect(delayedDuringGen.activeGenerationRequestId).toBe('req-gen-1');

      const mockWs: ProposalWorkspace = {
        id: 'ws-gen-1',
        title: 'Hiring plan',
        description: 'Test',
        sourceTemplateId: 'hire-engineers-from-q3',
        baseRevision: 1,
        stateVersion: 2,
        baseAssumptions: sessionState.workingAssumptions,
        selectedVariantId: 'var-1',
        comparisonVariantIds: ['var-1'],
        createdAt: '2026-01-01T00:00:00Z',
        variants: [
          {
            id: 'var-1',
            label: 'Original proposal',
            sourceTemplateId: 'hire-engineers-from-q3',
            operations: [],
            resetSnapshotOperations: [],
            createdAt: '2026-01-01T00:00:00Z'
          }
        ]
      };

      const generatedState = appReducer(startState, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        requestId: 'req-gen-1',
        workspace: mockWs
      });
      expect(generatedState.stateVersion).toBe(2);
      expect(generatedState.proposalStatus).toBe('review');
      expect(generatedState.proposalWorkspace).not.toBeNull();

      // Delayed lower-version snapshot (stateVersion 1 < 2) is rejected
      const delayedLowerSnap = appReducer(generatedState, {
        type: 'SERVER_SNAPSHOT_APPLIED',
        snapshot: mockSnapshot1
      });
      expect(delayedLowerSnap.proposalWorkspace).not.toBeNull();
      expect(delayedLowerSnap.stateVersion).toBe(2);

      // Delayed equal-version snapshot (stateVersion 2 == 2) without active workspace is rejected
      const equalVersionNoWs: SessionSnapshot = {
        ...mockSnapshot1,
        stateVersion: 2,
        activeWorkspace: null
      };
      const delayedEqualAfterGen = appReducer(generatedState, {
        type: 'SERVER_SNAPSHOT_APPLIED',
        snapshot: equalVersionNoWs
      });
      expect(delayedEqualAfterGen.proposalWorkspace).not.toBeNull();
      expect(delayedEqualAfterGen.proposalStatus).toBe('review');

      // 3. Rejection advances stateVersion and clears workspace
      const rejectedState = appReducer(generatedState, {
        type: 'PROPOSAL_REJECT',
        stateVersion: 3
      });
      expect(rejectedState.stateVersion).toBe(3);
      expect(rejectedState.proposalStatus).toBe('rejected');
      expect(rejectedState.proposalWorkspace).toBeNull();

      // Delayed lower-version snapshot (stateVersion 2 < 3) is rejected
      const delayedLowerAfterReject = appReducer(rejectedState, {
        type: 'SERVER_SNAPSHOT_APPLIED',
        snapshot: {
          ...mockSnapshot1,
          stateVersion: 2,
          activeWorkspace: mockWs
        }
      });
      expect(delayedLowerAfterReject.proposalStatus).toBe('rejected');
      expect(delayedLowerAfterReject.proposalWorkspace).toBeNull();

      // Delayed equal-version snapshot (stateVersion 3 == 3) containing active workspace is rejected
      const delayedEqualWithWs: SessionSnapshot = {
        ...mockSnapshot1,
        stateVersion: 3,
        activeWorkspace: mockWs
      };
      const delayedEqualAfterReject = appReducer(rejectedState, {
        type: 'SERVER_SNAPSHOT_APPLIED',
        snapshot: delayedEqualWithWs
      });
      expect(delayedEqualAfterReject.proposalStatus).toBe('rejected');
      expect(delayedEqualAfterReject.proposalWorkspace).toBeNull();

      // 4. Dismissal advances stateVersion and resets status to idle
      const dismissedState = appReducer(generatedState, {
        type: 'PROPOSAL_DISMISS',
        stateVersion: 4
      });
      expect(dismissedState.stateVersion).toBe(4);
      expect(dismissedState.proposalStatus).toBe('idle');
      expect(dismissedState.proposalWorkspace).toBeNull();

      // Delayed equal-version snapshot (stateVersion 4 == 4) containing active workspace is rejected
      const delayedEqualAfterDismiss = appReducer(dismissedState, {
        type: 'SERVER_SNAPSHOT_APPLIED',
        snapshot: {
          ...mockSnapshot1,
          stateVersion: 4,
          activeWorkspace: mockWs
        }
      });
      expect(delayedEqualAfterDismiss.proposalStatus).toBe('idle');
      expect(delayedEqualAfterDismiss.proposalWorkspace).toBeNull();
    });

    it('UI-only acknowledgement dismissal preserves server-authoritative stateVersion', () => {
      const stateWithVer = {
        ...createInitialState(),
        stateVersion: 5,
        proposalStatus: 'error' as const,
        proposalError: 'Network error'
      };

      // Dismissal without stateVersion (UI acknowledgment) keeps stateVersion unchanged
      const dismissed = appReducer(stateWithVer, { type: 'PROPOSAL_DISMISS' });
      expect(dismissed.stateVersion).toBe(5);
      expect(dismissed.proposalStatus).toBe('idle');
      expect(dismissed.proposalError).toBeNull();
    });
  });

  describe('Workspace Epoch Invalidation and WORKSPACE_UPDATED Guards (P1)', () => {
    const createMockWorkspace = (): ProposalWorkspace => {
      const state = createInitialState();
      const variant: ProposalVariant = {
        id: 'var-1',
        label: 'Original proposal',
        sourceTemplateId: 'hire-engineers-from-q3',
        operations: [],
        resetSnapshotOperations: [],
        createdAt: '2026-01-01T00:00:00Z'
      };
      return {
        id: 'ws-1',
        sourceTemplateId: 'hire-engineers-from-q3',
        title: 'Hire 2 Engineers from Q3',
        description: 'Test workspace',
        baseRevision: 1,
        baseAssumptions: cloneModelAssumptions(state.workingAssumptions),
        status: 'active',
        variants: [variant],
        selectedVariantId: 'var-1',
        comparisonVariantIds: ['var-1'],
        createdAt: '2026-01-01T00:00:00Z'
      };
    };

    it('WORKSPACE_UPDATED drops action if proposalWorkspace is null', () => {
      const state0 = createInitialState();
      expect(state0.proposalWorkspace).toBeNull();

      const ws = createMockWorkspace();
      const nextState = appReducer(state0, {
        type: 'WORKSPACE_UPDATED',
        workspace: ws
      });

      expect(nextState.proposalWorkspace).toBeNull();
      expect(nextState).toBe(state0);
    });

    it('WORKSPACE_UPDATED drops action if epoch does not match state.workspaceEpoch', () => {
      const state0 = createInitialState();
      const ws = createMockWorkspace();
      const activeState = startAndSucceedProposal(state0, { workspace: ws });
      const currentEpoch = activeState.workspaceEpoch;

      const updatedWs: ProposalWorkspace = {
        ...ws,
        selectedVariantId: 'var-updated'
      };

      // Dispatched with stale epoch
      const staleState = appReducer(activeState, {
        type: 'WORKSPACE_UPDATED',
        workspace: updatedWs,
        epoch: currentEpoch + 1
      });

      expect(staleState.proposalWorkspace?.selectedVariantId).toBe('var-1');
      expect(staleState).toBe(activeState);
    });

    it('WORKSPACE_UPDATED drops action if sessionId does not match state.sessionId', () => {
      const state0: AppState = {
        ...createInitialState(),
        sessionId: 'session-curr'
      };
      const ws = createMockWorkspace();
      const activeState = startAndSucceedProposal(state0, { workspace: ws });

      const updatedWs: ProposalWorkspace = {
        ...ws,
        selectedVariantId: 'var-updated'
      };

      const staleState = appReducer(activeState, {
        type: 'WORKSPACE_UPDATED',
        workspace: updatedWs,
        sessionId: 'session-other'
      });

      expect(staleState.proposalWorkspace?.selectedVariantId).toBe('var-1');
      expect(staleState).toBe(activeState);
    });

    it('WORKSPACE_UPDATED applies changes when workspace is active, epoch matches, and sessionId matches', () => {
      const state0: AppState = {
        ...createInitialState(),
        sessionId: 'session-curr'
      };
      const ws = createMockWorkspace();
      const activeState = startAndSucceedProposal(state0, { workspace: ws });

      const updatedWs: ProposalWorkspace = {
        ...ws,
        selectedVariantId: 'var-1',
        title: 'Updated Title'
      };

      const nextState = appReducer(activeState, {
        type: 'WORKSPACE_UPDATED',
        workspace: updatedWs,
        sessionId: 'session-curr',
        epoch: activeState.workspaceEpoch
      });

      expect(nextState.proposalWorkspace?.title).toBe('Updated Title');
    });

    it('increments workspaceEpoch on workspace-closing and generating transitions', () => {
      const state0 = createInitialState();
      const epoch0 = state0.workspaceEpoch;

      // 1. PROPOSAL_GENERATE_START increments epoch
      const generating = appReducer(state0, {
        type: 'PROPOSAL_GENERATE_START',
        requestId: 'req-1'
      });
      expect(generating.workspaceEpoch).toBe(epoch0 + 1);

      // 2. PROPOSAL_REJECT increments epoch
      const ws = createMockWorkspace();
      const withWs = startAndSucceedProposal(state0, { workspace: ws });
      const epochBeforeReject = withWs.workspaceEpoch;
      const rejected = appReducer(withWs, { type: 'PROPOSAL_REJECT' });
      expect(rejected.workspaceEpoch).toBe(epochBeforeReject + 1);

      // 3. PROPOSAL_DISMISS increments epoch
      const epochBeforeDismiss = withWs.workspaceEpoch;
      const dismissed = appReducer(withWs, { type: 'PROPOSAL_DISMISS' });
      expect(dismissed.workspaceEpoch).toBe(epochBeforeDismiss + 1);

      // 4. RESET_TO_BASELINE increments epoch
      const epochBeforeReset = withWs.workspaceEpoch;
      const reset = appReducer(withWs, { type: 'RESET_TO_BASELINE' });
      expect(reset.workspaceEpoch).toBe(epochBeforeReset + 1);

      // 5. WORKSPACE_CLOSED increments epoch
      const epochBeforeClosed = withWs.workspaceEpoch;
      const closed = appReducer(withWs, { type: 'WORKSPACE_CLOSED' });
      expect(closed.workspaceEpoch).toBe(epochBeforeClosed + 1);

      // 6. WORKSPACE_ARCHIVE_STALE increments epoch
      const epochBeforeArchive = withWs.workspaceEpoch;
      const archived = appReducer(withWs, { type: 'WORKSPACE_ARCHIVE_STALE' });
      expect(archived.workspaceEpoch).toBe(epochBeforeArchive + 1);

      // 7. WORKSPACE_DISMISS_STALE increments epoch
      const epochBeforeDismissStale = withWs.workspaceEpoch;
      const dismissedStale = appReducer(withWs, { type: 'WORKSPACE_DISMISS_STALE' });
      expect(dismissedStale.workspaceEpoch).toBe(epochBeforeDismissStale + 1);

      // 8. SERVER_SNAPSHOT_APPLIED increments epoch
      const epochBeforeSnapshot = withWs.workspaceEpoch;
      const snapshotted = appReducer(withWs, {
        type: 'SERVER_SNAPSHOT_APPLIED',
        snapshot: {
          sessionId: 'session-new',
          stateVersion: 2,
          revision: 2,
          baselineAssumptions: cloneModelAssumptions(state0.workingAssumptions),
          workingAssumptions: cloneModelAssumptions(state0.workingAssumptions),
          activeWorkspace: null,
          archivedWorkspaces: [],
          changeHistory: [],
          canUndo: false
        }
      });
      expect(snapshotted.workspaceEpoch).toBe(epochBeforeSnapshot + 1);
    });
  });
});
