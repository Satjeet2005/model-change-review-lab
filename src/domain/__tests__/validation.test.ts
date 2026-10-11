import { describe, it, expect } from 'vitest';
import { validateAssumptionValue, validateProposalAcceptance } from '../validation';
import { createSeedAssumptions } from '../seed';
import { ProposalOperation } from '../types';

describe('Domain Input Validation (T-019 / PRD Tests 13-15)', () => {
  it('validates bounds for monetary settings and assumptions (PRD Test 13)', () => {
    // startingRevenueUsd (0 to 1,000,000,000)
    expect(validateAssumptionValue('startingRevenueUsd', 0)).toBeNull();
    expect(validateAssumptionValue('startingRevenueUsd', 1_000_000_000)).toBeNull();
    expect(validateAssumptionValue('startingRevenueUsd', 750000)).toBeNull();
    expect(validateAssumptionValue('startingRevenueUsd', -1)).not.toBeNull();
    expect(validateAssumptionValue('startingRevenueUsd', 1_000_000_001)).not.toBeNull();

    // startingCashUsd (0 to 1,000,000,000)
    expect(validateAssumptionValue('startingCashUsd', 0)).toBeNull();
    expect(validateAssumptionValue('startingCashUsd', 1_000_000_000)).toBeNull();
    expect(validateAssumptionValue('startingCashUsd', 3_000_000)).toBeNull();
    expect(validateAssumptionValue('startingCashUsd', -1)).not.toBeNull();
    expect(validateAssumptionValue('startingCashUsd', 1_000_000_001)).not.toBeNull();

    // otherOperatingExpenseUsd (0 to 1,000,000,000)
    expect(validateAssumptionValue('otherOperatingExpenseUsd', 0, 1)).toBeNull();
    expect(validateAssumptionValue('otherOperatingExpenseUsd', 1_000_000_000, 1)).toBeNull();
    expect(validateAssumptionValue('otherOperatingExpenseUsd', 240_000, 1)).toBeNull();
    expect(validateAssumptionValue('otherOperatingExpenseUsd', -1, 1)).not.toBeNull();
    expect(validateAssumptionValue('otherOperatingExpenseUsd', 1_000_000_001, 1)).not.toBeNull();

    // Loaded cost per FTE (1 to 100,000)
    expect(validateAssumptionValue('loadedMonthlyCostPerFteUsd', 1, 1)).toBeNull();
    expect(validateAssumptionValue('loadedMonthlyCostPerFteUsd', 100000, 1)).toBeNull();
    expect(validateAssumptionValue('loadedMonthlyCostPerFteUsd', 0, 1)).not.toBeNull();
    expect(validateAssumptionValue('loadedMonthlyCostPerFteUsd', 100001, 1)).not.toBeNull();

    // Revenue growth rate (-0.5 to 0.5)
    expect(validateAssumptionValue('revenueGrowthRate', -0.5, 1)).toBeNull();
    expect(validateAssumptionValue('revenueGrowthRate', 0.5, 1)).toBeNull();
    expect(validateAssumptionValue('revenueGrowthRate', -0.51, 1)).not.toBeNull();
    expect(validateAssumptionValue('revenueGrowthRate', 0.51, 1)).not.toBeNull();
  });

  it('strictly enforces integer constraints on FTE fields (PRD Test 14)', () => {
    // Valid integer FTE
    expect(validateAssumptionValue('engineeringFte', 0, 1)).toBeNull();
    expect(validateAssumptionValue('engineeringFte', 1000, 1)).toBeNull();
    expect(validateAssumptionValue('engineeringFte', 15, 1)).toBeNull();
    expect(validateAssumptionValue('otherFte', 20, 1)).toBeNull();

    // Fractional FTE rejected
    const fracEng = validateAssumptionValue('engineeringFte', 14.5, 1);
    expect(fracEng).not.toBeNull();
    expect(fracEng?.message).toMatch(/must be an integer/);

    const fracOther = validateAssumptionValue('otherFte', 0.1, 1);
    expect(fracOther).not.toBeNull();
    expect(fracOther?.message).toMatch(/must be an integer/);

    // Negative and excessive FTE rejected
    expect(validateAssumptionValue('engineeringFte', -1, 1)).not.toBeNull();
    expect(validateAssumptionValue('engineeringFte', 1001, 1)).not.toBeNull();
  });

  it('rejects malformed inputs, whitespace, NaN, and trailing garbage (PRD Test 15)', () => {
    // Null and undefined
    expect(validateAssumptionValue('startingRevenueUsd', null)).not.toBeNull();
    expect(validateAssumptionValue('startingRevenueUsd', undefined)).not.toBeNull();

    // Empty and whitespace
    expect(validateAssumptionValue('startingRevenueUsd', '')).not.toBeNull();
    expect(validateAssumptionValue('startingRevenueUsd', '   ')).not.toBeNull();

    // NaN and Infinities
    expect(validateAssumptionValue('startingRevenueUsd', NaN)).not.toBeNull();
    expect(validateAssumptionValue('startingRevenueUsd', Infinity)).not.toBeNull();
    expect(validateAssumptionValue('startingRevenueUsd', -Infinity)).not.toBeNull();

    // Trailing garbage in string
    expect(validateAssumptionValue('startingRevenueUsd', '750000abc')).not.toBeNull();
    expect(validateAssumptionValue('startingRevenueUsd', '12.34.56')).not.toBeNull();

    // Unknown field
    expect(validateAssumptionValue('unknownField', 100)).not.toBeNull();
  });
});

describe('Proposal Acceptance Validation (validateProposalAcceptance)', () => {
  const seed = createSeedAssumptions();

  const validOperation: ProposalOperation = {
    targetKey: 'engineeringFte',
    targetPeriod: 7,
    targetCellId: 'assumption:engineeringFte:M07',
    previousValue: 14, // matches seed M07 engineeringFte
    proposedValue: 16,
    displayUnit: 'fte',
    changeLabel: 'Hire +2 engineers in M07'
  };

  it('passes on valid operations with matching base assumptions', () => {
    const result = validateProposalAcceptance([validOperation], seed);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing or malformed base assumptions', () => {
    const invalidBase = { ...seed, months: seed.months.slice(0, 10) } as unknown as typeof seed;
    const res1 = validateProposalAcceptance([validOperation], invalidBase);
    expect(res1.valid).toBe(false);
    expect(res1.errors[0]?.message).toMatch(/Base assumptions are mandatory/);

    const res2 = validateProposalAcceptance([validOperation], null as unknown as typeof seed);
    expect(res2.valid).toBe(false);
  });

  it('rejects empty operation sets', () => {
    const result = validateProposalAcceptance([], seed);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toMatch(/cannot be empty/);
  });

  it('rejects mismatched previousValue against base assumptions', () => {
    const mismatchedOp: ProposalOperation = {
      ...validOperation,
      previousValue: 99 // seed is 14
    };
    const result = validateProposalAcceptance([mismatchedOp], seed);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toMatch(/previousValue .* does not match base assumption/);
  });

  it('rejects forged or malformed targetCellId', () => {
    const forgedOp: ProposalOperation = {
      ...validOperation,
      targetCellId: 'calculated:ebitda:M07' as unknown as typeof validOperation.targetCellId
    };
    const result = validateProposalAcceptance([forgedOp], seed);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toMatch(/Mismatched targetCellId/);
  });

  it('rejects uneditable or calculated target keys', () => {
    const calculatedOp: ProposalOperation = {
      targetKey: 'ebitda',
      targetPeriod: 1,
      targetCellId: 'assumption:ebitda:M01' as unknown as typeof validOperation.targetCellId,
      previousValue: 100000,
      proposedValue: 200000,
      displayUnit: 'usd',
      changeLabel: 'Directly modify EBITDA'
    };
    const result = validateProposalAcceptance([calculatedOp], seed);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toMatch(/Unknown or uneditable assumption field/);
  });

  it('rejects mismatched displayUnit', () => {
    const wrongUnitOp: ProposalOperation = {
      ...validOperation,
      displayUnit: 'usd' // engineeringFte should be fte
    };
    const result = validateProposalAcceptance([wrongUnitOp], seed);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toMatch(/Mismatched displayUnit/);
  });

  it('rejects setting with non-null period or monthly assumption with invalid period', () => {
    const settingWithPeriod: ProposalOperation = {
      targetKey: 'startingRevenueUsd',
      targetPeriod: 1,
      targetCellId: 'setting:startingRevenueUsd',
      previousValue: 750000,
      proposedValue: 800000,
      displayUnit: 'usd',
      changeLabel: 'Update revenue'
    };
    const res1 = validateProposalAcceptance([settingWithPeriod], seed);
    expect(res1.valid).toBe(false);
    expect(res1.errors.some((e) => e.message.includes('must have null targetPeriod'))).toBe(true);

    const monthlyWithNullPeriod: ProposalOperation = {
      targetKey: 'engineeringFte',
      targetPeriod: null,
      targetCellId: 'setting:engineeringFte' as unknown as typeof validOperation.targetCellId,
      previousValue: 12,
      proposedValue: 15,
      displayUnit: 'fte',
      changeLabel: 'Update FTE'
    };
    const res2 = validateProposalAcceptance([monthlyWithNullPeriod], seed);
    expect(res2.valid).toBe(false);
    expect(res2.errors.some((e) => e.message.includes('must have integer targetPeriod'))).toBe(
      true
    );
  });

  it('rejects duplicate operation targets', () => {
    const dupOps: ProposalOperation[] = [
      validOperation,
      {
        ...validOperation,
        proposedValue: 18
      }
    ];
    const result = validateProposalAcceptance(dupOps, seed);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate operation target'))).toBe(true);
  });

  it('rejects no-op proposal where all proposed values equal base values', () => {
    const noOp: ProposalOperation = {
      ...validOperation,
      proposedValue: validOperation.previousValue // 14 === 14
    };
    const result = validateProposalAcceptance([noOp], seed);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.message).toMatch(/No changes to apply/);
  });
});
