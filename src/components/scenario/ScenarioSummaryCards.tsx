import React from 'react';
import { ScenarioSummaryComparison } from '@/domain/types';
import { formatCurrency, formatDelta } from '@/domain/formatting';

export interface ScenarioSummaryCardsProps {
  summary: ScenarioSummaryComparison;
}

export function ScenarioSummaryCards({ summary }: ScenarioSummaryCardsProps): React.JSX.Element {
  return (
    <section
      role="region"
      aria-label="Scenario Comparison Summary Metrics"
      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
    >
      {/* 1. Cumulative Revenue Total (Sum across M01-M24) */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-xs">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Cumulative Revenue (M01–M24 Sum)
          </span>
          <span className="text-[11px] text-neutral-400">
            Base: {formatCurrency(summary.cumulativeRevenueBaseline)}
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-neutral-900">
            {formatCurrency(summary.cumulativeRevenueWorking)}
          </span>
          {summary.cumulativeRevenueAbsoluteDelta !== 0 && (
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs font-mono font-medium px-1.5 py-0.5 rounded ${
                  summary.cumulativeRevenueAbsoluteDelta > 0
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {formatDelta(summary.cumulativeRevenueAbsoluteDelta, 'currency')}
              </span>
              {summary.cumulativeRevenuePercentageDelta !== null && (
                <span
                  className={`text-[11px] font-mono ${
                    summary.cumulativeRevenuePercentageDelta > 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  ({summary.cumulativeRevenuePercentageDelta > 0 ? '+' : ''}
                  {summary.cumulativeRevenuePercentageDelta}%)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. M24 Ending Cash Balance */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-xs">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            M24 Ending Cash Balance
          </span>
          <span className="text-[11px] text-neutral-400">
            Base: {formatCurrency(summary.m24EndingCashBaseline)}
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <span
            className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
              summary.m24EndingCashWorking < 0 ? 'text-red-600' : 'text-neutral-900'
            }`}
          >
            {formatCurrency(summary.m24EndingCashWorking)}
          </span>
          {summary.m24EndingCashAbsoluteDelta !== 0 && (
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs font-mono font-medium px-1.5 py-0.5 rounded ${
                  summary.m24EndingCashAbsoluteDelta > 0
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {formatDelta(summary.m24EndingCashAbsoluteDelta, 'currency')}
              </span>
              {summary.m24EndingCashPercentageDelta !== null && (
                <span
                  className={`text-[11px] font-mono ${
                    summary.m24EndingCashPercentageDelta > 0 ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  ({summary.m24EndingCashPercentageDelta > 0 ? '+' : ''}
                  {summary.m24EndingCashPercentageDelta}%)
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
