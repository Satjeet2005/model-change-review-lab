/**
 * Performance Lab Synthetic Dataset Generator (T-078 / FR-019 / PERF-003 / UI-10)
 *
 * Implements a deterministic 10,000-row × 24-column synthetic dataset (240,000 cells)
 * designed specifically for headless row virtualization stress-testing.
 *
 * NON-NEGOTIABLE BOUNDARY:
 * This module is completely isolated from the canonical financial model (src/domain/calculation.ts).
 * The synthetic dataset must NEVER be passed to calculateModel, and synthetic edits never
 * mutate the canonical financial assumptions, baseline, or transaction history.
 */

export const DEFAULT_SYNTHETIC_SEED = 42;
export const DEFAULT_SYNTHETIC_ROWS = 10_000;
export const DEFAULT_SYNTHETIC_COLS = 24;

export interface SyntheticRow {
  /** Stable row identifier, e.g. "row-00001" */
  readonly id: string;
  /** Human-readable row label, e.g. "Synthetic Line Item 00001" */
  readonly label: string;
  /** Exactly 24 deterministic numerical values */
  readonly values: readonly number[];
}

export interface SyntheticDataset {
  readonly rowCount: number;
  readonly columnCount: number;
  readonly seed: number;
  readonly columns: readonly string[];
  readonly rows: readonly SyntheticRow[];
  getRow(rowIndex: number): SyntheticRow | undefined;
  getCellValue(rowIndex: number, columnIndex: number): number | undefined;
}

/**
 * Generate 24 standard period column labels: M01 through M24.
 */
export function generateSyntheticColumnLabels(columnCount = DEFAULT_SYNTHETIC_COLS): string[] {
  return Array.from({ length: columnCount }, (_, index) => {
    const periodNum = String(index + 1).padStart(2, '0');
    return `M${periodNum}`;
  });
}

/**
 * Compute a deterministic synthetic cell value using the PRD §12.2 formula:
 * value = 1000 + ((rowIndex * 37 + columnIndex * 13 + seed) % 9000)
 */
export function computeSyntheticCellValue(
  rowIndex: number,
  columnIndex: number,
  seed: number = DEFAULT_SYNTHETIC_SEED
): number {
  return 1000 + ((((rowIndex * 37 + columnIndex * 13 + seed) % 9000) + 9000) % 9000);
}

/**
 * Generates an in-memory 10,000-row × 24-column dataset deterministically.
 * Memory complexity: ~240,000 numeric primitives across 10,000 rows (~8-12 MB).
 */
export function generateSyntheticDataset(
  seed: number = DEFAULT_SYNTHETIC_SEED,
  rowCount: number = DEFAULT_SYNTHETIC_ROWS,
  columnCount: number = DEFAULT_SYNTHETIC_COLS
): SyntheticDataset {
  const columns = Object.freeze(generateSyntheticColumnLabels(columnCount));
  const rows: SyntheticRow[] = new Array(rowCount);

  for (let r = 0; r < rowCount; r++) {
    const rowId = `row-${String(r + 1).padStart(5, '0')}`;
    const rowLabel = `Line Item ${String(r + 1).padStart(5, '0')}`;
    const values: number[] = new Array(columnCount);

    for (let c = 0; c < columnCount; c++) {
      values[c] = computeSyntheticCellValue(r, c, seed);
    }

    rows[r] = Object.freeze({
      id: rowId,
      label: rowLabel,
      values: Object.freeze(values)
    });
  }

  const frozenRows = Object.freeze(rows);

  return Object.freeze({
    rowCount,
    columnCount,
    seed,
    columns,
    rows: frozenRows,
    getRow(rowIndex: number): SyntheticRow | undefined {
      return frozenRows[rowIndex];
    },
    getCellValue(rowIndex: number, columnIndex: number): number | undefined {
      const row = frozenRows[rowIndex];
      return row ? row.values[columnIndex] : undefined;
    }
  });
}
