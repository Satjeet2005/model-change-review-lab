import React from 'react';
import { CalculatedRowKey } from '@/domain/types';
import { ProposalVariantComparisonResult } from '@/domain/proposalComparison';
import { formatCurrency, formatDelta, formatInteger, formatPercentage } from '@/domain/formatting';

export interface ProposalImpactTableProps {
  comparison: ProposalVariantComparisonResult;
  selectedMetric: CalculatedRowKey;
  baseRevision: number;
  variantLabel: string;
  variantBLabel?: string;
}

export function ProposalImpactTable({
  comparison,
  selectedMetric,
  baseRevision,
  variantLabel,
  variantBLabel
}: ProposalImpactTableProps): React.JSX.Element {
  const metricSeries = comparison.metrics[selectedMetric];
  const isFte = metricSeries.unit === 'fte';
  const hasVariantB = Boolean(variantBLabel && comparison.variantBModel);

  function formatVal(val: number): string {
    if (isFte) return formatInteger(val);
    return formatCurrency(val);
  }

  function formatAbsDelta(delta: number): string {
    if (isFte) return formatDelta(delta, 'integer');
    return formatDelta(delta, 'currency');
  }

  return (
    <div
      role="region"
      aria-label={`${metricSeries.label} Monthly Variance Table`}
      className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 shadow-xs space-y-3"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-neutral-100 pb-2">
        <div>
          <h4 className="text-sm font-bold text-neutral-900 tracking-tight">
            {metricSeries.label} Monthly Breakdown &amp; Variances (M01–M24)
          </h4>
          <p className="text-xs text-neutral-500">
            Monthly values and variances relative to proposal base revision {baseRevision}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto border border-neutral-200 rounded-md">
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">
            {metricSeries.label} 24-month variance table comparing proposal base to {variantLabel}
          </caption>
          <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-700">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-semibold">
                Period
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold text-right">
                Base (Rev {baseRevision})
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold text-right">
                {variantLabel}
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold text-right">
                Absolute Delta
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold text-right">
                % Delta
              </th>
              {hasVariantB && (
                <>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">
                    {variantBLabel}
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">
                    Delta vs Base
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold text-right">
                    vs {variantLabel}
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {metricSeries.months.map((row) => {
              const pLabel = row.period < 10 ? `M0${row.period}` : `M${row.period}`;
              return (
                <tr key={row.period} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="px-3 py-2 font-mono font-medium text-neutral-800">{pLabel}</td>
                  <td className="px-3 py-2 font-mono tabular-nums text-right text-neutral-600">
                    {formatVal(row.baseValue)}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-right font-semibold text-neutral-900">
                    {formatVal(row.variantAValue)}
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-right font-medium">
                    <span
                      className={
                        row.variantAAbsoluteDelta > 0
                          ? 'text-green-700'
                          : row.variantAAbsoluteDelta < 0
                            ? 'text-red-700'
                            : 'text-neutral-500'
                      }
                    >
                      {formatAbsDelta(row.variantAAbsoluteDelta)}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums text-right text-neutral-600">
                    {row.variantAPercentageDelta !== null
                      ? formatPercentage(row.variantAPercentageDelta)
                      : '—'}
                  </td>
                  {hasVariantB && row.variantBValue !== undefined && (
                    <>
                      <td className="px-3 py-2 font-mono tabular-nums text-right font-semibold text-green-900">
                        {formatVal(row.variantBValue)}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-right font-medium">
                        <span
                          className={
                            (row.variantBAbsoluteDelta ?? 0) > 0
                              ? 'text-green-700'
                              : (row.variantBAbsoluteDelta ?? 0) < 0
                                ? 'text-red-700'
                                : 'text-neutral-500'
                          }
                        >
                          {formatAbsDelta(row.variantBAbsoluteDelta ?? 0)}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums text-right font-medium text-neutral-600">
                        {formatAbsDelta(row.variantBVsADelta ?? 0)}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
