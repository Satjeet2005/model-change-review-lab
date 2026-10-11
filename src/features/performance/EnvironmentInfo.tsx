/**
 * Performance Lab Environment & Methodology Context (T-086 / FR-021 / NFR-003 / UI-10)
 *
 * Surfaces runtime environment metadata and methodology notes to make performance
 * metrics transparent, honest, and reproducible.
 */

import React, { useState, useEffect } from 'react';
import { getEnvironmentMetadata, type EnvironmentMetadata } from './performanceMeasurements';

export function EnvironmentInfo(): React.JSX.Element {
  const [meta, setMeta] = useState<EnvironmentMetadata>(getEnvironmentMetadata());

  useEffect(() => {
    function handleResize() {
      setMeta(getEnvironmentMetadata());
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-xs text-neutral-600 space-y-3"
      aria-label="Benchmark environment and methodology notes"
      data-testid="environment-info"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-2">
        <span className="font-semibold text-neutral-800 uppercase tracking-wider text-[11px]">
          Runtime Environment & Execution Context
        </span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
            meta.isProductionBuild
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {meta.isProductionBuild
            ? 'Production Build'
            : 'Development Build (Timings exploratory only)'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <span className="text-neutral-500 block">Viewport Dimensions:</span>
          <span className="font-mono font-medium text-neutral-800">
            {meta.viewportWidth}px × {meta.viewportHeight}px
          </span>
        </div>
        <div>
          <span className="text-neutral-500 block">Logical CPU Cores:</span>
          <span className="font-mono font-medium text-neutral-800">
            {meta.hardwareConcurrency !== 'Unknown'
              ? `${meta.hardwareConcurrency} Cores`
              : 'Unknown'}
          </span>
        </div>
        <div>
          <span className="text-neutral-500 block">Virtualization Engine:</span>
          <span className="font-mono font-medium text-neutral-800">
            @tanstack/react-virtual (Headless Windowing)
          </span>
        </div>
      </div>

      <div className="pt-2 border-t border-neutral-200 text-[11px] text-neutral-500 space-y-1">
        <p>
          <strong className="text-neutral-700">User Agent:</strong>{' '}
          <span className="font-mono break-all">{meta.userAgent}</span>
        </p>
        <p>
          <strong className="text-neutral-700">Measurement Methodology:</strong> All metrics are
          collected directly using the browser Performance API (
          <code className="font-mono">performance.now()</code>, layout effect timing hooks).
          Missing, partial, or failed runs report as unmeasured/unavailable rather than false zeros.
          Diagnostic targets are reference objectives, not guaranteed thresholds across all end-user
          hardware.
        </p>
      </div>
    </div>
  );
}
