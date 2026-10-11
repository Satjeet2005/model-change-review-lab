import React, { useMemo, useState } from 'react';
import { useAppState } from '@/state/AppProvider';
import { calculateModel } from '@/domain/calculation';
import { calculateScenarioDelta } from '@/domain/scenarioComparison';
import { MetricSelector, ComparisonMetricKey } from '@/components/scenario/MetricSelector';
import { ScenarioChart } from '@/components/scenario/ScenarioChart';
import { ScenarioDeltaTable } from '@/components/scenario/ScenarioDeltaTable';
import { ScenarioSummaryCards } from '@/components/scenario/ScenarioSummaryCards';

export function ScenarioPage(): React.JSX.Element {
  const { baselineAssumptions, calculatedWorkingModel, revision } = useAppState();
  const [selectedMetric, setSelectedMetric] = useState<ComparisonMetricKey>('revenue');

  // Baseline calculated outputs (pure, memoized, immutable)
  const baselineCalculated = useMemo(() => {
    return calculateModel(baselineAssumptions);
  }, [baselineAssumptions]);

  // Shared single source of comparison truth for chart, table, and summary
  const comparison = useMemo(() => {
    return calculateScenarioDelta(baselineCalculated, calculatedWorkingModel);
  }, [baselineCalculated, calculatedWorkingModel]);

  const activeMetricData = comparison.metrics[selectedMetric];

  return (
    <div className="space-y-6">
      {/* 1. Page Header Landmark */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900">
            Scenario Variance &amp; Comparison
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Evaluate changes between the immutable seed baseline and the current working scenario
            (revision {revision})
          </p>
        </div>
      </div>

      {/* 2. Cumulative Summary Cards (T-073) */}
      <ScenarioSummaryCards summary={comparison.summary} />

      {/* 3. Metric Selector (T-070) */}
      <MetricSelector selectedMetric={selectedMetric} onSelectMetric={setSelectedMetric} />

      {/* 4. Scenario Comparison Chart (T-071 & T-075) */}
      <ScenarioChart metricKey={selectedMetric} data={activeMetricData} />

      {/* 5. Monthly Variance Table (T-072 & T-074) */}
      <ScenarioDeltaTable metricKey={selectedMetric} data={activeMetricData} />
    </div>
  );
}
