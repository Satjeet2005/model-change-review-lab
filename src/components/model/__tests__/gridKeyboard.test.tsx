import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '@/state/AppProvider';
import { ModelGrid } from '../ModelGrid';
import { ModelPage } from '@/pages/ModelPage';

describe('Grid Keyboard & Editing Lifecycle (T-040 / PRD Tests 30-33)', () => {
  it('enters and exits edit mode using keyboard gestures (PRD Test 30)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelGrid />
      </AppProvider>
    );

    // Initial button for Engineering FTE M01 is "12"
    const cellBtn = screen.getByRole('button', {
      name: /^Engineering FTE M01: 12$/
    });
    expect(cellBtn).toBeInTheDocument();

    // Focus and press Enter to enter edit mode
    act(() => {
      cellBtn.focus();
    });
    await user.keyboard('{Enter}');

    // An input is now rendered
    const input = screen.getByRole('textbox', {
      name: 'Engineering FTE M01'
    });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('12');

    // Press Escape to cancel and exit edit mode
    await user.keyboard('{Escape}');

    // Input is dismissed, cell button restored
    expect(screen.queryByRole('textbox', { name: 'Engineering FTE M01' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Engineering FTE M01: 12$/ })).toBeInTheDocument();
  });

  it('commits a valid edit on Enter and updates derived metrics once (PRD Test 31)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    // Baseline Total FTE at M01 is 30 (12 Eng + 18 Other)
    expect(screen.getByRole('button', { name: /^Total FTE M01: 30$/ })).toBeInTheDocument();

    // Edit Engineering FTE M01
    const cellBtn = screen.getByRole('button', {
      name: /^Engineering FTE M01: 12$/
    });
    act(() => {
      cellBtn.focus();
    });
    await user.keyboard('{Enter}');

    const input = screen.getByRole('textbox', {
      name: 'Engineering FTE M01'
    });
    await user.clear(input);
    await user.type(input, '14{Enter}');

    // Input dismissed, cell button shows updated value 14
    expect(screen.getByRole('button', { name: /^Engineering FTE M01: 14$/ })).toBeInTheDocument();

    // Recomputed derived metric Total FTE M01 is now 32 (14 + 18)
    expect(screen.getByRole('button', { name: /^Total FTE M01: 32$/ })).toBeInTheDocument();
  });

  it('cancels draft edit on Escape without changing canonical model (PRD Test 32)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    const cellBtn = screen.getByRole('button', {
      name: /^Engineering FTE M01: 12$/
    });
    act(() => {
      cellBtn.focus();
    });
    await user.keyboard('{Enter}');

    const input = screen.getByRole('textbox', {
      name: 'Engineering FTE M01'
    });
    await user.clear(input);
    await user.type(input, '99');

    // Press Escape
    await user.keyboard('{Escape}');

    // Value unchanged: 12
    expect(screen.getByRole('button', { name: /^Engineering FTE M01: 12$/ })).toBeInTheDocument();

    // Downstream Total FTE unchanged: 30
    expect(screen.getByRole('button', { name: /^Total FTE M01: 30$/ })).toBeInTheDocument();
  });

  it('displays validation error on invalid Enter commit and preserves model (PRD Test 33)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    const cellBtn = screen.getByRole('button', {
      name: /^Engineering FTE M01: 12$/
    });
    act(() => {
      cellBtn.focus();
    });
    await user.keyboard('{Enter}');

    const input = screen.getByRole('textbox', {
      name: 'Engineering FTE M01'
    });
    await user.clear(input);
    // Fractional FTE is invalid
    await user.type(input, '12.5{Enter}');

    // Validation error displayed
    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toHaveTextContent(/must be an integer/);

    // Input is preserved for correction
    expect(input).toHaveValue('12.5');

    // Downstream Total FTE is untouched
    expect(screen.getByRole('button', { name: /^Total FTE M01: 30$/ })).toBeInTheDocument();

    // Cancel to discard invalid edit
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /^Engineering FTE M01: 12$/ })).toBeInTheDocument();
  });
});
