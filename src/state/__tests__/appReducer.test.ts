import { describe, it, expect } from 'vitest';
import { createInitialState } from '../appState';
import { appReducer } from '../appReducer';
import { ProposalVariant, ProposalWorkspace } from '@/domain/types';
import { cloneModelAssumptions } from '@/domain/operations';

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

    const state1 = appReducer(state0, {
      type: 'PROPOSAL_GENERATE_SUCCESS',
      proposal: mockProposal
    });

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

    const state1 = appReducer(state0, {
      type: 'PROPOSAL_GENERATE_SUCCESS',
      proposal: mockProposal
    });

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

    const state1 = appReducer(state0, {
      type: 'PROPOSAL_GENERATE_SUCCESS',
      proposal: mockProposal
    });

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

    const state1 = appReducer(state0, {
      type: 'PROPOSAL_GENERATE_SUCCESS',
      proposal: mockProposal
    });

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

    const state1 = appReducer(state0, {
      type: 'PROPOSAL_GENERATE_SUCCESS',
      proposal: mockProposal
    });

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
      const state1 = appReducer(state0, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        workspace: ws
      });

      // Duplicate variant 1 -> Variant 2
      const state2 = appReducer(state1, {
        type: 'WORKSPACE_DUPLICATE_VARIANT',
        sourceVariantId: 'var-1'
      });
      expect(state2.proposalWorkspace!.variants).toHaveLength(2);
      const var2 = state2.proposalWorkspace!.variants[1]!;
      expect(var2.label).toBe('Variant 2');
      expect(var2.duplicatedFromVariantId).toBe('var-1');
      expect(state2.proposalWorkspace!.selectedVariantId).toBe(var2.id);

      // Duplicate variant 2 -> Variant 3
      const state3 = appReducer(state2, {
        type: 'WORKSPACE_DUPLICATE_VARIANT',
        sourceVariantId: var2.id
      });
      expect(state3.proposalWorkspace!.variants).toHaveLength(3);

      // Attempting 4th variant is blocked by max 3 limit
      const state4 = appReducer(state3, {
        type: 'WORKSPACE_DUPLICATE_VARIANT',
        sourceVariantId: var2.id
      });
      expect(state4.proposalWorkspace!.variants).toHaveLength(3);
    });

    it('ensures copy-on-write isolation: editing a variant does not mutate siblings or reset snapshots', () => {
      const state0 = createInitialState();
      const ws = createMockWorkspace();
      const state1 = appReducer(state0, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        workspace: ws
      });

      const state2 = appReducer(state1, {
        type: 'WORKSPACE_DUPLICATE_VARIANT',
        sourceVariantId: 'var-1'
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
      const state1 = appReducer(state0, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        workspace: ws
      });

      // Attempting to remove original variant is rejected
      const state2 = appReducer(state1, {
        type: 'WORKSPACE_REMOVE_VARIANT',
        variantId: 'var-1'
      });
      expect(state2.proposalWorkspace!.variants).toHaveLength(1);

      // Add duplicate and remove it
      const state3 = appReducer(state1, {
        type: 'WORKSPACE_DUPLICATE_VARIANT',
        sourceVariantId: 'var-1'
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

      const state1 = appReducer(state0, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        workspace: noOpWs
      });

      const state2 = appReducer(state1, { type: 'PROPOSAL_ACCEPT' });

      expect(state2.proposalError).toMatch(/No changes to apply/);
      expect(state2.revision).toBe(1);
      expect(state2.changeHistory).toHaveLength(0);
      expect(state2.workingAssumptions.months[6]!.engineeringFte).toBe(14);
    });

    it('accepts proposal variant with provenance metadata attached to transaction', () => {
      const state0 = createInitialState();
      const ws = createMockWorkspace();
      const state1 = appReducer(state0, {
        type: 'PROPOSAL_GENERATE_SUCCESS',
        workspace: ws
      });

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

      const s1 = appReducer(state0, { type: 'PROPOSAL_GENERATE_SUCCESS', workspace: ws1 });
      const s2 = appReducer(s1, { type: 'WORKSPACE_ARCHIVE_STALE' });
      expect(s2.archivedStaleWorkspaces).toHaveLength(1);
      expect(s2.archivedStaleWorkspaces[0]!.id).toBe('ws-1');

      const s3 = appReducer(s2, { type: 'PROPOSAL_GENERATE_SUCCESS', workspace: ws2 });
      const s4 = appReducer(s3, { type: 'WORKSPACE_ARCHIVE_STALE' });
      expect(s4.archivedStaleWorkspaces).toHaveLength(2);

      const s5 = appReducer(s4, { type: 'PROPOSAL_GENERATE_SUCCESS', workspace: ws3 });
      const s6 = appReducer(s5, { type: 'WORKSPACE_ARCHIVE_STALE' });
      expect(s6.archivedStaleWorkspaces).toHaveLength(3);

      // 4th archive drops the oldest (ws-1)
      const s7 = appReducer(s6, { type: 'PROPOSAL_GENERATE_SUCCESS', workspace: ws4 });
      const s8 = appReducer(s7, { type: 'WORKSPACE_ARCHIVE_STALE' });
      expect(s8.archivedStaleWorkspaces).toHaveLength(3);
      expect(s8.archivedStaleWorkspaces.map((w) => w.id)).toEqual(['ws-4', 'ws-3', 'ws-2']);
    });

    it('resets to baseline clears proposalWorkspace and archivedStaleWorkspaces while advancing revision', () => {
      const state0 = createInitialState();
      const ws = createMockWorkspace();
      const s1 = appReducer(state0, { type: 'PROPOSAL_GENERATE_SUCCESS', workspace: ws });
      const s2 = appReducer(s1, { type: 'WORKSPACE_ARCHIVE_STALE' });
      const s3 = appReducer(s2, { type: 'PROPOSAL_GENERATE_SUCCESS', workspace: ws });

      const s4 = appReducer(s3, { type: 'RESET_TO_BASELINE' });
      expect(s4.proposalWorkspace).toBeNull();
      expect(s4.archivedStaleWorkspaces).toHaveLength(0);
      expect(s4.revision).toBe(2);
      expect(s4.changeHistory).toHaveLength(0);
    });
  });
});
