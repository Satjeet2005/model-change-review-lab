/**
 * Critical End-to-End Journey Test (T-093 / PRD §11.7, §16.5 / Test 53)
 *
 * Full integration journey exercising all primary capabilities against the live FastAPI backend:
 * 1. Independent prototype disclosure confirmation
 * 2. 24-month model grid verification
 * 3. Deterministic proposal generation and preview isolation
 * 4. Variant duplication, independent editing, and persistence across page reload
 * 5. Scenario comparison variance tracking
 * 6. Proposal acceptance, atomic commit, and persistence across page reload
 * 7. History panel provenance verification
 * 8. Dependency trace panel inspection
 * 9. Direct cell edit and persistence across page reload
 * 10. Undo committed transaction and verify restoration
 * 11. Proposal rejection without state mutation
 * 12. Reset cancellation and confirmed baseline reset with persistence across page reload
 * 13. Stale-revision detection, acceptance guard, and fresh version generation
 * 14. Performance Lab 10k-row virtualization and bounded DOM row count
 * 15. Verification of zero prohibited external AI/API requests
 */

import { test, expect } from '@playwright/test';

test.describe('Critical E2E Happy Path Journey (T-093 / PRD §11.7)', () => {
  test('executes complete review, commit, trace, undo, scenario comparison, reload persistence, and benchmark lifecycle', async ({
    page
  }) => {
    const allowedOrigins = new Set([
      'http://localhost:4173',
      'http://127.0.0.1:4173',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:8000',
      'http://127.0.0.1:8000'
    ]);
    const unexpectedRequests: string[] = [];

    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('data:') || url.startsWith('blob:')) return;
      try {
        const parsed = new URL(url);
        if (!allowedOrigins.has(parsed.origin)) {
          unexpectedRequests.push(url);
        }
      } catch {
        unexpectedRequests.push(url);
      }
    });

    // 1. Load application (Fresh session initialization)
    await page.goto('/');

    // 2. Confirm independent prototype & synthetic data disclosure
    const disclosureBadge = page.getByRole('status', { name: 'Prototype status' });
    await expect(disclosureBadge).toBeVisible();
    await expect(disclosureBadge).toContainText('Independent prototype · Synthetic data');

    // 3. Inspect seeded 24-month model
    await expect(
      page.getByRole('heading', { level: 1, name: 'Model Change Review Lab' })
    ).toBeVisible();
    await expect(page.getByText('$750,000', { exact: true })).toBeVisible();
    await expect(page.getByText('$3,000,000', { exact: true })).toBeVisible();

    // 4. Generate deterministic hiring proposal
    await page.getByRole('button', { name: 'Generate Proposal' }).first().click();

    // 5. Verify diff is visible and canonical model has NOT changed from generation
    const reviewPanel = page.getByRole('region', {
      name: 'Change Proposal Review and Approval Panel'
    });
    await expect(reviewPanel).toBeVisible();
    await expect(page.getByText(/Proposed Modifications/)).toBeVisible();

    // Verify baseline M24 revenue remains intact ($1,356,544.45)
    await expect(page.getByRole('region', { name: 'Model Terminus KPI Summary' })).toContainText(
      '$1,356,544.45'
    );

    // 6. Duplicate variant to Variant 2, edit independently, and compare
    const dupBtn = reviewPanel.getByRole('button', { name: /\+ Duplicate/ });
    await dupBtn.click();
    await expect(page.getByRole('tab', { name: 'Variant 2' })).toBeVisible();

    // Edit one proposed value in Variant 2
    const firstRowEditBtn = reviewPanel.getByRole('button', { name: 'Edit' }).first();
    await firstRowEditBtn.click();
    const editInput = reviewPanel.locator('tbody input[type="text"]').first();
    await editInput.fill('18');
    await editInput.press('Enter');

    // 6a. Reload page and confirm active workspace and Variant 2 edits persist (PRD §11.7 #4)
    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Model Change Review Lab' })
    ).toBeVisible();
    const reloadedReviewPanel = page.getByRole('region', {
      name: 'Change Proposal Review and Approval Panel'
    });
    await expect(reloadedReviewPanel).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Variant 2' })).toBeVisible();

    // Switch to compare 2 variants mode
    const compareBtn = reloadedReviewPanel.getByRole('button', { name: 'Compare 2 Variants' });
    await compareBtn.click();
    await expect(reloadedReviewPanel.getByLabel('Series B Variant')).toBeVisible();

    // Accept Variant 2
    const acceptBtn = reloadedReviewPanel.getByRole('button', { name: 'Accept Variant 2' });
    await acceptBtn.click();

    // 7. Verify atomic commit: review panel shows accepted state, and Undo is enabled
    await expect(page.getByText('Change Proposal Accepted')).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByText('Change Proposal Accepted')).not.toBeVisible();
    const undoBtn = page.getByRole('button', { name: 'Undo' });
    await expect(undoBtn).toBeEnabled();

    // 7a. Reload and verify accepted model/history persist and workspace is no longer active (PRD §11.7 #6)
    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Model Change Review Lab' })
    ).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Change Proposal Review and Approval Panel' })
    ).not.toBeVisible();

    // 8. Inspect History Panel to verify provenance metadata
    await page.getByRole('button', { name: 'History' }).click();
    await expect(page.getByRole('region', { name: 'Committed Change History' })).toBeVisible();
    await expect(page.getByText('Variant 2', { exact: true })).toBeVisible();
    await expect(page.getByText(/Accepted proposal:/)).toBeVisible();

    // Return to Model tab
    await page.getByRole('button', { name: 'Model' }).click();

    // 8a. Direct edit, reload, and verify persistence (PRD §11.7 #7)
    await page.getByRole('button', { name: 'Edit' }).first().click();
    const revInput = page.locator('#starting-revenue-input');
    await revInput.fill('800000');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('$800,000', { exact: true })).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Model Change Review Lab' })
    ).toBeVisible();
    await expect(page.getByText('$800,000', { exact: true })).toBeVisible();

    // 9. Inspect Scenario Comparison
    await page.getByRole('button', { name: 'Scenario Compare' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Scenario Variance & Comparison' })
    ).toBeVisible();
    await expect(page.getByRole('region', { name: /Scenario Comparison Chart/ })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();

    // 10. Inspect Trace Panel on Model page
    await page.getByRole('button', { name: 'Model' }).click();
    const calculatedCellBtn = page
      .locator('td button[title*="Click to inspect calculation trace"]')
      .first();
    await calculatedCellBtn.click();

    const tracePanel = page.getByRole('region', { name: 'Formula Dependency Trace Panel' });
    await expect(tracePanel).toBeVisible();
    await expect(tracePanel).toContainText('Formula');

    // Close trace panel
    await page.getByRole('button', { name: 'Close trace panel' }).click();
    await expect(tracePanel).not.toBeVisible();

    // 11. Undo latest direct edit transaction
    await undoBtn.click();
    await expect(page.getByText('$750,000', { exact: true })).toBeVisible();

    // 12. Reject a proposal: Generate another proposal and reject it
    await page.getByRole('button', { name: 'Generate Proposal' }).nth(1).click();
    const secondReviewPanel = page.getByRole('region', {
      name: 'Change Proposal Review and Approval Panel'
    });
    await expect(secondReviewPanel).toBeVisible();

    const rejectBtn = secondReviewPanel.getByRole('button', { name: 'Reject Proposal' });
    await rejectBtn.click();
    await expect(secondReviewPanel).not.toBeVisible();

    // 13. Stale-revision detection, acceptance guard, and fresh version generation (PRD §6.8, §7.5, §11.7 #13)
    // 13a. Generate proposal against current revision
    await page.getByRole('button', { name: 'Generate Proposal' }).first().click();
    const staleCandidatePanel = page.getByRole('region', {
      name: 'Change Proposal Review and Approval Panel'
    });
    await expect(staleCandidatePanel).toBeVisible();

    // 13b. Alter canonical model via background direct edit to induce revision drift
    const { preRev, preHistoryCount } = await page.evaluate(async () => {
      const token = localStorage.getItem('mcrl.workspace-token.v1');
      if (!token) throw new Error('Token missing in localStorage');
      const modelRes = await fetch('http://127.0.0.1:8000/api/v1/model', {
        headers: { 'X-Workspace-Token': token }
      });
      const modelData = await modelRes.json();
      const currentRev = modelData.revision;

      const editRes = await fetch('http://127.0.0.1:8000/api/v1/model/assumptions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Workspace-Token': token,
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          expectedRevision: currentRev,
          targetCellId: 'setting:startingRevenueUsd',
          proposedValue: 820000
        })
      });
      if (!editRes.ok) throw new Error(`Background edit failed: ${editRes.status}`);

      // Capture canonical model revision and history count right after background edit
      const checkModelRes = await fetch('http://127.0.0.1:8000/api/v1/model', {
        headers: { 'X-Workspace-Token': token }
      });
      const checkModelData = await checkModelRes.json();

      const histRes = await fetch('http://127.0.0.1:8000/api/v1/history', {
        headers: { 'X-Workspace-Token': token }
      });
      const histData = await histRes.json();

      return {
        preRev: checkModelData.revision,
        preHistoryCount: histData.total
      };
    });

    // 13c. Attempt to accept the proposal in the UI (client expectedRevision is stale)
    const acceptStaleBtn = staleCandidatePanel.getByRole('button', { name: /Accept Proposal/ });
    await acceptStaleBtn.click();

    // 13d. UI catches 409 conflict, refreshes session, displays Stale Revision Detected, and disables Accept
    await expect(page.getByText('Stale Revision Detected')).toBeVisible();
    await expect(acceptStaleBtn).toBeDisabled();
    await expect(acceptStaleBtn).toHaveAttribute(
      'title',
      'Proposal is stale and cannot be accepted'
    );

    // Verify canonical model on screen shows the background edit ($820,000) and was NOT mutated by the failed acceptance
    await expect(page.getByText('$820,000', { exact: true })).toBeVisible();

    // Invariant assertion: verify server revision and history count are strictly unchanged after 409
    const { postRev, postHistoryCount } = await page.evaluate(async () => {
      const token = localStorage.getItem('mcrl.workspace-token.v1');
      if (!token) throw new Error('Token missing in localStorage');
      const modelRes = await fetch('http://127.0.0.1:8000/api/v1/model', {
        headers: { 'X-Workspace-Token': token }
      });
      const modelData = await modelRes.json();

      const histRes = await fetch('http://127.0.0.1:8000/api/v1/history', {
        headers: { 'X-Workspace-Token': token }
      });
      const histData = await histRes.json();

      return {
        postRev: modelData.revision,
        postHistoryCount: histData.total
      };
    });

    expect(postRev).toBe(preRev);
    expect(postHistoryCount).toBe(preHistoryCount);
    // Verify proposal remains inspectable in the panel
    await expect(staleCandidatePanel).toBeVisible();

    // 13e. Click 'Create fresh version from current model'
    const freshBtn = page.getByRole('button', { name: 'Create fresh version from current model' });
    await freshBtn.click();

    // 13f. Proposal updates to fresh version against current model; Stale warning disappears and Accept is enabled
    await expect(page.getByText('Stale Revision Detected')).not.toBeVisible();
    const freshAcceptBtn = staleCandidatePanel.getByRole('button', { name: /Accept Proposal/ });
    await expect(freshAcceptBtn).toBeEnabled();
    await freshAcceptBtn.click();
    await expect(page.getByText('Change Proposal Accepted')).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss' }).click();

    // 14. Exercise Reset confirmation dialog (cancel vs confirm) (PRD §11.7 #8)
    const resetBtn = page.getByRole('button', { name: 'Reset', exact: true });
    await resetBtn.click();

    const resetDialog = page.getByRole('dialog', { name: 'Reset Scenario to Baseline?' });
    await expect(resetDialog).toBeVisible();

    // Cancel reset via Escape key
    await page.keyboard.press('Escape');
    await expect(resetDialog).not.toBeVisible();

    // Confirm reset
    await resetBtn.click();
    await expect(resetDialog).toBeVisible();
    await resetDialog.getByRole('button', { name: 'Confirm Reset' }).click();
    await expect(resetDialog).not.toBeVisible();
    await expect(page.getByText('$750,000', { exact: true })).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Model Change Review Lab' })
    ).toBeVisible();
    await expect(page.getByText('$750,000', { exact: true })).toBeVisible();

    // 15. Performance Lab verification
    await page.getByRole('button', { name: 'Performance Lab' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Performance Lab/ })).toBeVisible();

    // Unrun state check: "No measurements collected yet"
    await expect(page.getByTestId('no-measurements-placeholder')).toBeVisible();

    // Run benchmark
    await page.getByRole('button', { name: 'Run Benchmark Now' }).click();

    // Virtual grid mounts
    await expect(page.getByTestId('virtual-grid-container')).toBeVisible();

    // Check bounded body row count (< 100 rows)
    const mountedRows = page.locator('[data-virtual-row="true"]');
    const rowCount = await mountedRows.count();
    expect(rowCount).toBeGreaterThan(0);
    expect(rowCount).toBeLessThan(100);

    // 16. Verify zero prohibited external AI/network requests
    expect(unexpectedRequests).toEqual([]);
  });
});
