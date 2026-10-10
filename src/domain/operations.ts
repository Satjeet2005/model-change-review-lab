import { ModelAssumptions, ProposalOperation } from './types';
import { validateOperationSet } from './validation';

/**
 * Deep clones a ModelAssumptions object to prevent mutation.
 */
export function cloneModelAssumptions(source: Readonly<ModelAssumptions>): ModelAssumptions {
  return {
    startingRevenueUsd: source.startingRevenueUsd,
    startingCashUsd: source.startingCashUsd,
    months: source.months.map((m) => ({ ...m }))
  };
}

/**
 * Applies an operation set to a cloned draft of ModelAssumptions.
 * PRD §6.9: Validates operation set atomically and updates draft without mutating input.
 * Throws an Error if operation validation fails.
 */
export function applyOperationsToDraft(
  canonicalAssumptions: Readonly<ModelAssumptions>,
  operations: ProposalOperation[]
): ModelAssumptions {
  // 1. Atomic validation
  const validation = validateOperationSet(operations);
  if (!validation.valid) {
    const errorMessages = validation.errors.map((e) => e.message).join('; ');
    throw new Error(`Cannot apply invalid operation set: ${errorMessages}`);
  }

  // 2. Clone to isolate mutation
  const draft = cloneModelAssumptions(canonicalAssumptions);

  // 3. Apply operations
  for (const op of operations) {
    const { targetKey, targetPeriod, proposedValue } = op;

    if (targetKey === 'startingRevenueUsd') {
      draft.startingRevenueUsd = proposedValue;
    } else if (targetKey === 'startingCashUsd') {
      draft.startingCashUsd = proposedValue;
    } else if (targetPeriod !== null && targetPeriod >= 1 && targetPeriod <= 24) {
      const monthObj = draft.months[targetPeriod - 1];
      if (monthObj) {
        if (targetKey in monthObj) {
          (monthObj as unknown as Record<string, unknown>)[targetKey] = proposedValue;
        } else {
          throw new Error(`Unknown target key for month assumption: ${targetKey}`);
        }
      }
    } else {
      throw new Error(`Invalid target period for operation: ${targetPeriod}`);
    }
  }

  return draft;
}
