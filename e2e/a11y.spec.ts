/**
 * Automated Accessibility Smoke Tests (T-094 / PRD §16.4 / WCAG 2.2 AA)
 *
 * Scans all primary application views using @axe-core/playwright to enforce
 * zero critical or serious accessibility violations against machine-detectable rules.
 *
 * Note on WCAG 2.2 AA conformance:
 * Automated Axe audits execute rule checks against machine-detectable criteria
 * (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa). Automated scans alone do not
 * independently prove full WCAG 2.2 AA compliance; comprehensive conformance
 * also requires manual verification of assistive tech behavior, keyboard focus
 * order, target size, reading flow, and cognitive load.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Shared WCAG tag set for automated accessibility scans.
 * Supported natively by axe-core 4.14.0+ and @axe-core/playwright 4.13.0+.
 */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

test.describe('Automated Accessibility Audits (T-094 / WCAG 2.2 AA)', () => {
  test('scans Model Grid view for accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h1');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('scans Proposal Review & Diff view (1 variant) for accessibility violations', async ({
    page
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Generate Proposal' }).first().click();

    await page.waitForSelector(
      '[role="region"][aria-label="Change Proposal Review and Approval Panel"]'
    );

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('scans Proposal Review Panel with 3 variants for accessibility violations and verifies tab-panel ARIA relationships', async ({
    page
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Generate Proposal' }).first().click();

    await page.waitForSelector(
      '[role="region"][aria-label="Change Proposal Review and Approval Panel"]'
    );

    // Duplicate twice to reach 3 variants
    const dupBtn = page.getByRole('button', { name: /\+ Duplicate/ });
    await dupBtn.click();
    await dupBtn.click();

    await expect(page.getByRole('tab', { name: 'Variant 3' })).toBeVisible();

    // 1. Verify all three tabs have unique IDs
    const tabs = page.getByRole('tab');
    const tabCount = await tabs.count();
    expect(tabCount).toBe(3);

    const tabIds: string[] = [];
    const panelIds: string[] = [];

    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      const tabId = await tab.getAttribute('id');
      expect(tabId).toBeTruthy();
      expect(tabIds).not.toContain(tabId!);
      tabIds.push(tabId!);

      // 2. Each tab's aria-controls points to exactly one existing element with role="tabpanel"
      const ariaControls = await tab.getAttribute('aria-controls');
      expect(ariaControls).toBeTruthy();
      const panel = page.locator(`#${ariaControls}`);
      await expect(panel).toHaveCount(1);
      await expect(panel).toHaveAttribute('role', 'tabpanel');

      // 3. Each panel's aria-labelledby points back to the correct tab
      await expect(panel).toHaveAttribute('aria-labelledby', tabId!);

      // 4. Each panel ID is unique
      expect(panelIds).not.toContain(ariaControls!);
      panelIds.push(ariaControls!);
    }

    // Helper to verify that exactly the expected tab is selected and its panel is active
    async function assertActiveTabAndPanel(expectedTabName: string) {
      for (let i = 0; i < tabCount; i++) {
        const tab = tabs.nth(i);
        const tabName = (await tab.textContent())?.trim();
        const tabId = await tab.getAttribute('id');
        const ariaControls = await tab.getAttribute('aria-controls');
        const panel = page.locator(`#${ariaControls}`);

        if (tabName === expectedTabName) {
          // 5. Exactly the selected variant's corresponding panel is visible and active
          await expect(tab).toHaveAttribute('aria-selected', 'true');
          await expect(panel).toBeVisible();
          await expect(panel).toHaveAttribute('tabindex', '0');
          await expect(panel).toHaveAttribute('aria-labelledby', tabId!);
        } else {
          await expect(tab).toHaveAttribute('aria-selected', 'false');
          await expect(panel).toBeHidden();
        }
      }

      // 9. Inactive panels do not expose editing controls as active content
      const reviewPanel = page.getByRole('region', {
        name: 'Change Proposal Review and Approval Panel'
      });
      await expect(reviewPanel.getByRole('table')).toHaveCount(1);
    }

    // Initial state after duplicating twice: Variant 3 is selected
    await assertActiveTabAndPanel('Variant 3');

    // 6. Selecting Original proposal updates the visible panel and relationships
    const origTab = page.getByRole('tab', { name: 'Original proposal' });
    await origTab.click();
    await assertActiveTabAndPanel('Original proposal');

    // 7. Selecting Variant 2 updates the visible panel and relationships
    const var2Tab = page.getByRole('tab', { name: 'Variant 2' });
    await var2Tab.click();
    await assertActiveTabAndPanel('Variant 2');

    // 8. Returning to Variant 3 restores the correct active panel and relationships
    const var3Tab = page.getByRole('tab', { name: 'Variant 3' });
    await var3Tab.click();
    await assertActiveTabAndPanel('Variant 3');

    // 10. Axe accessibility scan still reports zero violations
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('scans Proposal Review Panel in 2-variant comparison mode for accessibility violations', async ({
    page
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Generate Proposal' }).first().click();

    await page.waitForSelector(
      '[role="region"][aria-label="Change Proposal Review and Approval Panel"]'
    );

    // Duplicate once to enable compare mode
    await page.getByRole('button', { name: /\+ Duplicate/ }).click();
    await expect(page.getByRole('tab', { name: 'Variant 2' })).toBeVisible();

    // Toggle Compare 2 Variants mode
    const compareBtn = page.getByRole('button', { name: 'Compare 2 Variants' });
    await compareBtn.click();

    await expect(page.getByLabel('Series B Variant')).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('scans Proposal Review Panel in stale state for accessibility violations', async ({
    page
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Generate Proposal' }).first().click();

    await page.waitForSelector(
      '[role="region"][aria-label="Change Proposal Review and Approval Panel"]'
    );

    // Edit a grid cell to advance revision to 2, rendering proposal stale
    const cellBtn = page.getByRole('button', { name: /Engineering FTE M01/ });
    await cellBtn.click();
    const cellInput = page.getByRole('textbox', { name: /Engineering FTE M01/ });
    await cellInput.fill('16');
    await cellInput.press('Enter');

    // Stale notice must now be visible
    await expect(page.getByText('Stale Revision Detected')).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('scans Dependency Trace Panel for accessibility violations', async ({ page }) => {
    await page.goto('/');
    const calculatedCellBtn = page
      .locator('td button[title*="Click to inspect calculation trace"]')
      .first();
    await calculatedCellBtn.click();

    await page.waitForSelector('[role="region"][aria-label="Formula Dependency Trace Panel"]');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('scans History Panel view for accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'History' }).click();
    await page.waitForSelector('main');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('scans Scenario Comparison page for accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Scenario Compare' }).click();
    await page.waitForSelector('table');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('scans Performance Lab view for accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Performance Lab' }).click();
    await page.waitForSelector('main');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags([...WCAG_TAGS])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
