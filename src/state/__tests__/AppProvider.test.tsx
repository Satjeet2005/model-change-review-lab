import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider, useAppState, useAppDispatch } from '../AppProvider';

function TestConsumer() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  return (
    <div>
      <span data-testid="active-tab">{state.activeTab}</span>
      <span data-testid="revenue-m01">{state.calculatedWorkingModel.months[0]!.revenue}</span>
      <button
        data-testid="edit-btn"
        onClick={() =>
          dispatch({
            type: 'DIRECT_EDIT_COMMIT',
            cellId: 'setting:startingRevenueUsd',
            rawValue: 900000
          })
        }
      >
        Update
      </button>
    </div>
  );
}

describe('AppProvider Context (T-030)', () => {
  it('provides state and dispatch to descendants', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>
    );

    expect(screen.getByTestId('active-tab').textContent).toBe('model');
    expect(screen.getByTestId('revenue-m01').textContent).toBe('768750');

    await user.click(screen.getByTestId('edit-btn'));

    // 900,000 * 1.025 = 922,500
    expect(screen.getByTestId('revenue-m01').textContent).toBe('922500');
  });

  it('throws an error if useAppState is used outside AppProvider', () => {
    // Suppress console.error in React for expected boundary error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow(
      'useAppState must be used within an AppProvider'
    );

    spy.mockRestore();
  });
});
