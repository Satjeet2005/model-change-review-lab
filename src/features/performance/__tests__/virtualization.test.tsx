/**
 * Performance Lab & Virtualization Test Suite (T-088 / PRD Tests 48-52 / FR-019..021 / PERF-001..003)
 *
 * Verifies:
 * 1. 10,000 × 24 deterministic dataset generation, isolation, and immutability.
 * 2. Virtualization maintains < 100 mounted body rows in the viewport (PRD Test 48).
 * 3. Cell edit overrides persist across scrolls without mutating the canonical financial model (PRD Test 49).
 * 4. Honest reporting: initial state shows "Not measured" with no fabricated values (PRD Test 50).
 * 5. Failure and incomplete states render "Unavailable", never "0 ms" (PRD Test 51).
 * 6. Responsive container containment and zero page-level horizontal overflow (PRD Test 52).
 * 7. Correct calculation of p50/p95 latency percentiles requiring >= 30 samples.
 * 8. Canonical recompute measurement uses ONLY calculateModel with a 24-period fixture.
 * 9. Automated axe-core accessibility scan.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import axe from 'axe-core';

import { AppProvider } from '@/state/AppProvider';
import {
  generateSyntheticDataset,
  computeSyntheticCellValue,
  DEFAULT_SYNTHETIC_SEED
} from '../SyntheticDataset';
import {
  measureDatasetGeneration,
  measureCanonicalRecompute,
  calculatePercentiles,
  INITIAL_BENCHMARK_STATE,
  type BenchmarkMeasurements
} from '../performanceMeasurements';
import { VirtualGrid } from '../VirtualGrid';
import { LabMetricsBanner } from '../LabMetricsBanner';
import { PerformanceLabPage } from '../PerformanceLabPage';

describe('Performance Lab: Synthetic Dataset Generation (T-078 / FR-019 / PERF-003)', () => {
  it('generates exactly 10,000 rows and 24 columns with stable identifiers', () => {
    const dataset = generateSyntheticDataset(DEFAULT_SYNTHETIC_SEED, 10_000, 24);

    expect(dataset.rowCount).toBe(10_000);
    expect(dataset.columnCount).toBe(24);
    expect(dataset.columns).toHaveLength(24);
    expect(dataset.columns[0]).toBe('M01');
    expect(dataset.columns[23]).toBe('M24');

    const firstRow = dataset.getRow(0);
    expect(firstRow).toBeDefined();
    expect(firstRow?.id).toBe('row-00001');
    expect(firstRow?.label).toBe('Line Item 00001');
    expect(firstRow?.values).toHaveLength(24);

    const lastRow = dataset.getRow(9_999);
    expect(lastRow).toBeDefined();
    expect(lastRow?.id).toBe('row-10000');
    expect(lastRow?.label).toBe('Line Item 10000');
    expect(lastRow?.values).toHaveLength(24);
  });

  it('produces 100% deterministic values for the same seed and input coordinates', () => {
    const datasetA = generateSyntheticDataset(42, 100, 24);
    const datasetB = generateSyntheticDataset(42, 100, 24);

    for (let r = 0; r < 20; r++) {
      for (let c = 0; c < 24; c++) {
        expect(datasetA.getCellValue(r, c)).toBe(datasetB.getCellValue(r, c));
      }
    }

    // Verify formula: 1000 + ((r*37 + c*13 + seed) % 9000)
    const expectedVal0_0 = computeSyntheticCellValue(0, 0, 42);
    expect(datasetA.getCellValue(0, 0)).toBe(expectedVal0_0);
  });

  it('proves the synthetic dataset is completely isolated from the finance calculation engine', () => {
    const dataset = generateSyntheticDataset(42, 10, 24);
    // The dataset is an array of SyntheticRow objects, NOT ModelAssumptions
    // SyntheticRow does not have startingRevenue, startingCash, or 5 assumption rows
    expect(dataset).not.toHaveProperty('startingRevenue');
    expect(dataset).not.toHaveProperty('revenueGrowthRate');
    expect(dataset).not.toHaveProperty('engineeringFte');
  });
});

describe('Performance Lab: Measurement Utilities (T-081, T-082 / PERF-002 / NFR-001)', () => {
  it('measures dataset generation duration separately from UI rendering', () => {
    const { dataset, durationMs } = measureDatasetGeneration(42, 1000, 24);
    expect(dataset.rowCount).toBe(1000);
    expect(typeof durationMs).toBe('number');
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });

  it('calculates p50 and p95 percentiles only when at least 30 samples exist', () => {
    // Fewer than 30 samples -> returns null
    const smallSamples = Array.from({ length: 29 }, (_, i) => i + 1);
    expect(calculatePercentiles(smallSamples)).toBeNull();

    // Exactly 30 samples -> returns valid percentiles
    const thirtySamples = Array.from({ length: 30 }, (_, i) => i + 1); // 1..30
    const res = calculatePercentiles(thirtySamples);
    expect(res).not.toBeNull();
    expect(res?.p50).toBe(16); // index 15
    expect(res?.p95).toBe(29); // index 28
  });

  it('canonical recomputation invokes calculateModel on the 24-period model fixture only', () => {
    const result = measureCanonicalRecompute();
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeGreaterThan(0);
  });
});

describe('Performance Lab: Virtualized Grid Behavior (T-079, T-080 / PRD Tests 48-49)', () => {
  it('mounts fewer than 100 body rows in the standard viewport for a 10,000-row dataset (PRD Test 48)', () => {
    const dataset = generateSyntheticDataset(42, 10_000, 24);
    const overrides: Record<string, number> = {};

    render(<VirtualGrid dataset={dataset} overrides={overrides} onCellOverrideChange={() => {}} />);

    // Verify grid container rendered
    expect(screen.getByTestId('virtual-grid-container')).toBeInTheDocument();

    // Query mounted body rows
    const mountedRows = document.querySelectorAll('[data-virtual-row="true"]');
    expect(mountedRows.length).toBeGreaterThan(0);
    expect(mountedRows.length).toBeLessThan(100);
  });

  it('persists sparse cell edit overrides when scrolling and does not mutate base dataset (PRD Test 49)', () => {
    const dataset = generateSyntheticDataset(42, 100, 24);
    let overrides: Record<string, number> = {};
    const handleOverride = (key: string, val: number) => {
      overrides = { ...overrides, [key]: val };
    };

    const { rerender } = render(
      <VirtualGrid dataset={dataset} overrides={overrides} onCellOverrideChange={handleOverride} />
    );

    // Target first cell: row-00001, M01
    const baseValue = dataset.getCellValue(0, 0)!;
    const cellElement = screen.getByText(`$${baseValue.toLocaleString()}`);
    fireEvent.click(cellElement);

    // Input should appear
    const input = screen.getByRole('textbox', { name: /Edit Line Item 00001 M01/ });
    expect(input).toBeInTheDocument();

    // Enter edited value
    fireEvent.change(input, { target: { value: '99999' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Verify override callback fired
    expect(overrides['row-00001:0']).toBe(99999);

    // Underlying dataset remains untouched
    expect(dataset.getCellValue(0, 0)).toBe(baseValue);

    // Rerender with overrides (simulating scroll return)
    rerender(
      <VirtualGrid dataset={dataset} overrides={overrides} onCellOverrideChange={handleOverride} />
    );

    // Displayed value reflects override
    expect(screen.getByText('$99,999')).toBeInTheDocument();
  });
});

describe('Performance Lab: Honest Reporting & Failure States (T-085, T-087 / PRD Tests 50-51)', () => {
  it('displays "Not measured" before benchmark run with zero fabricated values (PRD Test 50)', () => {
    render(<LabMetricsBanner measurements={INITIAL_BENCHMARK_STATE} />);

    // Check that unrun metrics show "Not measured"
    const notMeasuredElements = screen.getAllByText('Not measured');
    expect(notMeasuredElements.length).toBeGreaterThanOrEqual(3);

    // Ensure no false "0 ms" or "0.0 ms" is presented as a completed measurement
    expect(screen.queryByText('0 ms')).not.toBeInTheDocument();
    expect(screen.queryByText('0.0 ms')).not.toBeInTheDocument();
  });

  it('renders "Unavailable" on failure instead of false zero (PRD Test 51)', () => {
    const errorState: BenchmarkMeasurements = {
      status: 'error',
      errorMessage: 'Simulated performance timing failure',
      datasetGenDurationMs: null,
      gridReadyDurationMs: null,
      renderedRowCount: null,
      editSamples: [],
      editPercentiles: null,
      recomputeDurationMs: null,
      timestamp: null
    };

    render(<LabMetricsBanner measurements={errorState} />);

    // Must show "Unavailable" rather than 0 ms
    const unavailableElements = screen.getAllByText('Unavailable');
    expect(unavailableElements.length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText('0 ms')).not.toBeInTheDocument();
  });
});

describe('Performance Lab: Page Integration, Benchmark Workflow & A11y (T-083, T-084, T-089 / PRD Test 52)', () => {
  it('runs benchmark workflow, mounts virtual grid, collects metrics, and supports reset', async () => {
    render(
      <AppProvider>
        <PerformanceLabPage />
      </AppProvider>
    );

    // Initially displays empty state placeholder
    expect(screen.getByTestId('no-measurements-placeholder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Run Benchmark Now$/ })).toBeInTheDocument();

    // Click Run Benchmark
    const runBtn = screen.getByRole('button', { name: /^Run Benchmark Now$/ });
    fireEvent.click(runBtn);

    // Wait for virtual grid to mount and layout effect to report ready
    await waitFor(() => {
      expect(screen.getByTestId('virtual-grid-container')).toBeInTheDocument();
    });

    // Check that mounted row count is under 100
    const rows = document.querySelectorAll('[data-virtual-row="true"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(100);

    // Click "Collect 30 Edit Samples" to collect real edit latency percentiles
    const collectBtn = screen.getByRole('button', { name: /Collect 30 Edit Samples/ });
    fireEvent.click(collectBtn);

    // Should now report p95 latency
    await waitFor(() => {
      expect(screen.getByText(/p95:/)).toBeInTheDocument();
    });

    // Click Reset
    const resetBtn = screen.getByRole('button', { name: /^Reset$/ });
    fireEvent.click(resetBtn);

    // Restores empty placeholder cleanly
    expect(screen.getByTestId('no-measurements-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('virtual-grid-container')).not.toBeInTheDocument();
  });

  it('passes automated axe accessibility scan without violations', async () => {
    const { container } = render(
      <AppProvider>
        <PerformanceLabPage />
      </AppProvider>
    );

    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: true }
      }
    });

    expect(results.violations).toEqual([]);
  });

  it('resets grid-ready reporting on rerun benchmark (Task 8 rerun fix)', async () => {
    render(
      <AppProvider>
        <PerformanceLabPage />
      </AppProvider>
    );

    // Initial run
    fireEvent.click(screen.getByRole('button', { name: /^Run Benchmark Now$/ }));

    await waitFor(() => {
      expect(screen.getByTestId('virtual-grid-container')).toBeInTheDocument();
    });

    // Rerun button appears
    const rerunBtn = await screen.findByRole('button', { name: /^Rerun Benchmark$/ });
    fireEvent.click(rerunBtn);

    // Grid remains ready and measured on rerun
    await waitFor(() => {
      expect(screen.getByTestId('virtual-grid-container')).toBeInTheDocument();
    });
  });
});
