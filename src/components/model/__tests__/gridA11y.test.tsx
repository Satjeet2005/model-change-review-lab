import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { AppProvider } from '@/state/AppProvider';
import { ModelPage } from '@/pages/ModelPage';

describe('Model Grid Semantic Structure & Accessibility (T-041 / PRD Test 44)', () => {
  it('renders a real semantic table with row and column headers', () => {
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    // Table element (native table semantics per ADR-008 and PRD §29.6)
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    // 24 Month column headers
    for (let i = 1; i <= 24; i++) {
      const mStr = i < 10 ? `M0${i}` : `M${i}`;
      expect(screen.getByRole('columnheader', { name: mStr })).toBeInTheDocument();
    }

    // 5 Assumption row headers
    expect(screen.getByRole('rowheader', { name: 'Revenue Growth' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Engineering FTE' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Other FTE' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Cost per FTE ($)' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Other OpEx ($)' })).toBeInTheDocument();

    // 6 Calculated row headers
    expect(screen.getByRole('rowheader', { name: 'Revenue ($)' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Total FTE' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Payroll ($)' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Total OpEx ($)' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'EBITDA ($)' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Ending Cash ($)' })).toBeInTheDocument();
  });

  it('provides accessible names for all cell action buttons', () => {
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    // Editable assumption cell accessible name
    const engCell = screen.getByRole('button', {
      name: /^Engineering FTE M01: 12$/
    });
    expect(engCell).toHaveAccessibleName('Engineering FTE M01: 12');

    // Calculated output cell accessible name
    const revCell = screen.getByRole('button', {
      name: /^Revenue \(\$\) M01: \$768,750$/
    });
    expect(revCell).toHaveAccessibleName('Revenue ($) M01: $768,750');
  });

  it('updates trace selection status when a calculated cell is clicked', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    const ebitdaM07 = screen.getByRole('button', {
      name: /^EBITDA \(\$\) M07: \$243,514\.31$/
    });
    await user.click(ebitdaM07);

    // Selected trace cell notification banner is shown
    expect(screen.getByText('Selected Cell for Trace:')).toBeInTheDocument();
    expect(screen.getByText('calculated:ebitda:M07')).toBeInTheDocument();
  });

  it('passes automated axe accessibility scan without violations', async () => {
    const { container } = render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
