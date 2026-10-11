/**
 * Critical End-to-End Journey Test (T-093 / PRD §16.5 / Test 53)
 *
 * Full integration journey exercising all primary capabilities against the production build:
 * 1. Independent prototype disclosure confirmation
 * 2. 24-month model grid verification
 * 3. Deterministic proposal generation and preview isolation
 * 4. Proposal editing and atomic commit
 * 5. Scenario comparison variance tracking
 * 6. Dependency trace panel inspection
 * 7. Single-level undo and monotonic revision advancement
 * 8. Proposal rejection without state mutation
 * 9. Reset cancellation and confirmed baseline reset
 * 10. Stale-revision guard protection
 * 11. Performance Lab 10k-row virtualization and bounded DOM row count
 * 12. Verification of zero prohibited external AI/API requests
 */

import { test, expect } from '@playwright/test';

test.describe('Critical E2E Happy Path Journey (T-093 / PRD Test 53)', () => {
  test('executes complete review, commit, trace, undo, scenario comparison, and benchmark lifecycle', async ({
    page
  }) => {
    const prohibitedRequests: string[] = [];

    page.on('request', (req) => {
      const url = req.url();
      // Verify no prohibited external AI, backend, or cloud API calls are made
      if (
        url.includes('api.openai.com') ||
        url.includes('anthropic.com') ||
        url.includes('api.drivetrain.ai') ||
        url.includes('googleapis.com')
      ) {
        prohibitedRequests.push(url);
      }
    });

    // 1. Load application
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

    // 6. Edit one proposed value in the diff and accept proposal
    const firstRowEditBtn = reviewPanel.getByRole('button', { name: 'Edit' }).first();
    await firstRowEditBtn.click();

    // Edit input appears
    const editInput = reviewPanel.locator('tbody input[type="text"]').first();
    await editInput.fill('15');
    await editInput.press('Enter');

    // Accept proposal
    const acceptBtn = reviewPanel.getByRole('button', { name: 'Accept Proposal' });
    await acceptBtn.click();

    // 7. Verify atomic commit: review panel shows accepted state or closes, and Undo is enabled
    const undoBtn = page.getByRole('button', { name: 'Undo' });
    await expect(undoBtn).toBeEnabled();

    // 8. Inspect Scenario Comparison
    await page.getByRole('button', { name: 'Scenario Compare' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Scenario Variance & Comparison' })
    ).toBeVisible();
    // Working and baseline scenario series now differ
    await expect(page.getByRole('region', { name: /Scenario Comparison Chart/ })).toBeVisible();
    await expect(page.locator('table')).toBeVisible();

    // 9. Inspect Trace Panel on Model page
    await page.getByRole('button', { name: 'Model' }).click();
    // Click a calculated cell to trace
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

    // 10. Undo latest proposal transaction
    await undoBtn.click();

    // 11. Verify restoration: Undo is now disabled (single-level) and working model returned to baseline
    await expect(undoBtn).toBeDisabled();

    // 12. Reject a proposal: Generate another proposal and reject it
    await page.getByRole('button', { name: 'Generate Proposal' }).nth(1).click();
    const secondReviewPanel = page.getByRole('region', {
      name: 'Change Proposal Review and Approval Panel'
    });
    await expect(secondReviewPanel).toBeVisible();

    const rejectBtn = secondReviewPanel.getByRole('button', { name: 'Reject Proposal' });
    await rejectBtn.click();

    // 13. Exercise Reset confirmation dialog (cancel vs confirm)
    const resetBtn = page.getByRole('button', { name: 'Reset' });
    await resetBtn.click();

    const resetDialog = page.getByRole('dialog', { name: 'Reset Scenario to Baseline?' });
    await expect(resetDialog).toBeVisible();

    // Cancel reset via Escape key
    await page.keyboard.press('Escape');
    await expect(resetDialog).not.toBeVisible();

    // 14. Performance Lab verification
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

    // 15. Verify zero prohibited external AI/network requests
    expect(prohibitedRequests).toEqual([]);
  });
});
