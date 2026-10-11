/**
 * Automated Accessibility Smoke Tests (T-094 / PRD §16.4 / WCAG 2.2 AA)
 *
 * Scans all primary application views using @axe-core/playwright to enforce
 * zero critical or serious accessibility violations.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Automated Accessibility Audits (T-094 / WCAG 2.2 AA)', () => {
  test('scans Model Grid view for accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('h1');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('scans Proposal Review & Diff view for accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Generate Proposal' }).first().click();

    await page.waitForSelector(
      '[role="region"][aria-label="Change Proposal Review and Approval Panel"]'
    );

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
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
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('scans History Panel view for accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'History' }).click();
    await page.waitForSelector('main');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('scans Scenario Comparison page for accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Scenario Compare' }).click();
    await page.waitForSelector('table');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('scans Performance Lab view for accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Performance Lab' }).click();
    await page.waitForSelector('main');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
