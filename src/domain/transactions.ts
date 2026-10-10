import { calculateModel } from './calculation';
import { applyOperationsToDraft, cloneModelAssumptions } from './operations';
import {
  CalculatedModel,
  CellId,
  ModelAssumptions,
  ProposalOperation,
  TransactionKind,
  TransactionRecord
} from './types';

export interface TransactionResult {
  transaction: TransactionRecord;
  newAssumptions: ModelAssumptions;
  calculatedModel: CalculatedModel;
}

/**
 * Orchestrates atomic commitment of manual edits or accepted proposals.
 * PRD §6.8 & §6.9: Validates all operations, applies to isolated draft, calculates new model.
 * If any step fails, throws without mutating currentAssumptions.
 */
export function commitTransaction(
  currentAssumptions: Readonly<ModelAssumptions>,
  operations: ProposalOperation[],
  kind: TransactionKind,
  description: string,
  currentRevision: number
): TransactionResult {
  if (operations.length === 0) {
    throw new Error('Cannot commit empty transaction');
  }

  // 1. Create a snapshot copy of current assumptions
  const previousSnapshot = cloneModelAssumptions(currentAssumptions);

  // 2. Atomically validate and apply operations to draft (throws on failure)
  const newAssumptions = applyOperationsToDraft(previousSnapshot, operations);

  // 3. Recalculate canonical model using pure engine
  const calculatedModel = calculateModel(newAssumptions);

  // 4. Capture affected cell IDs
  const affectedCellIds: CellId[] = operations.map((op) => op.targetCellId);

  // 5. Construct transaction record
  const transaction: TransactionRecord = {
    id: `tx-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    timestamp: new Date().toISOString(),
    kind,
    description,
    affectedCellIds,
    previousAssumptions: previousSnapshot,
    newAssumptions: cloneModelAssumptions(newAssumptions),
    resultingRevision: currentRevision + 1
  };

  return {
    transaction,
    newAssumptions,
    calculatedModel
  };
}
