import { roundMoney } from '../utils/math';
import {
  CellId,
  ChangeProposal,
  ModelAssumptions,
  MonthIdString,
  PeriodIndex,
  ProposalOperation,
  ProposalTemplateId
} from './types';

export type { ProposalTemplateId };

export interface ProposalPresetDefinition {
  id: ProposalTemplateId;
  label: string;
  description: string;
  intentSummary: string;
}

export const PROPOSAL_PRESETS: readonly ProposalPresetDefinition[] = [
  {
    id: 'hire-engineers-from-q3',
    label: 'Hire 2 Engineers (Q3+)',
    description: 'Add 2 engineering hires from M07 (Q3) onward',
    intentSummary: '+2 Eng FTE across M07–M24 (18 months)'
  },
  {
    id: 'increase-growth-from-q3',
    label: 'Accelerate Growth (Q3+)',
    description: 'Increase monthly revenue growth by 1 percentage point from M07 onward',
    intentSummary: '+1.0% growth rate across M07–M24 (18 months)'
  },
  {
    id: 'reduce-opex-from-m04',
    label: 'Reduce OpEx (M04+)',
    description: 'Reduce other operating expense by 8% from M04 onward',
    intentSummary: '-8% Other OpEx across M04–M24 (21 months)'
  }
];

export interface ProposalProvider {
  generateProposal(
    templateId: ProposalTemplateId,
    currentAssumptions: ModelAssumptions,
    currentRevision: number
  ): Promise<ChangeProposal>;
}

function formatPeriodId(p: PeriodIndex): MonthIdString {
  return (p < 10 ? `M0${p}` : `M${p}`) as MonthIdString;
}

/**
 * Deterministic Mock Proposal Provider
 * PRD §6.4 & §6.9: Simulates AI proposal generation locally without network or LLM calls.
 */
export class MockProposalProvider implements ProposalProvider {
  async generateProposal(
    templateId: ProposalTemplateId,
    currentAssumptions: ModelAssumptions,
    currentRevision: number
  ): Promise<ChangeProposal> {
    const createdAt = new Date().toISOString();

    switch (templateId) {
      case 'hire-engineers-from-q3': {
        // Add 2 engineering FTE for M07–M24 inclusive (18 periods)
        const operations: ProposalOperation[] = [];
        for (let p = 7; p <= 24; p++) {
          const period = p as PeriodIndex;
          const monthAssumption = currentAssumptions.months[p - 1];
          if (!monthAssumption) continue;

          const previousValue = monthAssumption.engineeringFte;
          const proposedValue = previousValue + 2;
          const mStr = formatPeriodId(period);
          const targetCellId: CellId = `assumption:engineeringFte:${mStr}`;

          operations.push({
            targetKey: 'engineeringFte',
            targetPeriod: period,
            targetCellId,
            previousValue,
            proposedValue,
            displayUnit: 'fte',
            changeLabel: `+2 Engineering FTE (${mStr})`
          });
        }

        return {
          id: 'hire-engineers-from-q3',
          title: 'Hire 2 Engineers from Q3',
          description:
            'Increase engineering headcount by 2 FTE starting in month 7 through month 24.',
          operations,
          baseRevision: currentRevision,
          createdAt
        };
      }

      case 'increase-growth-from-q3': {
        // Add 0.01 to monthly revenue growth for M07–M24 inclusive (18 periods)
        const operations: ProposalOperation[] = [];
        for (let p = 7; p <= 24; p++) {
          const period = p as PeriodIndex;
          const monthAssumption = currentAssumptions.months[p - 1];
          if (!monthAssumption) continue;

          const previousValue = monthAssumption.revenueGrowthRate;
          const proposedValue = roundMoney((previousValue + 0.01) * 1000) / 1000;
          const mStr = formatPeriodId(period);
          const targetCellId: CellId = `assumption:revenueGrowthRate:${mStr}`;

          operations.push({
            targetKey: 'revenueGrowthRate',
            targetPeriod: period,
            targetCellId,
            previousValue,
            proposedValue,
            displayUnit: 'percent',
            changeLabel: `+1.0% Revenue Growth (${mStr})`
          });
        }

        return {
          id: 'increase-growth-from-q3',
          title: 'Accelerate Revenue Growth from Q3',
          description: 'Boost monthly revenue growth rate by +1.0% from month 7 through month 24.',
          operations,
          baseRevision: currentRevision,
          createdAt
        };
      }

      case 'reduce-opex-from-m04': {
        // Set other operating expense to roundMoney(currentValue * 0.92) for M04–M24 inclusive (21 periods)
        const operations: ProposalOperation[] = [];
        for (let p = 4; p <= 24; p++) {
          const period = p as PeriodIndex;
          const monthAssumption = currentAssumptions.months[p - 1];
          if (!monthAssumption) continue;

          const previousValue = monthAssumption.otherOperatingExpenseUsd;
          const proposedValue = roundMoney(previousValue * 0.92);
          const mStr = formatPeriodId(period);
          const targetCellId: CellId = `assumption:otherOperatingExpenseUsd:${mStr}`;

          operations.push({
            targetKey: 'otherOperatingExpenseUsd',
            targetPeriod: period,
            targetCellId,
            previousValue,
            proposedValue,
            displayUnit: 'usd',
            changeLabel: `-8% Other OpEx (${mStr})`
          });
        }

        return {
          id: 'reduce-opex-from-m04',
          title: 'Reduce Other Operating Expense from M04',
          description:
            'Reduce non-payroll operating expenses by 8% starting in month 4 through month 24.',
          operations,
          baseRevision: currentRevision,
          createdAt
        };
      }

      default: {
        const exhaustiveCheck: never = templateId;
        throw new Error(`Unknown proposal template: ${exhaustiveCheck}`);
      }
    }
  }
}
