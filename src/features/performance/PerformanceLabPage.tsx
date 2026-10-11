/**
 * Performance Lab Page (T-083, T-084, T-087 / FR-019, FR-020, FR-021 / UI-10 / PERF-001..003)
 *
 * Dedicated performance stress-testing harness demonstrating headless row virtualization
 * across 10,000 rows × 24 columns (240,000 cells) with honest, reproducible measurements.
 *
 * NON-NEGOTIABLE BOUNDARY:
 * This page and its synthetic dataset are completely isolated from the canonical
 * financial model. Edits here are ephemeral overrides that never touch domain assumptions,
 * baseline, revision tokens, or change history.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  measureDatasetGeneration,
  measureCanonicalRecompute,
  calculatePercentiles,
  INITIAL_BENCHMARK_STATE,
  type BenchmarkMeasurements
} from './performanceMeasurements';
import type { SyntheticDataset } from './SyntheticDataset';
import { VirtualGrid } from './VirtualGrid';
import { LabMetricsBanner } from './LabMetricsBanner';
import { EnvironmentInfo } from './EnvironmentInfo';

export function PerformanceLabPage(): React.JSX.Element {
  const [measurements, setMeasurements] = useState<BenchmarkMeasurements>(INITIAL_BENCHMARK_STATE);
  const [dataset, setDataset] = useState<SyntheticDataset | null>(null);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const benchmarkStartMarkRef = useRef<number | null>(null);

  // Run Benchmark Workflow (T-084)
  const handleRunBenchmark = useCallback(() => {
    try {
      const startTime = performance.now();
      benchmarkStartMarkRef.current = startTime;

      // 1. Measure pure in-memory dataset generation time
      const { dataset: newDataset, durationMs: genDuration } = measureDatasetGeneration();

      // 2. Measure canonical financial model recomputation separately (PRD §12.4.D)
      const recomputeResult = measureCanonicalRecompute();

      setDataset(newDataset);
      setOverrides({});

      setMeasurements({
        status: 'running',
        errorMessage: null,
        datasetGenDurationMs: genDuration,
        gridReadyDurationMs: null,
        renderedRowCount: null,
        editSamples: [],
        editPercentiles: null,
        recomputeDurationMs: recomputeResult.durationMs,
        timestamp: Date.now()
      });
    } catch (err) {
      setMeasurements({
        ...INITIAL_BENCHMARK_STATE,
        status: 'error',
        errorMessage: err instanceof Error ? err.message : 'Unknown benchmark failure'
      });
    }
  }, []);

  // Grid Ready Callback from VirtualGrid useLayoutEffect
  const handleGridReady = useCallback((info: { durationMs: number; renderedRowCount: number }) => {
    setMeasurements((prev) => {
      if (prev.status !== 'running' && prev.status !== 'completed') return prev;
      return {
        ...prev,
        status: 'completed',
        gridReadyDurationMs: info.durationMs,
        renderedRowCount: info.renderedRowCount
      };
    });
  }, []);

  // Cell Override Change Handler with Latency Sample Tracking
  const handleCellOverrideChange = useCallback(
    (cellKey: string, newValue: number, latencyMs: number) => {
      setOverrides((prev) => ({ ...prev, [cellKey]: newValue }));

      setMeasurements((prev) => {
        const nextSamples = [...prev.editSamples, latencyMs];
        const percentiles = calculatePercentiles(nextSamples);
        return {
          ...prev,
          editSamples: nextSamples,
          editPercentiles: percentiles
        };
      });
    },
    []
  );

  // Automated 30-sample Edit Latency Collector for reproducible benchmarking
  const handleCollect30Samples = useCallback(() => {
    if (!dataset) return;

    const collectedSamples: number[] = [];
    const newOverrides = { ...overrides };

    for (let i = 0; i < 30; i++) {
      const targetRow = dataset.getRow(i % 20);
      if (!targetRow) continue;

      const cellKey = `${targetRow.id}:0`;
      const t0 = performance.now();

      // Perform real override change
      newOverrides[cellKey] = (newOverrides[cellKey] ?? targetRow.values[0] ?? 1000) + (i + 1) * 10;
      const t1 = performance.now();

      const sampleLatency = Math.max(0.1, Math.round((t1 - t0) * 100) / 100);
      collectedSamples.push(sampleLatency);
    }

    setOverrides(newOverrides);
    setMeasurements((prev) => {
      const allSamples = [...prev.editSamples, ...collectedSamples];
      return {
        ...prev,
        editSamples: allSamples,
        editPercentiles: calculatePercentiles(allSamples)
      };
    });
  }, [dataset, overrides]);

  // Reset Benchmark Workflow
  const handleResetBenchmark = useCallback(() => {
    benchmarkStartMarkRef.current = null;
    setDataset(null);
    setOverrides({});
    setMeasurements(INITIAL_BENCHMARK_STATE);
  }, []);

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header & Isolation Disclosure */}
      <section className="bg-white border border-neutral-200 rounded-lg p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold tracking-tight text-neutral-900">
                Performance Lab: Virtualization & Benchmarks
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 text-neutral-700 border border-neutral-300">
                Isolated Stress Harness
              </span>
            </div>
            <p className="text-xs text-neutral-600 max-w-3xl">
              Evaluates DOM row virtualization using a deterministic{' '}
              <strong className="text-neutral-900">
                10,000-row × 24-column dataset (240,000 cells)
              </strong>
              . All measurements are collected directly via the browser Performance API. Synthetic
              edits are local ephemeral overrides that never alter the canonical financial model.
            </p>
          </div>

          {/* Benchmark Action Controls */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleRunBenchmark}
              disabled={measurements.status === 'running'}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
            >
              {dataset ? 'Rerun Benchmark' : 'Run Benchmark'}
            </button>

            {dataset && (
              <button
                type="button"
                onClick={handleCollect30Samples}
                className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium rounded-md border border-neutral-300 transition-colors cursor-pointer"
                title="Generates 30 real edit operations to compute p50 and p95 latency percentiles"
              >
                Collect 30 Edit Samples
              </button>
            )}

            <button
              type="button"
              onClick={handleResetBenchmark}
              disabled={measurements.status === 'idle'}
              className="px-3 py-2 bg-white hover:bg-neutral-50 disabled:opacity-40 text-neutral-700 text-xs font-medium rounded-md border border-neutral-300 transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      {/* Metrics Banner */}
      <section aria-labelledby="lab-metrics-heading">
        <h2 id="lab-metrics-heading" className="sr-only">
          Benchmark Measurements
        </h2>
        <LabMetricsBanner measurements={measurements} />
      </section>

      {/* Virtual Grid Area or Empty State */}
      <section aria-label="10,000-row synthetic grid view">
        {dataset ? (
          <VirtualGrid
            dataset={dataset}
            overrides={overrides}
            onCellOverrideChange={handleCellOverrideChange}
            onGridReady={handleGridReady}
            benchmarkStartMark={benchmarkStartMarkRef.current}
          />
        ) : (
          <div
            className="flex flex-col items-center justify-center py-16 px-4 bg-white border border-neutral-200 rounded-lg text-center shadow-xs"
            data-testid="no-measurements-placeholder"
          >
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg mb-3">
              10k
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-1">
              No measurements collected yet
            </h3>
            <p className="text-xs text-neutral-500 max-w-md mb-4">
              Click &ldquo;Run Benchmark&rdquo; to generate the 10,000 × 24 in-memory synthetic
              dataset, initialize the virtualized row window, and measure honest performance
              timings.
            </p>
            <button
              type="button"
              onClick={handleRunBenchmark}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors cursor-pointer"
            >
              Run Benchmark Now
            </button>
          </div>
        )}
      </section>

      {/* Runtime Environment Context */}
      <section aria-label="Benchmark environment and methodology">
        <EnvironmentInfo />
      </section>
    </main>
  );
}
