import React, { useMemo } from 'react';
import { useAppState } from '@/state/AppProvider';
import { calculateModel } from '@/domain/calculation';
import { formatCurrency, formatDelta } from '@/domain/formatting';
import { ProposalPromptSelector } from '@/components/proposals/ProposalPromptSelector';
import { ProposalReviewPanel } from '@/components/proposals/ProposalReviewPanel';
import { TracePanel } from '@/components/trace/TracePanel';
import { ModelSettings } from '@/components/model/ModelSettings';
import { ModelGrid } from '@/components/model/ModelGrid';

import { MockProposalProvider } from '@/domain/proposals';

export interface ModelPageProps {
  proposalProvider?: MockProposalProvider;
}

export function ModelPage({ proposalProvider }: ModelPageProps = {}): React.JSX.Element {
  const { baselineAssumptions, calculatedWorkingModel } = useAppState();

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

      {/* 2. Propose a Change Panel (PRD §7.3 Item 3) */}
      <ProposalPromptSelector provider={proposalProvider} />

      {/* 3. Proposal Review Panel (PRD §7.3 Item 4, conditional on active proposal) */}
      <ProposalReviewPanel proposalProvider={proposalProvider} />

      {/* 4. Trace Panel (PRD §7.7) */}
      <TracePanel />

      {/* 5. Model Baseline Settings */}
      <ModelSettings />

      {/* 6. Semantic Financial Model Grid */}
      <ModelGrid />
    </div>
  );
}
