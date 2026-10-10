import { describe, it, expect, vi } from 'vitest';
import { calculateModel } from '../calculation';
import { applyOperationsToDraft } from '../operations';
import { MockProposalProvider } from '../proposals';
import { createSeedAssumptions } from '../seed';
import { ProposalOperation } from '../types';
import { validateOperationSet } from '../validation';

describe('Proposal Generation & Operation Sets (T-020 / PRD Tests 16-18 & 21-26)', () => {
  const provider = new MockProposalProvider();

  it('rejects duplicate and unknown operation targets atomically (PRD Test 16)', () => {
    const dupOps: ProposalOperation[] = [
      {
        targetKey: 'engineeringFte',
        targetPeriod: 7,
        targetCellId: 'assumption:engineeringFte:M07',
        previousValue: 14,
        proposedValue: 16,
        displayUnit: 'fte',
        changeLabel: '+2 Eng FTE'
      },
      {
        targetKey: 'engineeringFte',
        targetPeriod: 7,
        targetCellId: 'assumption:engineeringFte:M07',
        previousValue: 14,
        proposedValue: 18,
        displayUnit: 'fte',
        changeLabel: '+4 Eng FTE'
      }
    ];

    const dupResult = validateOperationSet(dupOps);
    expect(dupResult.valid).toBe(false);
    expect(dupResult.errors.some((e) => e.message.includes('Duplicate'))).toBe(true);

    const unknownOps: ProposalOperation[] = [
      {
        targetKey: 'nonExistentMetric',
        targetPeriod: 1,
        targetCellId: 'assumption:engineeringFte:M01',
        previousValue: 0,
        proposedValue: 10,
        displayUnit: 'usd',
        changeLabel: 'Invalid'
      }
    ];

    const unknownResult = validateOperationSet(unknownOps);
    expect(unknownResult.valid).toBe(false);
  });

  it('applies a valid operation set returning a changed clone and leaving original assumptions deeply equal (PRD Test 17 / T-014)', () => {
    const seed = createSeedAssumptions();
    const originalSnapshot = JSON.stringify(seed);
    const originalFte = seed.months[6]!.engineeringFte; // M07

    const ops: ProposalOperation[] = [
      {
        targetKey: 'engineeringFte',
        targetPeriod: 7,
        targetCellId: 'assumption:engineeringFte:M07',
        previousValue: originalFte,
        proposedValue: originalFte + 2,
        displayUnit: 'fte',
        changeLabel: '+2 Eng FTE'
      }
    ];

    const draft = applyOperationsToDraft(seed, ops);

    expect(draft.months[6]!.engineeringFte).toBe(originalFte + 2);
    expect(seed.months[6]!.engineeringFte).toBe(originalFte); // Unmutated
    expect(JSON.stringify(seed)).toBe(originalSnapshot); // Deeply equal
  });

  it('rejects multi-operation sets entirely if any operation is invalid (PRD Test 18)', () => {
    const seed = createSeedAssumptions();
    const mixedOps: ProposalOperation[] = [
      {
        targetKey: 'engineeringFte',
        targetPeriod: 7,
        targetCellId: 'assumption:engineeringFte:M07',
        previousValue: 14,
        proposedValue: 16,
        displayUnit: 'fte',
        changeLabel: 'Valid'
      },
      {
        targetKey: 'revenueGrowthRate',
        targetPeriod: 8,
        targetCellId: 'assumption:revenueGrowthRate:M08',
        previousValue: 0.025,
        proposedValue: 99.9, // Invalid growth rate (> 0.5)
        displayUnit: 'percent',
        changeLabel: 'Invalid'
      }
    ];

    expect(() => applyOperationsToDraft(seed, mixedOps)).toThrow();
    // Verify first operation was NOT applied to seed
    expect(seed.months[6]!.engineeringFte).toBe(14);
  });

  it('generates Template A: Hire Engineers from Q3 (PRD Test 21)', async () => {
    const seed = createSeedAssumptions();
    const proposal = await provider.generateProposal('hire-engineers-from-q3', seed, 1);

    expect(proposal.id).toBe('hire-engineers-from-q3');
    expect(proposal.operations).toHaveLength(18); // M07..M24

    for (let i = 0; i < 18; i++) {
      const op = proposal.operations[i]!;
      const expectedPeriod = i + 7;
      expect(op.targetPeriod).toBe(expectedPeriod);
      expect(op.targetKey).toBe('engineeringFte');
      expect(op.displayUnit).toBe('fte');
      expect(op.proposedValue).toBe(op.previousValue + 2);
    }
  });

  it('generates Template B: Increase Growth from Q3 (PRD Test 22)', async () => {
    const seed = createSeedAssumptions();
    const proposal = await provider.generateProposal('increase-growth-from-q3', seed, 1);

    expect(proposal.id).toBe('increase-growth-from-q3');
    expect(proposal.operations).toHaveLength(18); // M07..M24

    for (let i = 0; i < 18; i++) {
      const op = proposal.operations[i]!;
      const expectedPeriod = i + 7;
      expect(op.targetPeriod).toBe(expectedPeriod);
      expect(op.targetKey).toBe('revenueGrowthRate');
      expect(op.displayUnit).toBe('percent');
      expect(op.proposedValue).toBeCloseTo(op.previousValue + 0.01, 4);
    }
  });

  it('generates Template C: Reduce OpEx from M04 (PRD Test 23)', async () => {
    const seed = createSeedAssumptions();
    const proposal = await provider.generateProposal('reduce-opex-from-m04', seed, 1);

    expect(proposal.id).toBe('reduce-opex-from-m04');
    expect(proposal.operations).toHaveLength(21); // M04..M24

    for (let i = 0; i < 21; i++) {
      const op = proposal.operations[i]!;
      const expectedPeriod = i + 4;
      expect(op.targetPeriod).toBe(expectedPeriod);
      expect(op.targetKey).toBe('otherOperatingExpenseUsd');
      expect(op.displayUnit).toBe('usd');
      expect(op.proposedValue).toBe(Math.round(op.previousValue * 0.92 * 100) / 100);
    }
  });

  it('guarantees proposal determinism and scenario immutability (PRD Test 24)', async () => {
    const seed = createSeedAssumptions();
    const seedSnapshot = JSON.stringify(seed);

    const prop1 = await provider.generateProposal('hire-engineers-from-q3', seed, 1);
    const prop2 = await provider.generateProposal('hire-engineers-from-q3', seed, 1);

    expect(prop1.operations).toEqual(prop2.operations);
    expect(JSON.stringify(seed)).toBe(seedSnapshot);
  });

  it('demonstrates proposal preview uses identical calculation engine (PRD Test 25)', async () => {
    const seed = createSeedAssumptions();
    const proposal = await provider.generateProposal('hire-engineers-from-q3', seed, 1);

    // Preview: apply to cloned draft and calculate
    const previewDraft = applyOperationsToDraft(seed, proposal.operations);
    const previewResult = calculateModel(previewDraft);

    expect(previewResult.months).toHaveLength(24);
    expect(previewResult.summary.m24TotalFte).toBe(
      seed.months[23]!.engineeringFte + 2 + seed.months[23]!.otherFte
    );
    // Baseline model unchanged
    expect(seed.months[23]!.engineeringFte).toBe(18);
  });

  it('performs zero fetch or network calls during proposal generation (PRD Test 26)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const seed = createSeedAssumptions();

    await provider.generateProposal('hire-engineers-from-q3', seed, 1);
    await provider.generateProposal('increase-growth-from-q3', seed, 1);
    await provider.generateProposal('reduce-opex-from-m04', seed, 1);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
