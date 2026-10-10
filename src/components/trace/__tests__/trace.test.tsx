import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '@/state/AppProvider';
import { ModelPage } from '@/pages/ModelPage';
import { createSeedAssumptions } from '@/domain/seed';
import { calculateModel } from '@/domain/calculation';
import { buildTraceIndex } from '@/domain/trace';

describe('Trace Panel & Dependency DAG (T-065 / PRD Test 47 / FR-014 / UI-08)', () => {
  it('trace index generated from seed model contains no dangling edges and all resolve to assumptions or settings', () => {
    const seed = createSeedAssumptions();
    const calculated = calculateModel(seed);
    const trace = buildTraceIndex(seed, calculated);

    for (const [id, node] of Object.entries(trace.nodes)) {
      expect(node.id).toBe(id);
      if (node.kind === 'calculated') {
        expect(node.inputIds.length).toBeGreaterThan(0);
        expect(node.formulaLabel).toBeDefined();
        for (const inputId of node.inputIds) {
          const inputNode = trace.nodes[inputId];
          expect(inputNode).toBeDefined();
        }
      } else {
        expect(node.inputIds).toHaveLength(0);
      }
    }
  });

  it('opens trace panel when calculated cell is selected, displays correct label, value, and formula', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    // Click calculated cell M01 EBITDA: $168,750
    const ebitdaCell = screen.getByRole('button', { name: /^EBITDA \(\$\) M01: \$168,750$/ });
    await user.click(ebitdaCell);

    // Trace panel opens
    expect(
      screen.getByRole('region', { name: 'Formula Dependency Trace Panel' })
    ).toBeInTheDocument();
    expect(screen.getAllByText('EBITDA (M01)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('calculated:ebitda:M01')).toBeInTheDocument();

    // Direct formula and dependencies
    expect(screen.getByText('= Revenue − Total Operating Expense (M01)')).toBeInTheDocument();
    expect(screen.getByText('Revenue (M01)')).toBeInTheDocument();
    expect(screen.getByText('Total Operating Expense (M01)')).toBeInTheDocument();
  });

  it('recursively renders DAG until terminal assumption and setting nodes are reached', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    // Select Payroll M01
    const payrollCell = screen.getByRole('button', { name: /^Payroll \(\$\) M01: \$360,000$/ });
    await user.click(payrollCell);

    const tracePanel = screen.getByRole('region', { name: 'Formula Dependency Trace Panel' });
    expect(tracePanel).toBeInTheDocument();

    // Intermediate calculated Total FTE
    expect(screen.getByText('Total FTE (M01)')).toBeInTheDocument();
    expect(screen.getByText('= Engineering FTE + Other FTE (M01)')).toBeInTheDocument();

    // Terminal assumptions reached
    expect(screen.getByText('Engineering FTE (M01)')).toBeInTheDocument();
    expect(screen.getByText('Other FTE (M01)')).toBeInTheDocument();
    expect(screen.getByText('Cost per FTE (M01)')).toBeInTheDocument();

    // Terminal indicators rendered
    const terminalMarkers = screen.getAllByText(/↳ Terminal input/);
    expect(terminalMarkers.length).toBeGreaterThan(0);
  });

  it('closes trace panel using accessible close button', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    const ebitdaCell = screen.getByRole('button', { name: /^EBITDA \(\$\) M01: \$168,750$/ });
    await user.click(ebitdaCell);

    expect(
      screen.getByRole('region', { name: 'Formula Dependency Trace Panel' })
    ).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: 'Close Trace Panel' });
    await user.click(closeBtn);

    expect(
      screen.queryByRole('region', { name: 'Formula Dependency Trace Panel' })
    ).not.toBeInTheDocument();
  });

  it('keeps trace values synchronized with working model after manual edit', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    // Select Total FTE M01 (initially 30)
    const fteCell = screen.getByRole('button', { name: /^Total FTE M01: 30$/ });
    await user.click(fteCell);

    const tracePanel = screen.getByRole('region', { name: 'Formula Dependency Trace Panel' });
    expect(tracePanel).toBeInTheDocument();
    expect(screen.getAllByText('Total FTE (M01)').length).toBeGreaterThanOrEqual(1);

    // Now edit Engineering FTE M01 from 12 to 14
    const engCell = screen.getByRole('button', { name: /^Engineering FTE M01: 12$/ });
    await user.click(engCell);

    const input = screen.getByRole('textbox', { name: 'Engineering FTE M01' });
    await user.clear(input);
    await user.type(input, '14{Enter}');

    // Trace reflects new recomputed Total FTE: 14 + 18 = 32
    expect(screen.getAllByText('32').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Synchronized with working scenario at revision/)).toHaveTextContent(
      '2'
    );
  });
});
