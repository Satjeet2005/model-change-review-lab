import React, { useMemo } from 'react';
import { useAppState } from '@/state/AppProvider';
import { calculateModel } from '@/domain/calculation';
import { formatCurrency, formatDelta } from '@/domain/formatting';
import { ModelSettings } from '@/components/model/ModelSettings';
import { ModelGrid } from '@/components/model/ModelGrid';

export function ModelPage(): React.JSX.Element {
  const { baselineAssumptions, calculatedWorkingModel, selectedTraceCellId, revision } =
    useAppState();

  // Baseline summary derived via pure calculation engine for honest comparison
  const baselineCalculated = useMemo(() => {
    return calculateModel(baselineAssumptions);
  }, [baselineAssumptions]);

  const workingSummary = calculatedWorkingModel.summary;
  const baseSummary = baselineCalculated.summary;

  const revDelta = workingSummary.m24Revenue - baseSummary.m24Revenue;
  const ebitdaDelta = workingSummary.m24Ebitda - baseSummary.m24Ebitda;
  const cashDelta = workingSummary.m24EndingCash - baseSummary.m24EndingCash;

  return (
    <div className="space-y-6">
      {/* 1. M24 Horizon Terminus Summary Strip */}
      <section
        aria-label="Model Terminus KPI Summary"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {/* M24 Revenue */}
        <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-xs">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              M24 Revenue
            </span>
            <span className="text-[11px] text-neutral-400">
              Base: {formatCurrency(baseSummary.m24Revenue)}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-neutral-900">
              {formatCurrency(workingSummary.m24Revenue)}
            </span>
            {revDelta !== 0 && (
              <span
                className={`text-xs font-mono font-medium px-1.5 py-0.5 rounded ${
                  revDelta > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {formatDelta(revDelta, 'currency')}
              </span>
            )}
          </div>
        </div>

        {/* M24 EBITDA */}
        <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-xs">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              M24 EBITDA
            </span>
            <span className="text-[11px] text-neutral-400">
              Base: {formatCurrency(baseSummary.m24Ebitda)}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span
              className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
                workingSummary.m24Ebitda < 0 ? 'text-red-600' : 'text-neutral-900'
              }`}
            >
              {formatCurrency(workingSummary.m24Ebitda)}
            </span>
            {ebitdaDelta !== 0 && (
              <span
                className={`text-xs font-mono font-medium px-1.5 py-0.5 rounded ${
                  ebitdaDelta > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {formatDelta(ebitdaDelta, 'currency')}
              </span>
            )}
          </div>
        </div>

        {/* M24 Ending Cash */}
        <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-xs">
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              M24 Ending Cash
            </span>
            <span className="text-[11px] text-neutral-400">
              Base: {formatCurrency(baseSummary.m24EndingCash)}
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span
              className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
                workingSummary.m24EndingCash < 0 ? 'text-red-600' : 'text-neutral-900'
              }`}
            >
              {formatCurrency(workingSummary.m24EndingCash)}
            </span>
            {cashDelta !== 0 && (
              <span
                className={`text-xs font-mono font-medium px-1.5 py-0.5 rounded ${
                  cashDelta > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}
              >
                {formatDelta(cashDelta, 'currency')}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 2. Trace Selection Notification (P2 Contract) */}
      {selectedTraceCellId && (
        <div
          role="status"
          className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">Selected Cell for Trace:</span>
            <code className="bg-white px-1.5 py-0.5 rounded border border-blue-300 font-mono">
              {selectedTraceCellId}
            </code>
          </div>
          <span className="text-neutral-500 text-[11px]">
            Revision {revision} · Full dependency trace graph visualizer launches in Phase 4
          </span>
        </div>
      )}

      {/* 3. Model Baseline Settings */}
      <ModelSettings />

      {/* 4. Semantic Financial Model Grid */}
      <ModelGrid />
    </div>
  );
}
