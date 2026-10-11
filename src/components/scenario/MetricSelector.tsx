import React from 'react';

export type ComparisonMetricKey = 'revenue' | 'ebitda' | 'endingCash';

export interface MetricOption {
  key: ComparisonMetricKey;
  label: string;
  description: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export const COMPARISON_METRIC_OPTIONS: readonly MetricOption[] = [
  {
    key: 'revenue',
    label: 'Revenue',
    description: 'Monthly calculated revenue and compound growth impact'
  },
  {
    key: 'ebitda',
    label: 'EBITDA',
    description: 'Operating profitability after payroll and operating expenses'
  },
  {
    key: 'endingCash',
    label: 'Ending Cash',
    description: 'Cumulative cash balance at monthly close'
  }
];

export interface MetricSelectorProps {
  selectedMetric: ComparisonMetricKey;
  onSelectMetric: (metric: ComparisonMetricKey) => void;
}

export function MetricSelector({
  selectedMetric,
  onSelectMetric
}: MetricSelectorProps): React.JSX.Element {
  return (
    <div
      role="region"
      aria-label="Comparison Metric Selector"
      className="bg-white border border-neutral-200 rounded-lg p-3 sm:p-4 shadow-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
          Select Metric to Compare
        </span>
        <span className="text-xs text-neutral-500">
          Plots 24-month horizon for Baseline vs. Working Scenario
        </span>
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3"
        role="radiogroup"
        aria-label="Financial Metrics"
      >
        {COMPARISON_METRIC_OPTIONS.map((option) => {
          const isSelected = selectedMetric === option.key;

          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelectMetric(option.key)}
              className={`flex flex-col text-left p-3 rounded-md border transition-all cursor-pointer select-none ${
                isSelected
                  ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-400 text-blue-950 font-medium shadow-xs'
                  : 'bg-white border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 text-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-sm font-bold">{option.label}</span>
                {isSelected && (
                  <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 leading-snug">{option.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
