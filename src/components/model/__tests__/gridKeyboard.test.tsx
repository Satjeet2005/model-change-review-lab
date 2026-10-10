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

  it('navigates focus between adjacent cells using directional arrow keys', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    const m01EngBtn = screen.getByRole('button', { name: /^Engineering FTE M01: 12$/ });
    act(() => {
      m01EngBtn.focus();
    });
    expect(document.activeElement).toBe(m01EngBtn);

    // Arrow Down -> Other FTE M01
    await user.keyboard('{ArrowDown}');
    const m01OtherBtn = screen.getByRole('button', { name: /^Other FTE M01: 18$/ });
    expect(document.activeElement).toBe(m01OtherBtn);

    // Arrow Right -> Other FTE M02
    await user.keyboard('{ArrowRight}');
    const m02OtherBtn = screen.getByRole('button', { name: /^Other FTE M02: 18$/ });
    expect(document.activeElement).toBe(m02OtherBtn);
  });

  it('preserves edit mode and allows caret movement when arrow keys are pressed inside input', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    const m01EngBtn = screen.getByRole('button', { name: /^Engineering FTE M01: 12$/ });
    act(() => {
      m01EngBtn.focus();
    });
    await user.keyboard('{Enter}');

    const input = screen.getByRole('textbox', { name: 'Engineering FTE M01' });
    await user.clear(input);
    await user.type(input, '15');

    // Arrow keys inside input do NOT commit or move focus away
    await user.keyboard('{ArrowLeft}{ArrowRight}');
    expect(screen.getByRole('textbox', { name: 'Engineering FTE M01' })).toBeInTheDocument();
    expect(input).toHaveValue('15');

    // Cancel edit
    await user.keyboard('{Escape}');
  });

  it('dispatches trace selection when Enter or Space is pressed on calculated cell', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    const ebitdaCell = screen.getByRole('button', { name: /^EBITDA \(\$\) M01: \$168,750$/ });
    act(() => {
      ebitdaCell.focus();
    });

    // Press Space
    await user.keyboard(' ');
    expect(screen.getByText('Selected Cell for Trace:')).toBeInTheDocument();
    expect(screen.getByText('calculated:ebitda:M01')).toBeInTheDocument();

    // Focus another calculated cell and press Enter
    const revCell = screen.getByRole('button', { name: /^Revenue \(\$\) M01: \$768,750$/ });
    act(() => {
      revCell.focus();
    });
    await user.keyboard('{Enter}');
    expect(screen.getByText('calculated:revenue:M01')).toBeInTheDocument();
  });

  it('handles grid boundary navigation predictably without escaping bounds', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    // Revenue Growth M01 is at (0, 0) - top-left boundary
    const topLeftBtn = screen.getByRole('button', { name: /^Revenue Growth M01: 2\.5%$/ });
    act(() => {
      topLeftBtn.focus();
    });

    // ArrowUp at top boundary stays on top cell
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(topLeftBtn);

    // ArrowLeft at left boundary stays on left cell
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(topLeftBtn);
  });

  it('commits valid edit and advances to next editable cell on Tab', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    // Start editing Revenue Growth M01 (Row 0, Col 0)
    const revGrowthBtn = screen.getByRole('button', { name: /^Revenue Growth M01: 2\.5%$/ });
    act(() => {
      revGrowthBtn.focus();
    });
    await user.keyboard('{Enter}');

    const input = screen.getByRole('textbox', { name: 'Revenue Growth M01' });
    await user.clear(input);
    await user.type(input, '3.0%');

    // Press Tab: commits and advances to Engineering FTE M01 (Row 1, Col 0)
    await user.keyboard('{Tab}');

    // Revenue Growth M01 updated
    expect(screen.getByRole('button', { name: /^Revenue Growth M01: 3\.0%$/ })).toBeInTheDocument();

    // Focus advanced to Engineering FTE M01
    const nextBtn = screen.getByRole('button', { name: /^Engineering FTE M01: 12$/ });
    expect(document.activeElement).toBe(nextBtn);
  });
});
