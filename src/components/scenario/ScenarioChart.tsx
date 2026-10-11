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
import { MetricDelta } from '@/domain/types';
import { formatCurrency } from '@/domain/formatting';
import { ComparisonMetricKey, COMPARISON_METRIC_OPTIONS } from './MetricSelector';

export interface ScenarioChartProps {
  metricKey: ComparisonMetricKey;
  data: readonly MetricDelta[];
}

interface ChartDatum {
  periodLabel: string;
  baseline: number;
  working: number;
  delta: number;
}

export function ScenarioChart({ metricKey, data }: ScenarioChartProps): React.JSX.Element {
  const metricMeta =
    COMPARISON_METRIC_OPTIONS.find((m) => m.key === metricKey) ?? COMPARISON_METRIC_OPTIONS[0]!;

  const chartData: ChartDatum[] = data.map((d) => ({
    periodLabel: d.period < 10 ? `M0${d.period}` : `M${d.period}`,
    baseline: d.baselineValue,
    working: d.workingValue,
    delta: d.absoluteDelta
  }));

  // Detect whether both series are identical across all periods
  const isIdentical = chartData.every((d) => d.delta === 0);

  return (
    <section
      role="region"
      aria-label={`${metricMeta.label} Scenario Comparison Chart`}
      className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 shadow-xs space-y-3"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-neutral-100 pb-2">
        <div>
          <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
            {metricMeta.label} Horizon Projection (M01–M24)
          </h2>
          <p className="text-xs text-neutral-500">
            Comparing immutable baseline vs. active working scenario
          </p>
        </div>

        {isIdentical && (
          <span
            role="status"
            className="text-xs font-medium text-neutral-600 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded self-start sm:self-center"
          >
            Baseline and working scenarios are identical
          </span>
        )}
      </div>

      {/* Screen reader summary */}
      <p className="sr-only">
        Line chart comparing {metricMeta.label} for Baseline and Working scenarios across 24 monthly
        periods. A detailed data table alternative is provided immediately below.
      </p>

      {/* Responsive Recharts Container */}
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
              tickFormatter={(v: number) => {
                if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
                if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
                return `$${v}`;
              }}
            />
            <Tooltip
              formatter={(val: unknown) => [
                typeof val === 'number' ? formatCurrency(val) : String(val),
                ''
              ]}
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
              dataKey="baseline"
              name="Baseline Scenario"
              stroke="#6b7280"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="working"
              name="Working Scenario"
              stroke="#2563eb"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
