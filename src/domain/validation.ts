import {
  DisplayUnit,
  PeriodIndex,
  ProposalOperation,
  ReadonlyModelAssumptions,
  SettingKey,
  ValidationError,
  ValidationResult
} from './types';

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
export function validateOperationSet(operations: readonly ProposalOperation[]): ValidationResult {
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

/**
 * Strict validation of variant operations for proposal impact preview and comparison.
 * Empty operation sets are treated as valid (representing an unchanged base scenario).
 * Non-empty operation sets must strictly validate targetKey, targetPeriod, targetCellId,
 * displayUnit, previousValue against baseAssumptions, numeric bounds, and uniqueness.
 */
export function validateVariantOperationsForPreview(
  operations: readonly ProposalOperation[] = [],
  baseAssumptions: ReadonlyModelAssumptions
): ValidationResult {
  if (
    !baseAssumptions ||
    !Array.isArray(baseAssumptions.months) ||
    baseAssumptions.months.length !== 24
  ) {
    return {
      valid: false,
      errors: [
        {
          targetKey: '',
          targetPeriod: null,
          message: 'Base assumptions are mandatory and must contain 24 months',
          rejectedValue: baseAssumptions
        }
      ]
    };
  }

  // Pure preview allows empty operations (produces unchanged base)
  if (!operations || operations.length === 0) {
    return { valid: true, errors: [] };
  }

  const errors: ValidationError[] = [];
  const seenTargets = new Set<string>();

  for (const op of operations) {
    const { targetKey, targetPeriod, targetCellId, previousValue, proposedValue, displayUnit } = op;

    // Check for target uniqueness
    const canonicalTargetId =
      targetPeriod === null
        ? `setting:${targetKey}`
        : `assumption:${targetKey}:M${targetPeriod < 10 ? '0' + targetPeriod : targetPeriod}`;

    if (seenTargets.has(canonicalTargetId)) {
      errors.push({
        targetKey,
        targetPeriod,
        message: `Duplicate operation target: ${canonicalTargetId}`,
        rejectedValue: proposedValue
      });
    } else {
      seenTargets.add(canonicalTargetId);
    }

    // Validate setting vs monthly assumption rules
    const isSetting = targetKey === 'startingRevenueUsd' || targetKey === 'startingCashUsd';
    const isMonthlyAssumption =
      targetKey === 'revenueGrowthRate' ||
      targetKey === 'engineeringFte' ||
      targetKey === 'otherFte' ||
      targetKey === 'loadedMonthlyCostPerFteUsd' ||
      targetKey === 'otherOperatingExpenseUsd';

    if (!isSetting && !isMonthlyAssumption) {
      errors.push({
        targetKey,
        targetPeriod,
        message: `Unknown or uneditable assumption field: ${targetKey}`,
        rejectedValue: targetKey
      });
      continue;
    }

    // Target period check
    if (isSetting) {
      if (targetPeriod !== null) {
        errors.push({
          targetKey,
          targetPeriod,
          message: `Setting ${targetKey} must have null targetPeriod`,
          rejectedValue: targetPeriod
        });
      }
    } else {
      if (
        targetPeriod === null ||
        !Number.isInteger(targetPeriod) ||
        targetPeriod < 1 ||
        targetPeriod > 24
      ) {
        errors.push({
          targetKey,
          targetPeriod,
          message: `Monthly assumption ${targetKey} must have integer targetPeriod between 1 and 24`,
          rejectedValue: targetPeriod
        });
      }
    }

    // Canonical cellId syntax check
    if (targetCellId !== canonicalTargetId) {
      errors.push({
        targetKey,
        targetPeriod,
        message: `Mismatched targetCellId: expected "${canonicalTargetId}", got "${targetCellId}"`,
        rejectedValue: targetCellId
      });
    }

    // Expected display unit check
    let expectedUnit: DisplayUnit;
    if (targetKey === 'revenueGrowthRate') {
      expectedUnit = 'percent';
    } else if (targetKey === 'engineeringFte' || targetKey === 'otherFte') {
      expectedUnit = 'fte';
    } else {
      expectedUnit = 'usd';
    }

    if (displayUnit !== expectedUnit) {
      errors.push({
        targetKey,
        targetPeriod,
        message: `Mismatched displayUnit for ${targetKey}: expected "${expectedUnit}", got "${displayUnit}"`,
        rejectedValue: displayUnit
      });
    }

    // Previous value check against baseAssumptions
    let expectedBaseValue: number | undefined;
    if (isSetting) {
      expectedBaseValue = baseAssumptions[targetKey as SettingKey];
    } else if (targetPeriod !== null && targetPeriod >= 1 && targetPeriod <= 24) {
      const monthData = baseAssumptions.months[targetPeriod - 1];
      if (monthData) {
        expectedBaseValue = (monthData as unknown as Record<string, number>)[targetKey];
      }
    }

    if (expectedBaseValue === undefined || previousValue !== expectedBaseValue) {
      errors.push({
        targetKey,
        targetPeriod,
        message: `previousValue (${previousValue}) does not match base assumption value (${expectedBaseValue})`,
        rejectedValue: previousValue
      });
    }

    // Validate proposed value bounds/syntax
    const valError = validateAssumptionValue(targetKey, proposedValue, targetPeriod);
    if (valError) {
      errors.push(valError);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Hardened validation for proposal acceptance.
 * Enforces mandatory base assumptions, canonical cell ID syntax, unit matching,
 * target uniqueness, non-empty set, base value numeric equality, and non-no-op criteria.
 */
export function validateProposalAcceptance(
  operations: readonly ProposalOperation[],
  baseAssumptions: ReadonlyModelAssumptions
): ValidationResult {
  if (!operations || operations.length === 0) {
    return {
      valid: false,
      errors: [
        {
          targetKey: '',
          targetPeriod: null,
          message: 'Operation set cannot be empty',
          rejectedValue: operations
        }
      ]
    };
  }

  const previewValidation = validateVariantOperationsForPreview(operations, baseAssumptions);
  if (!previewValidation.valid) {
    return previewValidation;
  }

  // Check for effective change (at least one proposed value differs from previousValue)
  const hasEffectiveChanges = operations.some((op) => op.proposedValue !== op.previousValue);
  if (!hasEffectiveChanges) {
    return {
      valid: false,
      errors: [
        {
          targetKey: '',
          targetPeriod: null,
          message: 'No changes to apply: all proposed values equal base values',
          rejectedValue: null
        }
      ]
    };
  }

  return {
    valid: true,
    errors: []
  };
}
