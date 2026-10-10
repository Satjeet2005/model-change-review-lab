import { describe, it, expect } from 'vitest';
import { createInitialState } from '../appState';
import { appReducer } from '../appReducer';

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
});
