/**
 * Performance Lab Metrics Banner (T-085, T-087 / FR-021 / NFR-003 / UI-10)
 *
 * Displays independently measured performance metrics alongside diagnostic targets.
 * Adheres strictly to the honest measurement invariant:
 * - Shows "Not measured" before benchmark is run.
 * - Shows "Unavailable" on failure, never "0 ms".
 * - Shows sample count for edit latency and requires >= 30 samples for p50/p95.
 * - Clearly distinguishes diagnostic targets from observed values.
 */

import React from 'react';
import { DIAGNOSTIC_TARGETS, type BenchmarkMeasurements } from './performanceMeasurements';

export interface LabMetricsBannerProps {
  readonly measurements: BenchmarkMeasurements;
}

export function LabMetricsBanner({ measurements }: LabMetricsBannerProps): React.JSX.Element {
  const isIdle = measurements.status === 'idle';
  const isError = measurements.status === 'error';

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
      aria-label="Performance benchmark results"
      data-testid="lab-metrics-banner"
    >
      {/* 1. Dataset Generation Time */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
            <span>Dataset Generation</span>
            <span className="text-neutral-400 font-normal lowercase">in-memory</span>
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900 tracking-tight my-1">
            {isError ? (
              <span className="text-sm font-normal text-red-600">Unavailable</span>
            ) : isIdle || measurements.datasetGenDurationMs === null ? (
              <span className="text-sm font-normal text-neutral-400">Not measured</span>
            ) : (
              `${measurements.datasetGenDurationMs.toFixed(1)} ms`
            )}
          </div>
        </div>
        <div className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-100 flex items-center justify-between">
          <span>Target: diagnostic</span>
          <span className="text-neutral-600 font-medium">10,000 × 24 cells</span>
        </div>
      </div>

      {/* 2. Time to Grid Ready */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
            <span>Grid Ready Time</span>
            <span className="text-neutral-400 font-normal lowercase">&lt; 500ms target</span>
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900 tracking-tight my-1">
            {isError ? (
              <span className="text-sm font-normal text-red-600">Unavailable</span>
            ) : isIdle || measurements.gridReadyDurationMs === null ? (
              <span className="text-sm font-normal text-neutral-400">Not measured</span>
            ) : (
              `${measurements.gridReadyDurationMs.toFixed(1)} ms`
            )}
          </div>
        </div>
        <div className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-100 flex items-center justify-between">
          <span>Target: &lt; {DIAGNOSTIC_TARGETS.gridReadyMs} ms</span>
          <span className="text-neutral-600 font-medium">Click → Layout</span>
        </div>
      </div>

      {/* 3. Rendered DOM Row Count */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
            <span>Mounted Rows</span>
            <span className="text-neutral-400 font-normal lowercase">&lt; 100 target</span>
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900 tracking-tight my-1">
            {isError ? (
              <span className="text-sm font-normal text-red-600">Unavailable</span>
            ) : isIdle || measurements.renderedRowCount === null ? (
              <span className="text-sm font-normal text-neutral-400">Not measured</span>
            ) : (
              `${measurements.renderedRowCount} rows`
            )}
          </div>
        </div>
        <div className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-100 flex items-center justify-between">
          <span>Target: &lt; {DIAGNOSTIC_TARGETS.maxVisibleRows} rows</span>
          <span className="text-neutral-600 font-medium">Virtual window</span>
        </div>
      </div>

      {/* 4. Canonical Model Recompute */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
            <span>Model Recompute</span>
            <span className="text-neutral-400 font-normal lowercase">&lt; 10ms target</span>
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-900 tracking-tight my-1">
            {isError ? (
              <span className="text-sm font-normal text-red-600">Unavailable</span>
            ) : isIdle || measurements.recomputeDurationMs === null ? (
              <span className="text-sm font-normal text-neutral-400">Not measured</span>
            ) : (
              `${measurements.recomputeDurationMs.toFixed(2)} ms`
            )}
          </div>
        </div>
        <div className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-100 flex items-center justify-between">
          <span>Target: &lt; {DIAGNOSTIC_TARGETS.modelRecomputeMs} ms</span>
          <span className="text-neutral-600 font-medium">24-month engine</span>
        </div>
      </div>

      {/* 5. Edit Keystroke Latency */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
            <span>Edit Latency (p95)</span>
            <span className="text-neutral-400 font-normal lowercase">30+ samples</span>
          </div>
          <div className="text-xl font-bold font-mono text-neutral-900 tracking-tight my-1">
            {isError ? (
              <span className="text-sm font-normal text-red-600">Unavailable</span>
            ) : measurements.editPercentiles ? (
              <span>p95: {measurements.editPercentiles.p95.toFixed(1)} ms</span>
            ) : measurements.editSamples.length > 0 ? (
              <span className="text-xs font-medium text-amber-700">
                {measurements.editSamples.length} / 30 samples
              </span>
            ) : (
              <span className="text-sm font-normal text-neutral-400">0 / 30 samples</span>
            )}
          </div>
        </div>
        <div className="text-[11px] text-neutral-500 pt-2 border-t border-neutral-100 flex items-center justify-between">
          <span>Target: &lt; {DIAGNOSTIC_TARGETS.editLatencyP95Ms} ms</span>
          <span className="text-neutral-600 font-medium">
            {measurements.editPercentiles
              ? `p50: ${measurements.editPercentiles.p50.toFixed(1)}ms (${measurements.editSamples.length})`
              : `${measurements.editSamples.length} collected`}
          </span>
        </div>
      </div>
    </div>
  );
}
