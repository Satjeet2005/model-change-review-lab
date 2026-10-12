import { describe, it, expect } from 'vitest';
import { createInitialState, AppState } from '../appState';
import { appReducer, getNextVariantLabel, AppAction } from '../appReducer';
import { ChangeProposal, ProposalVariant, ProposalWorkspace } from '@/domain/types';
import { cloneModelAssumptions } from '@/domain/operations';

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
  });
});
