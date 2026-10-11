import React from 'react';
import { MetricDelta } from '@/domain/types';
import { formatCurrency, formatDelta } from '@/domain/formatting';
import { ComparisonMetricKey, COMPARISON_METRIC_OPTIONS } from './MetricSelector';

export interface ScenarioDeltaTableProps {
  metricKey: ComparisonMetricKey;
  data: readonly MetricDelta[];
}

export function ScenarioDeltaTable({
  metricKey,
  data
}: ScenarioDeltaTableProps): React.JSX.Element {
  const metricMeta =
    COMPARISON_METRIC_OPTIONS.find((m) => m.key === metricKey) ?? COMPARISON_METRIC_OPTIONS[0]!;

  return (
    <section
      role="region"
      aria-label={`${metricMeta.label} Monthly Variance Table`}
      className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 shadow-xs space-y-3"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-neutral-100 pb-2">
        <div>
          <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
            {metricMeta.label} Monthly Breakdown &amp; Variances
          </h2>
          <p className="text-xs text-neutral-500">
            Monthly values, absolute variances, and percentage deltas across M01–M24
          </p>
        </div>
      </div>

      <div className="overflow-x-auto border border-neutral-200 rounded-md">
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">
            {metricMeta.label} 24-month variance table comparing Baseline to Working scenario
          </caption>
          <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-700">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Period
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold text-right">
                Baseline Value
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold text-right">
                Working Scenario
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold text-right">
                Absolute Variance
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold text-right">
                % Delta
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {data.map((row) => {
              const periodLabel = row.period < 10 ? `M0${row.period}` : `M${row.period}`;
              const hasDiff = row.absoluteDelta !== 0;

              return (
                <tr key={row.period} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="px-3 py-2 font-mono font-medium text-neutral-800">
                    {periodLabel}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-right text-neutral-600">
                    {formatCurrency(row.baselineValue)}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-right text-neutral-900 font-semibold">
                    {formatCurrency(row.workingValue)}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-right font-medium">
                    {hasDiff ? (
                      <span className={row.absoluteDelta > 0 ? 'text-green-700' : 'text-red-700'}>
                        {formatDelta(row.absoluteDelta, 'currency')}
                      </span>
                    ) : (
                      <span className="text-neutral-400">$0.00</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-right">
                    {row.percentageDelta === null ? (
                      <span
                        className="text-neutral-400"
                        title="Baseline is zero; percentage delta undefined"
                      >
                        —
                      </span>
                    ) : (
                      <span
                        className={
                          row.percentageDelta > 0
                            ? 'text-green-700 font-medium'
                            : row.percentageDelta < 0
                              ? 'text-red-700 font-medium'
                              : 'text-neutral-400'
                        }
                      >
                        {row.percentageDelta > 0
                          ? `+${row.percentageDelta}%`
                          : `${row.percentageDelta}%`}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
