import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { CalculatedRowKey } from '@/domain/types';
import { ProposalVariantComparisonResult } from '@/domain/proposalComparison';
import { formatCurrency, formatInteger } from '@/domain/formatting';

export interface ProposalImpactChartProps {
  comparison: ProposalVariantComparisonResult;
  selectedMetric: CalculatedRowKey;
  onSelectMetric: (metric: CalculatedRowKey) => void;
  baseRevision: number;
  variantLabel: string;
  variantBLabel?: string;
}

const IMPACT_METRIC_OPTIONS: { key: CalculatedRowKey; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'endingCash', label: 'Ending Cash' }
];

export function ProposalImpactChart({
  comparison,
  selectedMetric,
  onSelectMetric,
  baseRevision,
  variantLabel,
  variantBLabel
}: ProposalImpactChartProps): React.JSX.Element {
  const metricSeries = comparison.metrics[selectedMetric];
  const isCash = selectedMetric === 'endingCash';
  const hasVariantB = Boolean(variantBLabel && comparison.variantBModel);

  const chartData = metricSeries.months.map((m) => ({
    periodLabel: m.period < 10 ? `M0${m.period}` : `M${m.period}`,
    baseValue: m.baseValue,
    variantAValue: m.variantAValue,
    variantAAbsoluteDelta: m.variantAAbsoluteDelta,
    ...(hasVariantB && m.variantBValue !== undefined
      ? {
          variantBValue: m.variantBValue,
          variantBAbsoluteDelta: m.variantBAbsoluteDelta
        }
      : {})
  }));

  const isIdenticalToA = chartData.every((d) => d.variantAAbsoluteDelta === 0);
  const isIdenticalBoth =
    hasVariantB &&
    isIdenticalToA &&
    chartData.every(
      (d) => (d as unknown as { variantBAbsoluteDelta?: number }).variantBAbsoluteDelta === 0
    );

  function formatTick(val: number): string {
    if (metricSeries.unit === 'fte') return formatInteger(val);
    if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
    return `$${val}`;
  }

  function formatTooltipValue(val: unknown): string {
    if (typeof val !== 'number') return String(val);
    if (metricSeries.unit === 'fte') return `${formatInteger(val)} FTE`;
    return formatCurrency(val);
  }

  return (
    <div
      role="region"
      aria-label={`${metricSeries.label} Proposal Impact Chart`}
      className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 shadow-xs space-y-3"
    >
      {/* Header and Metric Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
        <div>
          <h4 className="text-sm font-bold text-neutral-900 tracking-tight">
            24-Month Projected Impact Preview
          </h4>
          <p className="text-xs text-neutral-500">
            {hasVariantB
              ? `Proposal variants vs. shared proposal base · revision ${baseRevision}`
              : `${variantLabel} vs. proposal base · revision ${baseRevision}`}
          </p>
        </div>

        {/* Metric Selector Buttons */}
        <div
          role="group"
          aria-label="Impact Preview Metric Selector"
          className="inline-flex rounded-md border border-neutral-200 bg-neutral-50 p-0.5"
        >
          {IMPACT_METRIC_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSelectMetric(opt.key)}
              aria-pressed={selectedMetric === opt.key}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                selectedMetric === opt.key
                  ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Identical Notice */}
      {(hasVariantB ? isIdenticalBoth : isIdenticalToA) && (
        <div
          role="status"
          className="text-xs font-medium text-neutral-600 bg-neutral-100 border border-neutral-200 px-2.5 py-1 rounded inline-block"
        >
          {hasVariantB
            ? 'Variants produce identical modeled outcomes'
            : 'Selected variant produces identical modeled outcomes'}
        </div>
      )}

      {/* Chart Canvas */}
      <div className="w-full h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="periodLabel"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#d1d5db' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#d1d5db' }}
              tickFormatter={formatTick}
            />
            <Tooltip
              formatter={(val) => [formatTooltipValue(val), '']}
              labelFormatter={(label) => `Period: ${label}`}
              contentStyle={{
                backgroundColor: '#ffffff',
                borderColor: '#e5e7eb',
                borderRadius: '6px',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} iconType="circle" />
            <Line
              type="monotone"
              dataKey="baseValue"
              name={`Proposal Base (Rev ${baseRevision})`}
              stroke="#64748b"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="variantAValue"
              name={variantLabel}
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 6 }}
            />
            {hasVariantB && (
              <Line
                type="monotone"
                dataKey="variantBValue"
                name={variantBLabel!}
                stroke="#16a34a"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Ending Cash EBITDA disclosure caption */}
      {isCash && (
        <p className="text-[11px] text-neutral-500 italic pt-1">
          Ending cash is a simplified roll-forward using EBITDA; excludes working capital, CapEx,
          taxes, and financing.
        </p>
      )}
    </div>
  );
}
