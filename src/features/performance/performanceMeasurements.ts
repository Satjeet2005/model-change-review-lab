/**
 * Performance Lab Measurement Utilities (T-081, T-082 / FR-021 / PERF-002, PERF-003 / NFR-001)
 *
 * Implements honest, non-fabricated performance measurements using the Performance API.
 * Non-negotiable rules:
 * 1. Never invent, hardcode, or prepopulate measurement values.
 * 2. Unrun benchmarks report "Not measured yet".
 * 3. Failed/incomplete measurements report "Unavailable" with a clear reason, never "0 ms".
 * 4. At least 30 actual samples required before reporting edit latency p50/p95.
 * 5. Recompute measurement invokes canonical calculateModel from src/domain/calculation.ts
 *    with a 24-period model fixture, NEVER the synthetic dataset.
 */

import { calculateModel } from '@/domain/calculation';
import { createSeedAssumptions } from '@/domain/seed';
import {
  generateSyntheticDataset,
  DEFAULT_SYNTHETIC_SEED,
  DEFAULT_SYNTHETIC_ROWS,
  DEFAULT_SYNTHETIC_COLS,
  type SyntheticDataset
} from './SyntheticDataset';

export interface PercentileResult {
  readonly p50: number;
  readonly p95: number;
}

export interface RecomputeResult {
  readonly durationMs: number;
  readonly timestamp: number;
}

export interface BenchmarkMeasurements {
  readonly status: 'idle' | 'running' | 'completed' | 'error';
  readonly errorMessage: string | null;
  readonly datasetGenDurationMs: number | null;
  readonly gridReadyDurationMs: number | null;
  readonly renderedRowCount: number | null;
  readonly editSamples: readonly number[];
  readonly editPercentiles: PercentileResult | null;
  readonly recomputeDurationMs: number | null;
  readonly timestamp: number | null;
}

export const INITIAL_BENCHMARK_STATE: BenchmarkMeasurements = {
  status: 'idle',
  errorMessage: null,
  datasetGenDurationMs: null,
  gridReadyDurationMs: null,
  renderedRowCount: null,
  editSamples: [],
  editPercentiles: null,
  recomputeDurationMs: null,
  timestamp: null
};

/**
 * Diagnostic targets per PRD §12.6.
 * These are diagnostic reference targets for comparison, NOT guaranteed pass/fail thresholds.
 */
export const DIAGNOSTIC_TARGETS = {
  gridReadyMs: 500,
  editLatencyP95Ms: 100,
  maxVisibleRows: 100,
  modelRecomputeMs: 10
} as const;

/**
 * Accurately measures in-memory synthetic dataset generation time using performance.now().
 * Kept completely isolated from UI layout and React render cycles.
 */
export function measureDatasetGeneration(
  seed = DEFAULT_SYNTHETIC_SEED,
  rowCount = DEFAULT_SYNTHETIC_ROWS,
  columnCount = DEFAULT_SYNTHETIC_COLS
): { dataset: SyntheticDataset; durationMs: number } {
  const t0 = performance.now();
  const dataset = generateSyntheticDataset(seed, rowCount, columnCount);
  const t1 = performance.now();
  const durationMs = Math.round((t1 - t0) * 100) / 100;
  return { dataset, durationMs };
}

/**
 * Calculates p50 and p95 percentiles from an array of measured latency samples.
 * Returns null if fewer than 30 samples are provided (PRD §12.4).
 */
export function calculatePercentiles(samples: readonly number[]): PercentileResult | null {
  if (samples.length < 30) {
    return null;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;

  // p50 is median
  const p50Index = Math.floor(n * 0.5);
  const p50 = sorted[p50Index]!;

  // p95 is 95th percentile
  const p95Index = Math.min(n - 1, Math.floor(n * 0.95));
  const p95 = sorted[p95Index]!;

  return {
    p50: Math.round(p50 * 100) / 100,
    p95: Math.round(p95 * 100) / 100
  };
}

/**
 * Measures canonical financial model recalculation using pure calculateModel().
 * Uses the standard 24-period seed baseline fixture.
 * NEVER passes the 10,000-row synthetic dataset into this function.
 */
export function measureCanonicalRecompute(): RecomputeResult {
  const seedAssumptions = createSeedAssumptions();

  const t0 = performance.now();
  // Pure domain recalculation across 24 monthly periods
  calculateModel(seedAssumptions);
  const t1 = performance.now();

  const durationMs = Math.round((t1 - t0) * 100) / 100;
  return {
    durationMs,
    timestamp: Date.now()
  };
}

/**
 * Collects browser environment metadata for honest performance reporting.
 */
export interface EnvironmentMetadata {
  readonly userAgent: string;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly hardwareConcurrency: number | 'Unknown';
  readonly isProductionBuild: boolean;
}

export function getEnvironmentMetadata(): EnvironmentMetadata {
  const isProd =
    Boolean(import.meta.env?.PROD) ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js / jsdom',
    viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 1440,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 900,
    hardwareConcurrency:
      typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
        ? navigator.hardwareConcurrency
        : 'Unknown',
    isProductionBuild: isProd
  };
}
