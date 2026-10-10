import { describe, it, expect } from 'vitest';
import { validateAssumptionValue } from '../validation';

describe('Domain Input Validation (T-019 / PRD Tests 13-15)', () => {
  it('validates bounds for monetary settings and assumptions (PRD Test 13)', () => {
    // Valid bounds
    expect(validateAssumptionValue('startingRevenueUsd', 0)).toBeNull();
    expect(validateAssumptionValue('startingRevenueUsd', 1_000_000_000)).toBeNull();
    expect(validateAssumptionValue('startingRevenueUsd', 750000)).toBeNull();

    // Out of range
    expect(validateAssumptionValue('startingRevenueUsd', -1)).not.toBeNull();
    expect(validateAssumptionValue('startingRevenueUsd', 1_000_000_001)).not.toBeNull();

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
