import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '@/state/AppProvider';
import { createInitialState } from '@/state/appState';
import { ModelPage } from '@/pages/ModelPage';
import { HistoryPanel } from '@/components/history/HistoryPanel';
import { TransactionRecord } from '@/domain/types';

describe('Proposal Impact Preview, Variant Compare & Provenance (Tasks 5, 6, 7)', () => {
  it('renders 24-month horizon chart, metric selector, and ending cash disclosure caption', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    // Generate proposal
    const generateButtons = screen.getAllByRole('button', { name: 'Generate Proposal' });
    await user.click(generateButtons[0]!);

    // Switch to 24M Horizon Chart tab
    const chartTabBtn = await screen.findByRole('button', { name: '24M Horizon Chart' });
    await user.click(chartTabBtn);

    // Chart region appears
    const chartRegion = await screen.findByRole('region', {
      name: 'Revenue Proposal Impact Chart'
    });
    expect(chartRegion).toBeInTheDocument();
    expect(
      within(chartRegion).getByText('Original proposal vs. proposal base · revision 1')
    ).toBeInTheDocument();

    // Switch to Ending Cash metric
    const cashMetricBtn = within(chartRegion).getByRole('button', { name: 'Ending Cash' });
    await user.click(cashMetricBtn);

    // Ending Cash disclosure caption is rendered
    expect(
      screen.getByText(/Ending cash is a simplified roll-forward using EBITDA/i)
    ).toBeInTheDocument();
  });

  it('renders monthly data table with 24 periods and delta calculations', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    // Generate proposal
    const generateButtons = screen.getAllByRole('button', { name: 'Generate Proposal' });
    await user.click(generateButtons[0]!);

    // Switch to Monthly Data Table
    const tableTabBtn = await screen.findByRole('button', { name: 'Monthly Data Table' });
    await user.click(tableTabBtn);

    const tableRegion = await screen.findByRole('region', {
      name: 'Revenue Monthly Variance Table'
    });
    expect(tableRegion).toBeInTheDocument();

    const table = within(tableRegion).getByRole('table');
    // Check first period M01 and last period M24
    expect(within(table).getByText('M01')).toBeInTheDocument();
    expect(within(table).getByText('M24')).toBeInTheDocument();
  });

  it('compares 2 variants side-by-side with shared proposal base distinction', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    // Generate proposal
    const generateButtons = screen.getAllByRole('button', { name: 'Generate Proposal' });
    await user.click(generateButtons[0]!);

    // Duplicate to create Variant 2
    const dupBtn = await screen.findByRole('button', { name: /\+ Duplicate \(2 remaining\)/ });
    await user.click(dupBtn);

    // Compare 2 Variants button is now available in Impact Preview header
    const compareModeBtn = screen.getByRole('button', { name: 'Compare 2 Variants' });
    await user.click(compareModeBtn);

    // Switch to 24M Horizon Chart in compare mode
    const chartTabBtn = screen.getByRole('button', { name: '24M Horizon Chart' });
    await user.click(chartTabBtn);

    // Strict distinction title is rendered
    expect(
      screen.getByText('Proposal variants vs. shared proposal base · revision 1')
    ).toBeInTheDocument();

    // Sibling variant selector is rendered
    expect(screen.getByLabelText('Series B Variant')).toBeInTheDocument();
  });

  it('suppresses both impact chart and variance table when proposal is stale', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    // Generate proposal at revision 1
    const generateButtons = screen.getAllByRole('button', { name: 'Generate Proposal' });
    await user.click(generateButtons[0]!);

    expect(await screen.findByText('Base Revision: 1')).toBeInTheDocument();

    // Advance revision to 2 via setting edit
    const settingsHeading = screen.getByText('Model Baseline Settings').closest('div');
    const editRevenueBtn = within(settingsHeading!.parentElement!).getAllByRole('button', {
      name: 'Edit'
    })[0]!;
    await user.click(editRevenueBtn);
    const saveRevenueBtn = screen.getByRole('button', { name: 'Save' });
    await user.click(saveRevenueBtn);

    // Preview chart and table controls must be COMPLETELY suppressed
    expect(screen.queryByRole('button', { name: '24M Horizon Chart' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Monthly Data Table' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Summary Cards' })).not.toBeInTheDocument();

    // Explanatory notice is rendered
    expect(
      screen.getByText(
        /Proposal impact preview is unavailable because the working model has advanced/i
      )
    ).toBeInTheDocument();
  });

  it('renders variant provenance badge in HistoryPanel for accepted proposal transactions', () => {
    const dummyState = createInitialState();
    const mockHistory: TransactionRecord[] = [
      {
        id: 'tx-1',
        timestamp: new Date().toISOString(),
        kind: 'proposal-accepted',
        description: 'Accepted proposal: Hire 2 Engineers from Q3',
        affectedCellIds: ['assumption:engineeringFte:M07'],
        previousAssumptions: dummyState.workingAssumptions,
        newAssumptions: dummyState.workingAssumptions,
        resultingRevision: 2,
        provenance: {
          proposalWorkspaceId: 'ws-123',
          variantId: 'var-2',
          variantLabel: 'Variant 2',
          sourceTemplateId: 'hire-engineers-from-q3',
          baseRevision: 1
        }
      }
    ];

    render(<HistoryPanel history={mockHistory} />);

    expect(screen.getByText('Variant 2')).toBeInTheDocument();
    expect(screen.getByText('Accepted proposal: Hire 2 Engineers from Q3')).toBeInTheDocument();
  });
});
