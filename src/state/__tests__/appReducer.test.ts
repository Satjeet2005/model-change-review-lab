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
});
