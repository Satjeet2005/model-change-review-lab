import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '@/state/AppProvider';
import { ModelPage } from '@/pages/ModelPage';
import { MockProposalProvider } from '@/domain/proposals';

describe('Proposal Workflow Lifecycle (T-055 / PRD Tests 34-40)', () => {
  it('renders all 3 preset proposal buttons with simulated AI disclaimer (FR-007)', () => {
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    expect(screen.getByText('Propose a Model Change')).toBeInTheDocument();
    expect(screen.getByText('Simulated AI proposal')).toBeInTheDocument();

    // 3 presets
    expect(screen.getByText('Hire 2 Engineers (Q3+)')).toBeInTheDocument();
    expect(screen.getByText('Accelerate Growth (Q3+)')).toBeInTheDocument();
    expect(screen.getByText('Reduce OpEx (M04+)')).toBeInTheDocument();
  });

  it('generates proposal, renders review panel & diff, and isolates preview without mutating canonical model (PRD Tests 34-35)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    // Initial M24 ending cash display in summary strip
    const summaryHeading = screen.getByRole('region', { name: 'Model Terminus KPI Summary' });
    expect(summaryHeading).toHaveTextContent('$11,740,322.82');

    // Click "Generate Proposal" on the first preset (Hire 2 Engineers)
    const generateButtons = screen.getAllByRole('button', { name: 'Generate Proposal' });
    await user.click(generateButtons[0]!);

    // Review panel appears
    expect(
      await screen.findByRole('region', { name: 'Change Proposal Review and Approval Panel' })
    ).toBeInTheDocument();
    expect(screen.getByText('Hire 2 Engineers from Q3')).toBeInTheDocument();
    expect(screen.getByText('Base Revision: 1')).toBeInTheDocument();

    // Canonical summary strip is STILL $11,740,322.82 (UNMUTATED)
    expect(summaryHeading).toHaveTextContent('$11,740,322.82');

    // Preview KPIs show delta impact (-$432,000 cash impact due to hiring 2 eng @ $12k/mo for 18 mos)
    expect(screen.getByText('Preview M24 Ending Cash')).toBeInTheDocument();
    expect(screen.getByText('-$432,000')).toBeInTheDocument();
  });

  it('rejects proposal without changing canonical model (PRD Test 36)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    // Generate proposal
    const generateButtons = screen.getAllByRole('button', { name: 'Generate Proposal' });
    await user.click(generateButtons[0]!);

    // Reject proposal
    const rejectBtn = await screen.findByRole('button', { name: 'Reject Proposal' });
    await user.click(rejectBtn);

    // Shows rejection notice
    expect(screen.getByText('Proposal Rejected')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The simulated proposal was discarded. No canonical assumptions, calculated outputs, or model revisions were altered.'
      )
    ).toBeInTheDocument();

    // Model Terminus remains unchanged
    const summary = screen.getByRole('region', { name: 'Model Terminus KPI Summary' });
    expect(summary).toHaveTextContent('$11,740,322.82');
  });

  it('accepts valid proposal and commits changes atomically into model grid (PRD Test 37)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    // Generate proposal
    const generateButtons = screen.getAllByRole('button', { name: 'Generate Proposal' });
    await user.click(generateButtons[0]!);

    // Accept proposal
    const acceptBtn = await screen.findByRole('button', { name: 'Accept Proposal' });
    await user.click(acceptBtn);

    // Acceptance confirmation banner
    expect(await screen.findByText('✓ Change Proposal Accepted')).toBeInTheDocument();

    // Canonical model is updated: M24 Ending cash drops from $11,740,322.82 by $432,000 to $11,308,322.82
    const summary = screen.getByRole('region', { name: 'Model Terminus KPI Summary' });
    expect(summary).toHaveTextContent('$11,308,322.82');
  });

  it('supports editing proposal operations before acceptance and commits edited values (PRD Test 38)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <ModelPage />
      </AppProvider>
    );

    // Generate "Hire 2 Engineers" proposal
    const generateButtons = screen.getAllByRole('button', { name: 'Generate Proposal' });
    await user.click(generateButtons[0]!);

    // Wait for review panel
    const reviewPanel = await screen.findByRole('region', {
      name: 'Change Proposal Review and Approval Panel'
    });

    // Locate first editable operation in diff table inside review panel
    const diffTable = within(reviewPanel).getByRole('table');
    const editBtns = within(diffTable).getAllByRole('button', { name: 'Edit' });
    await user.click(editBtns[0]!);

    // Change proposed M07 FTE to 18 (instead of default 16)
    const editInput = within(diffTable).getByRole('textbox');
    await user.clear(editInput);
    await user.type(editInput, '18');
    await user.click(within(diffTable).getByRole('button', { name: 'Done' }));

    // Preview recalculates dynamically with updated edit (-$456,000)
    expect(screen.getByText('-$456,000')).toBeInTheDocument();

    // Accept edited proposal
    const acceptBtn = within(reviewPanel).getByRole('button', { name: 'Accept Proposal' });
    await user.click(acceptBtn);

    expect(await screen.findByText('✓ Change Proposal Accepted')).toBeInTheDocument();

    // Model reflects the edited value (M07 Eng FTE is 18)
    const summary = screen.getByRole('region', { name: 'Model Terminus KPI Summary' });
    expect(summary).toHaveTextContent('$11,284,322.82');
  });

  it('detects stale proposal when revision changes and blocks acceptance (PRD Test 39 / FR-012)', async () => {
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

    // Now perform a manual edit to Starting Revenue in ModelSettings, advancing revision to 2
    // Look for Edit button in Model Baseline Settings region
    const settingsHeading = screen.getByText('Model Baseline Settings').closest('div');
    const editRevenueBtn = within(settingsHeading!.parentElement!).getAllByRole('button', {
      name: 'Edit'
    })[0]!;
    await user.click(editRevenueBtn);

    const saveRevenueBtn = screen.getByRole('button', { name: 'Save' });
    await user.click(saveRevenueBtn);

    // Proposal review panel immediately detects stale revision
    expect(await screen.findByText('Stale Proposal')).toBeInTheDocument();
    expect(screen.getByText('Stale Revision Detected')).toBeInTheDocument();

    // Accept button is disabled
    const acceptBtn = screen.getByRole('button', { name: 'Accept Proposal' });
    expect(acceptBtn).toBeDisabled();
  });

  it('handles provider error and allows dismissal without model mutation (NFR-005)', async () => {
    const user = userEvent.setup();
    const failingProvider = new MockProposalProvider();
    vi.spyOn(failingProvider, 'generateProposal').mockRejectedValueOnce(
      new Error('Simulated network failure')
    );

    render(
      <AppProvider>
        <ModelPage proposalProvider={failingProvider} />
      </AppProvider>
    );

    // Clicking generate on preset
    const generateButtons = screen.getAllByRole('button', { name: 'Generate Proposal' });
    await user.click(generateButtons[1]!);

    // Error banner appears
    expect(await screen.findByText('Proposal Generation Failed')).toBeInTheDocument();
    expect(screen.getByText('Simulated network failure')).toBeInTheDocument();

    // Dismiss error
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Proposal Generation Failed')).not.toBeInTheDocument();

    // Canonical summary is pristine
    const summary = screen.getByRole('region', { name: 'Model Terminus KPI Summary' });
    expect(summary).toHaveTextContent('$11,740,322.82');
  });

  describe('Proposal Workspace & Variant Management (Task 4)', () => {
    it('manages variant lifecycle: duplication up to 3, switching tabs, independent editing, and reset', async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <ModelPage />
        </AppProvider>
      );

      // Generate "Hire 2 Engineers" proposal
      const generateButtons = screen.getAllByRole('button', { name: 'Generate Proposal' });
      await user.click(generateButtons[0]!);

      expect(await screen.findByRole('tab', { name: 'Original proposal' })).toBeInTheDocument();

      // Duplicate button shows remaining slots
      const dupBtn = screen.getByRole('button', { name: /\+ Duplicate \(2 remaining\)/ });
      await user.click(dupBtn);

      // Variant 2 tab appears and is selected
      expect(screen.getByRole('tab', { name: 'Variant 2' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Variant 2' })).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // Duplicate again -> Variant 3
      const dupBtn2 = screen.getByRole('button', { name: /\+ Duplicate \(1 remaining\)/ });
      await user.click(dupBtn2);
      expect(screen.getByRole('tab', { name: 'Variant 3' })).toBeInTheDocument();

      // At 3 variants, duplicate button is disabled
      const dupBtn3 = screen.getByRole('button', { name: /\+ Duplicate \(0 remaining\)/ });
      expect(dupBtn3).toBeDisabled();
      expect(dupBtn3).toHaveAttribute('title', 'Maximum of 3 variants reached');

      // Edit Variant 3 operations
      const reviewPanel = screen.getByRole('region', {
        name: 'Change Proposal Review and Approval Panel'
      });
      const diffTable = within(reviewPanel).getByRole('table');
      const editBtns = within(diffTable).getAllByRole('button', { name: 'Edit' });
      await user.click(editBtns[0]!);

      const editInput = within(diffTable).getByRole('textbox');
      await user.clear(editInput);
      await user.type(editInput, '20');
      await user.click(within(diffTable).getByRole('button', { name: 'Done' }));

      // Switch back to Original proposal tab
      const origTab = screen.getByRole('tab', { name: 'Original proposal' });
      await user.click(origTab);

      // Original variant diff retains original proposed value (16) and does not have Variant 3's edit (20)
      const diffTableAfter = within(reviewPanel).getByRole('table');
      expect(within(diffTableAfter).queryByText('20')).not.toBeInTheDocument();
      expect(within(diffTableAfter).getAllByText('16').length).toBeGreaterThan(0);

      // Switch back to Variant 3 tab
      const var3Tab = screen.getByRole('tab', { name: 'Variant 3' });
      await user.click(var3Tab);
      expect(within(diffTableAfter).getByText('20')).toBeInTheDocument();

      // Reset edits restores Variant 3 back to creation snapshot (removes 20)
      const resetBtn = screen.getByRole('button', { name: 'Reset Variant' });
      await user.click(resetBtn);
      expect(within(diffTableAfter).queryByText('20')).not.toBeInTheDocument();

      // Remove Variant 3
      const removeVar3Btn = screen.getByRole('button', { name: 'Remove Variant 3' });
      await user.click(removeVar3Btn);

      // Variant 3 removed, Variant 2 and Original remain
      expect(screen.queryByRole('tab', { name: 'Variant 3' })).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Original proposal' })).toBeInTheDocument();
    });

    it('creates fresh version from current model when stale proposal is detected', async () => {
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

      // Stale warning and refresh button appears
      expect(await screen.findByText('Stale Revision Detected')).toBeInTheDocument();
      const freshBtn = screen.getByRole('button', {
        name: 'Create fresh version from current model'
      });

      // Click create fresh version
      await user.click(freshBtn);

      // Fresh proposal regenerated against revision 2
      expect(await screen.findByText('Base Revision: 2')).toBeInTheDocument();
      expect(screen.getByText('Current Revision: 2')).toBeInTheDocument();
      expect(screen.queryByText('Stale Revision Detected')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Accept Proposal' })).toBeEnabled();
    });
  });
});
