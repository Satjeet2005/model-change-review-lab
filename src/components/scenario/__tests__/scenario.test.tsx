import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { AppProvider } from '@/state/AppProvider';
import { App } from '@/App';
import { createSeedAssumptions } from '@/domain/seed';
import { calculateModel } from '@/domain/calculation';
import { calculateScenarioDelta } from '@/domain/scenarioComparison';

describe('Scenario Variance & Comparison (T-076 / PRD §7.8 & §16.4 / Tests 45-46)', () => {
  it('pure calculateScenarioDelta function computes exact monthly deltas and cumulative revenue', () => {
    const seed = createSeedAssumptions();
    const baseline = calculateModel(seed);

    // Create working model with +2 eng FTE across M07-M24 (18 months)
    const workingAssumptions = createSeedAssumptions();
    for (let i = 6; i < 24; i++) {
      workingAssumptions.months[i]!.engineeringFte =
        workingAssumptions.months[i]!.engineeringFte + 2;
    }
    const working = calculateModel(workingAssumptions);

    const comparison = calculateScenarioDelta(baseline, working);

    // 24 periods for each calculated metric
    expect(comparison.metrics.revenue).toHaveLength(24);
    expect(comparison.metrics.ebitda).toHaveLength(24);
    expect(comparison.metrics.endingCash).toHaveLength(24);

    // M07 EBITDA delta: working is $24,000 less EBITDA (2 FTE * $12k)
    const m07Ebitda = comparison.metrics.ebitda[6]!;
    expect(m07Ebitda.period).toBe(7);
    expect(m07Ebitda.absoluteDelta).toBe(-24000);
    expect(m07Ebitda.percentageDelta).toBeDefined();

    // M24 ending cash delta: -$24,000 for 18 months = -$432,000
    expect(comparison.summary.m24EndingCashAbsoluteDelta).toBe(-432000);

    // Cumulative revenue: exactly the sum across all 24 monthly revenue values
    const manualSumRevenueBaseline = baseline.months.reduce((acc, m) => acc + m.revenue, 0);
    expect(Math.round(comparison.summary.cumulativeRevenueBaseline * 100) / 100).toBe(
      Math.round(manualSumRevenueBaseline * 100) / 100
    );
  });

  it('handles zero-baseline values safely without division by zero or NaN', () => {
    const seed = createSeedAssumptions();
    const baseline = calculateModel(seed);
    const working = calculateModel(seed);

    // Create synthetic zero baseline month in a cloned output
    const zeroMonthBaseline = {
      ...baseline,
      months: baseline.months.map((m, idx) => (idx === 0 ? { ...m, ebitda: 0 } : m))
    };

    const comparison = calculateScenarioDelta(zeroMonthBaseline, working);
    const m01Ebitda = comparison.metrics.ebitda[0]!;

    expect(m01Ebitda.baselineValue).toBe(0);
    expect(m01Ebitda.percentageDelta).toBeNull();
  });

  it('renders scenario comparison page when switching to Scenario Compare tab', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <App />
      </AppProvider>
    );

    const compareTab = screen.getByRole('button', { name: /^Scenario Compare$/ });
    await user.click(compareTab);

    // Page title and landmark
    expect(
      screen.getByRole('heading', { name: 'Scenario Variance & Comparison' })
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Comparison Metric Selector' })).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Scenario Comparison Summary Metrics' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Revenue Scenario Comparison Chart' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Revenue Monthly Variance Table' })
    ).toBeInTheDocument();
  });

  it('displays equal-difference state when baseline and working scenarios are identical', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <App />
      </AppProvider>
    );

    await user.click(screen.getByRole('button', { name: /^Scenario Compare$/ }));

    // Status announcement indicating scenarios are identical
    expect(screen.getByText('Baseline and working scenarios are identical')).toBeInTheDocument();

    // Variances table shows $0.00 across all periods
    const table = screen.getByRole('table');
    const zeroes = within(table).getAllByText('$0.00');
    expect(zeroes).toHaveLength(24);
  });

  it('switches between Revenue, EBITDA, and Ending Cash and updates chart and table from the same data', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <App />
      </AppProvider>
    );

    await user.click(screen.getByRole('button', { name: /^Scenario Compare$/ }));

    // Default is Revenue
    expect(
      screen.getByRole('region', { name: 'Revenue Scenario Comparison Chart' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Revenue Monthly Variance Table' })
    ).toBeInTheDocument();

    // Switch to EBITDA
    const ebitdaRadio = screen.getByRole('radio', { name: /EBITDA/ });
    await user.click(ebitdaRadio);

    expect(
      screen.getByRole('region', { name: 'EBITDA Scenario Comparison Chart' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'EBITDA Monthly Variance Table' })
    ).toBeInTheDocument();

    // Switch to Ending Cash
    const cashRadio = screen.getByRole('radio', { name: /Ending Cash/ });
    await user.click(cashRadio);

    expect(
      screen.getByRole('region', { name: 'Ending Cash Scenario Comparison Chart' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Ending Cash Monthly Variance Table' })
    ).toBeInTheDocument();
  });

  it('displays accurate monthly variances and cumulative totals after a proposal is accepted', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <App />
      </AppProvider>
    );

    // Accept "Hire 2 Engineers" proposal on Model tab
    const generateButtons = screen.getAllByRole('button', { name: 'Generate Proposal' });
    await user.click(generateButtons[0]!);
    const acceptBtn = await screen.findByRole('button', { name: 'Accept Proposal' });
    await user.click(acceptBtn);

    // Navigate to Scenario Compare tab
    await user.click(screen.getByRole('button', { name: /^Scenario Compare$/ }));

    // Summary cards reflect M24 Ending Cash variance of -$432,000
    const summaryRegion = screen.getByRole('region', {
      name: 'Scenario Comparison Summary Metrics'
    });
    expect(within(summaryRegion).getByText('-$432,000')).toBeInTheDocument();

    // Switch to EBITDA
    await user.click(screen.getByRole('radio', { name: /EBITDA/ }));

    // Variance table displays -$24,000 for periods M07 through M24
    const table = screen.getByRole('table');
    const negativeEbitdas = within(table).getAllByText('-$24,000');
    expect(negativeEbitdas).toHaveLength(18); // 18 months M07-M24

    // Periods M01 through M06 are unchanged
    const zeroes = within(table).getAllByText('$0.00');
    expect(zeroes).toHaveLength(6);
  });

  it('refreshes comparison immediately on undo and reset back to identical baseline state', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <App />
      </AppProvider>
    );

    // Accept proposal
    const generateButtons = screen.getAllByRole('button', { name: 'Generate Proposal' });
    await user.click(generateButtons[0]!);
    const acceptBtn = await screen.findByRole('button', { name: 'Accept Proposal' });
    await user.click(acceptBtn);

    // Check Compare tab has diff
    await user.click(screen.getByRole('button', { name: /^Scenario Compare$/ }));
    expect(screen.getByText('-$432,000')).toBeInTheDocument();

    // Click Undo in header
    const undoBtn = screen.getByRole('button', { name: /^Undo$/ });
    await user.click(undoBtn);

    // Comparison is immediately refreshed back to identical state
    expect(screen.getByText('Baseline and working scenarios are identical')).toBeInTheDocument();
    expect(screen.queryByText('-$432,000')).not.toBeInTheDocument();
  });

  it('passes automated axe accessibility scan without violations', async () => {
    const { container } = render(
      <AppProvider>
        <App />
      </AppProvider>
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^Scenario Compare$/ }));

    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
