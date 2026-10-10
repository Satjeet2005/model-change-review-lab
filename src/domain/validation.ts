import { PeriodIndex, ProposalOperation, ValidationError, ValidationResult } from './types';

/**
 * Validates a single input or assumption value against PRD §6.9 rules.
 *
 * @param targetKey The setting or assumption field name
 * @param rawValue The value to validate (number or numeric string)
 * @param targetPeriod The planning period (1-24) or null for settings
 * @returns ValidationError if invalid, or null if valid
 */
export function validateAssumptionValue(
  targetKey: string,
  rawValue: unknown,
  targetPeriod: PeriodIndex | null = null
): ValidationError | null {
  // Check for null / undefined
  if (rawValue === null || rawValue === undefined) {
    return {
      targetKey,
      targetPeriod,
      message: `Value for ${targetKey} cannot be null or undefined`,
      rejectedValue: rawValue
    };
  }

  // Check for string input and trailing garbage
  let num: number;
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (trimmed === '') {
      return {
        targetKey,
        targetPeriod,
        message: `Value for ${targetKey} cannot be empty or whitespace`,
        rejectedValue: rawValue
      };
    }
    // Strict numeric check (disallows '12abc', '12.3.4', etc.)
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return {
        targetKey,
        targetPeriod,
        message: `Value for ${targetKey} contains invalid numeric characters`,
        rejectedValue: rawValue
      };
    }
    num = Number(trimmed);
  } else if (typeof rawValue === 'number') {
    num = rawValue;
  } else {
    return {
      targetKey,
      targetPeriod,
      message: `Value for ${targetKey} must be a number or numeric string`,
      rejectedValue: rawValue
    };
  }

  // Reject NaN and infinities
  if (!Number.isFinite(num)) {
    return {
      targetKey,
      targetPeriod,
      message: `Value for ${targetKey} must be a finite number`,
      rejectedValue: rawValue
    };
  }

  // Field-specific range and type constraints (PRD §6.9)
  switch (targetKey) {
    case 'startingRevenueUsd':
    case 'startingCashUsd':
    case 'otherOperatingExpenseUsd':
      if (num < 0 || num > 1_000_000_000) {
        return {
          targetKey,
          targetPeriod,
          message: `${targetKey} must be between 0 and 1,000,000,000 inclusive`,
          rejectedValue: rawValue
        };
      }
      break;

    case 'revenueGrowthRate':
      if (num < -0.5 || num > 0.5) {
        return {
          targetKey,
          targetPeriod,
          message: 'revenueGrowthRate must be between -0.5 (-50%) and 0.5 (+50%) inclusive',
          rejectedValue: rawValue
        };
      }
      break;

    case 'engineeringFte':
    case 'otherFte':
      if (!Number.isInteger(num)) {
        return {
          targetKey,
          targetPeriod,
          message: `${targetKey} must be an integer`,
          rejectedValue: rawValue
        };
      }
      if (num < 0 || num > 1_000) {
        return {
          targetKey,
          targetPeriod,
          message: `${targetKey} must be an integer between 0 and 1,000 inclusive`,
          rejectedValue: rawValue
        };
      }
      break;

    case 'loadedMonthlyCostPerFteUsd':
      if (num < 1 || num > 100_000) {
        return {
          targetKey,
          targetPeriod,
          message: 'loadedMonthlyCostPerFteUsd must be between 1 and 100,000 inclusive',
          rejectedValue: rawValue
        };
      }
      break;

    default:
      return {
        targetKey,
        targetPeriod,
        message: `Unknown assumption field: ${targetKey}`,
        rejectedValue: rawValue
      };
  }

  // If period is provided for monthly assumptions, check bounds
  if (targetKey !== 'startingRevenueUsd' && targetKey !== 'startingCashUsd') {
    if (targetPeriod !== null && (targetPeriod < 1 || targetPeriod > 24)) {
      return {
        targetKey,
        targetPeriod,
        message: `Period must be between 1 and 24, got ${targetPeriod}`,
        rejectedValue: rawValue
      };
    }
  }

  return null;
}

/**
 * Validates an entire operation set atomically before application.
 * Rejects duplicate targets, unknown keys, and invalid values.
 */
export function validateOperationSet(operations: ProposalOperation[]): ValidationResult {
  const errors: ValidationError[] = [];
  const seenTargets = new Set<string>();

  for (const op of operations) {
    const targetKey = op.targetKey;
    const targetPeriod = op.targetPeriod;
    const targetCellId = op.targetCellId;

    // Check for target uniqueness
    const targetIdentifier = targetCellId || `${targetKey}:M${targetPeriod ?? 'setting'}`;
    if (seenTargets.has(targetIdentifier)) {
      errors.push({
        targetKey,
        targetPeriod,
        message: `Duplicate operation target: ${targetIdentifier}`,
        rejectedValue: op.proposedValue
      });
    } else {
      seenTargets.add(targetIdentifier);
    }

    // Validate proposed value
    const valError = validateAssumptionValue(targetKey, op.proposedValue, targetPeriod);
    if (valError) {
      errors.push(valError);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
