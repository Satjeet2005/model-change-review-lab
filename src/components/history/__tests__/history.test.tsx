import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '@/state/AppProvider';
import { App } from '@/App';
import { createInitialState } from '@/state/appState';
import { appReducer } from '@/state/appReducer';
import { MockProposalProvider } from '@/domain/proposals';

describe('History, Undo & Reset Lifecycle (T-066 / PRD Tests 41-43 / FR-015, FR-017, FR-018)', () => {
  it('renders accessible empty history state when no changes have occurred', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <App />
      </AppProvider>
    );

    // Switch to History tab
    const historyTab = screen.getByRole('button', { name: /^History$/ });
    await user.click(historyTab);

    // Empty state announcement
    expect(screen.getByRole('region', { name: 'Committed Change History' })).toBeInTheDocument();
    expect(screen.getByText('No committed changes yet')).toBeInTheDocument();
    expect(
      screen.getByText(/The working scenario is currently identical to the baseline/)
    ).toBeInTheDocument();
  });

  it('records manual edits and accepted proposals newest first with correct types and descriptions', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <App />
      </AppProvider>
    );

    // 1. Commit manual edit on Starting Revenue in Model Baseline Settings
    const settingsHeading = screen.getByText('Model Baseline Settings').closest('div');
    const editRevenueBtn = within(settingsHeading!.parentElement!).getAllByRole('button', {
      name: 'Edit'
    })[0]!;
    await user.click(editRevenueBtn);

    const revInput = screen.getByLabelText(/Starting Revenue/);
    await user.clear(revInput);
    await user.type(revInput, '800000');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // 2. Generate and accept "Hire 2 Engineers" proposal
    const generateButtons = screen.getAllByRole('button', { name: 'Generate Proposal' });
    await user.click(generateButtons[0]!);

    const acceptBtn = await screen.findByRole('button', { name: 'Accept Proposal' });
    await user.click(acceptBtn);

    expect(await screen.findByText('✓ Change Proposal Accepted')).toBeInTheDocument();

    // 3. Switch to History tab
    const historyTab = screen.getByRole('button', { name: /^History$/ });
    await user.click(historyTab);

    const historyRegion = screen.getByRole('region', { name: 'Committed Change History' });
    expect(within(historyRegion).getByText('2 Transactions')).toBeInTheDocument();

    const articles = within(historyRegion).getAllByRole('article');
    expect(articles).toHaveLength(2);

    // Newest transaction (Proposal) is first
    expect(within(articles[0]!).getByText('Accepted Proposal')).toBeInTheDocument();
    expect(
      within(articles[0]!).getByText(/Accepted proposal: Hire 2 Engineers from Q3/)
    ).toBeInTheDocument();
    expect(within(articles[0]!).getByText(/Resulting Rev: 3/)).toBeInTheDocument();

    // Older transaction (Manual edit) is second
    expect(within(articles[1]!).getByText('Manual Edit')).toBeInTheDocument();
    expect(
      within(articles[1]!).getByText(/Manual edit to setting:startingRevenueUsd/)
    ).toBeInTheDocument();
    expect(within(articles[1]!).getByText(/Resulting Rev: 2/)).toBeInTheDocument();
  });

  it('undoes a manual edit, restores previous assumptions and recalculates derived model (PRD Test 41)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <App />
      </AppProvider>
    );

    const summaryHeading = screen.getByRole('region', { name: 'Model Terminus KPI Summary' });
    expect(summaryHeading).toHaveTextContent('$11,740,322.82');

    // Commit edit to Engineering FTE M01: change 12 -> 16 (+4 eng FTE)
    const engCell = screen.getByRole('button', { name: /^Engineering FTE M01: 12$/ });
    await user.click(engCell);
    const input = screen.getByRole('textbox', { name: 'Engineering FTE M01' });
    await user.clear(input);
    await user.type(input, '16{Enter}');

    // Working M24 ending cash drops from $11,740,322.82 to $11,692,322.82 due to higher payroll
    expect(screen.getAllByText('$11,692,322.82').length).toBeGreaterThanOrEqual(1);

    // Click Undo button in header
    const undoBtn = screen.getByRole('button', { name: /^Undo$/ });
    expect(undoBtn).not.toBeDisabled();
    await user.click(undoBtn);

    // Model is restored to original M24 Ending Cash
    expect(summaryHeading).toHaveTextContent('$11,740,322.82');
    expect(screen.getByRole('button', { name: /^Engineering FTE M01: 12$/ })).toBeInTheDocument();

    // Undo is now disabled as history is empty
    expect(undoBtn).toBeDisabled();
  });

  it('undoes an accepted multi-cell proposal atomically in one step (PRD Test 42)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <App />
      </AppProvider>
    );

    const summaryHeading = screen.getByRole('region', { name: 'Model Terminus KPI Summary' });
    expect(summaryHeading).toHaveTextContent('$11,740,322.82');

    // Accept proposal touching 18 cells (M07–M24)
    const generateButtons = screen.getAllByRole('button', { name: 'Generate Proposal' });
    await user.click(generateButtons[0]!);

    const acceptBtn = await screen.findByRole('button', { name: 'Accept Proposal' });
    await user.click(acceptBtn);

    expect(await screen.findByText('✓ Change Proposal Accepted')).toBeInTheDocument();
    expect(summaryHeading).toHaveTextContent('$11,308,322.82');

    // Click Undo: single undo must reverse ALL 18 modified monthly assumptions together
    const undoBtn = screen.getByRole('button', { name: /^Undo$/ });
    await user.click(undoBtn);

    // Model immediately returns to exactly $11,740,322.82
    expect(summaryHeading).toHaveTextContent('$11,740,322.82');

    // History is completely empty again
    expect(undoBtn).toBeDisabled();
  });

  it('advances revision monotonically on undo and prevents accepting stale proposal (PRD §6.8, §8.5, T-064)', async () => {
    const state0 = createInitialState();
    expect(state0.revision).toBe(1);

    // 1. Generate proposal at revision 1
    const proposal = await new MockProposalProvider().generateProposal(
      'hire-engineers-from-q3',
      state0.workingAssumptions,
      state0.revision
    );
    const state1 = appReducer(state0, { type: 'PROPOSAL_GENERATE_SUCCESS', proposal });
    expect(state1.pendingProposal?.baseRevision).toBe(1);

    // 2. Commit a manual edit -> revision 2
    const state2 = appReducer(state1, {
      type: 'DIRECT_EDIT_COMMIT',
      cellId: 'setting:startingRevenueUsd',
      rawValue: 800000
    });
    expect(state2.revision).toBe(2);

    // 3. Undo the manual edit -> revision advances monotonically to 3 (NOT back to 1)
    const state3 = appReducer(state2, { type: 'UNDO_LAST_TRANSACTION' });
    expect(state3.revision).toBe(3);
    // Working assumption values are restored
    expect(state3.workingAssumptions.startingRevenueUsd).toBe(750000);

    // 4. Attempting to accept proposal captured at revision 1 MUST fail as stale
    const state4 = appReducer(state3, { type: 'PROPOSAL_ACCEPT' });
    expect(state4.proposalError).toMatch(/stale proposal/i);
    expect(state4.proposalStatus).not.toBe('accepted');
  });

  it('canceling reset dialog preserves canonical state completely', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <App />
      </AppProvider>
    );

    // Make an edit
    const engCell = screen.getByRole('button', { name: /^Engineering FTE M01: 12$/ });
    await user.click(engCell);
    const input = screen.getByRole('textbox', { name: 'Engineering FTE M01' });
    await user.clear(input);
    await user.type(input, '16{Enter}');

    // Open Reset dialog
    const resetBtn = screen.getByRole('button', { name: /^Reset$/ });
    await user.click(resetBtn);

    expect(screen.getByRole('dialog', { name: /Reset Scenario to Baseline/ })).toBeInTheDocument();

    // Cancel reset
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelBtn);

    // Dialog closed, model remains edited at 16
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Engineering FTE M01: 16$/ })).toBeInTheDocument();
  });

  it('confirmed reset restores baseline model, advances revision, clears history and pending proposals (PRD Test 43)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <App />
      </AppProvider>
    );

    const summaryHeading = screen.getByRole('region', { name: 'Model Terminus KPI Summary' });

    // Make edit
    const engCell = screen.getByRole('button', { name: /^Engineering FTE M01: 12$/ });
    await user.click(engCell);
    const input = screen.getByRole('textbox', { name: 'Engineering FTE M01' });
    await user.clear(input);
    await user.type(input, '16{Enter}');

    // Working M24 ending cash drops to $11,692,322.82
    expect(screen.getAllByText('$11,692,322.82').length).toBeGreaterThanOrEqual(1);

    // Open reset dialog and confirm
    await user.click(screen.getByRole('button', { name: /^Reset$/ }));
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Reset' });
    await user.click(confirmBtn);

    // Working model restored to seed baseline
    expect(summaryHeading).toHaveTextContent('$11,740,322.82');
    expect(screen.getByRole('button', { name: /^Engineering FTE M01: 12$/ })).toBeInTheDocument();

    // Undo is disabled
    expect(screen.getByRole('button', { name: /^Undo$/ })).toBeDisabled();

    // Baseline remains untouched
    expect(screen.getByText('Base: $11,740,322.82')).toBeInTheDocument();
  });
});
