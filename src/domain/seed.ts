import { ModelAssumptions } from './types';
import seedData from '../../shared/seed-assumptions.json';

/**
 * Creates the deterministic baseline seed assumptions.
 * PRD §4.2: Loads canonical shared seed fixture and returns a fresh unshared object.
 */
export function createSeedAssumptions(): ModelAssumptions {
  return structuredClone(seedData) as ModelAssumptions;
}
