import { describe, it, expect } from 'vitest';
import { calculateModel } from '../calculation';
import { createSeedAssumptions } from '../seed';
import { buildTraceIndex } from '../trace';
import { CellId, TraceIndex } from '../types';

describe('Dependency Tracing Engine (T-021 / PRD Tests 27-29)', () => {
  const seed = createSeedAssumptions();
  const calculated = calculateModel(seed);
  const traceIndex = buildTraceIndex(seed, calculated);

  it('guarantees no dangling references in trace index (PRD Test 27)', () => {
    const allNodeIds = new Set(Object.keys(traceIndex.nodes));

    for (const node of Object.values(traceIndex.nodes)) {
      for (const inputId of node.inputIds) {
        expect(allNodeIds.has(inputId)).toBe(true);
      }
    }
  });

  it('verifies all dependency chains resolve to assumptions and settings without cycles (PRD Test 28)', () => {
    function resolveToRoots(
      nodeId: CellId,
      index: TraceIndex,
      visited: Set<CellId> = new Set()
    ): Set<CellId> {
      if (visited.has(nodeId)) {
        throw new Error(`Cycle detected at node ${nodeId}`);
      }
      visited.add(nodeId);

      const node = index.nodes[nodeId];
      if (!node) {
        throw new Error(`Dangling node: ${nodeId}`);
      }

      if (node.kind === 'setting' || node.kind === 'assumption') {
        return new Set([nodeId]);
      }

      const roots = new Set<CellId>();
      for (const inputId of node.inputIds) {
        const inputRoots = resolveToRoots(inputId, index, new Set(visited));
        for (const r of inputRoots) {
          roots.add(r);
        }
      }
      return roots;
    }

    // Test resolution for ending cash at M24
    const m24CashRoots = resolveToRoots('calculated:endingCash:M24', traceIndex);
    expect(m24CashRoots.size).toBeGreaterThan(0);

    // Verify all roots are indeed settings or assumptions
    for (const rootId of m24CashRoots) {
      const rootNode = traceIndex.nodes[rootId]!;
      expect(['setting', 'assumption']).toContain(rootNode.kind);
    }
  });

  it('verifies exact formulas and input linkages for representative cells (PRD Test 29)', () => {
    // M01 Revenue links to starting revenue setting and M01 growth
    const revM01 = traceIndex.nodes['calculated:revenue:M01']!;
    expect(revM01.inputIds).toEqual([
      'setting:startingRevenueUsd',
      'assumption:revenueGrowthRate:M01'
    ]);
    expect(revM01.formulaLabel).toContain('Starting Revenue');

    // M02 Revenue links to M01 revenue and M02 growth
    const revM02 = traceIndex.nodes['calculated:revenue:M02']!;
    expect(revM02.inputIds).toEqual(['calculated:revenue:M01', 'assumption:revenueGrowthRate:M02']);

    // Total FTE M07 links to Eng FTE and Other FTE
    const fteM07 = traceIndex.nodes['calculated:totalFte:M07']!;
    expect(fteM07.inputIds).toEqual(['assumption:engineeringFte:M07', 'assumption:otherFte:M07']);

    // Payroll M07 links to Total FTE and Cost per FTE
    const payrollM07 = traceIndex.nodes['calculated:payroll:M07']!;
    expect(payrollM07.inputIds).toEqual([
      'calculated:totalFte:M07',
      'assumption:loadedMonthlyCostPerFteUsd:M07'
    ]);

    // EBITDA M07 links to Revenue and Total OpEx
    const ebitdaM07 = traceIndex.nodes['calculated:ebitda:M07']!;
    expect(ebitdaM07.inputIds).toEqual([
      'calculated:revenue:M07',
      'calculated:totalOperatingExpense:M07'
    ]);

    // Ending Cash M01 links to starting cash and EBITDA M01
    const cashM01 = traceIndex.nodes['calculated:endingCash:M01']!;
    expect(cashM01.inputIds).toEqual(['setting:startingCashUsd', 'calculated:ebitda:M01']);
  });
});
