/**
 * Virtualized 10,000-Row × 24-Column Synthetic Grid (T-079, T-080 / FR-020 / PERF-001 / UI-10)
 *
 * Implements headless row virtualization via @tanstack/react-virtual.
 *
 * CRITICAL REQUIREMENTS:
 * 1. Exactly 10,000 rows × 24 columns in dataset.
 * 2. Fewer than 100 body rows mounted in viewport (< 100).
 * 3. Fixed / sticky column headers with aligned columns during horizontal & vertical scroll.
 * 4. Horizontal scrolling contained within the grid viewport (no page-level overflow).
 * 5. Sparse local cell overrides stored by stable cell ID without mutating the underlying dataset.
 * 6. Edits persist through vertical and horizontal scrolling.
 */

import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { SyntheticDataset, SyntheticRow } from './SyntheticDataset';

export interface VirtualGridProps {
  readonly dataset: SyntheticDataset;
  readonly overrides: Record<string, number>;
  readonly onCellOverrideChange: (cellKey: string, newValue: number, latencyMs: number) => void;
  readonly onGridReady?: (info: { durationMs: number; renderedRowCount: number }) => void;
  readonly benchmarkStartMark?: number | null;
}

const ROW_HEIGHT = 36;
const OVERSCAN_COUNT = 5;
const LABEL_COL_WIDTH = 180;
const PERIOD_COL_WIDTH = 100;

export function VirtualGrid({
  dataset,
  overrides,
  onCellOverrideChange,
  onGridReady,
  benchmarkStartMark
}: VirtualGridProps): React.JSX.Element {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string>('');
  const editStartRef = useRef<number>(0);
  const hasReportedReadyRef = useRef<boolean>(false);
  const lastStartMarkRef = useRef<number | null>(null);

  if (benchmarkStartMark !== lastStartMarkRef.current) {
    lastStartMarkRef.current = benchmarkStartMark ?? null;
    hasReportedReadyRef.current = false;
  }
  const rowVirtualizer = useVirtualizer({
    count: dataset.rowCount,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
    initialRect: { width: 1440, height: 540 },
    observeElementRect: (instance, cb) => {
      const element = instance.scrollElement;
      if (!element) return;
      const targetWindow = instance.targetWindow;
      const handler = (rect: { width: number; height: number }) => {
        const effectiveWidth = Math.round(rect.width) || 1440;
        const effectiveHeight = Math.round(rect.height) || 540;
        cb({ width: effectiveWidth, height: effectiveHeight });
      };
      handler(element.getBoundingClientRect());
      if (!targetWindow || !targetWindow.ResizeObserver) {
        return () => {};
      }
      const observer = new targetWindow.ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry?.borderBoxSize?.[0]) {
          const box = entry.borderBoxSize[0];
          handler({ width: box.inlineSize, height: box.blockSize });
        } else {
          handler(element.getBoundingClientRect());
        }
      });
      observer.observe(element);
      return () => observer.disconnect();
    }
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalHeight = rowVirtualizer.getTotalSize();

  // Total grid width: label column + 24 period columns
  const totalGridWidth = LABEL_COL_WIDTH + dataset.columnCount * PERIOD_COL_WIDTH;

  // Post-commit layout hook to measure grid-ready duration and count actual mounted rows
  useLayoutEffect(() => {
    if (hasReportedReadyRef.current) return;

    if (virtualRows.length > 0 && scrollContainerRef.current) {
      hasReportedReadyRef.current = true;
      const tCommit = performance.now();
      const start = benchmarkStartMark ?? tCommit;
      const durationMs = Math.round((tCommit - start) * 100) / 100;

      const mountedRowCount =
        scrollContainerRef.current.querySelectorAll('[data-virtual-row="true"]').length ||
        virtualRows.length;

      onGridReady?.({
        durationMs: Math.max(0, durationMs),
        renderedRowCount: mountedRowCount
      });
    }
  }, [virtualRows, benchmarkStartMark, onGridReady]);

  // Start cell edit
  const handleCellClick = useCallback(
    (row: SyntheticRow, colIndex: number) => {
      const cellKey = `${row.id}:${colIndex}`;
      const currentValue = overrides[cellKey] ?? row.values[colIndex] ?? 0;
      editStartRef.current = performance.now();
      setEditingCellKey(cellKey);
      setDraftValue(String(currentValue));
    },
    [overrides]
  );

  // Commit cell edit with latency tracking
  const handleCommitEdit = useCallback(
    (cellKey: string) => {
      const num = parseFloat(draftValue);
      if (!isNaN(num)) {
        const tEnd = performance.now();
        const latencyMs = Math.round((tEnd - editStartRef.current) * 100) / 100;
        onCellOverrideChange(cellKey, num, latencyMs);
      }
      setEditingCellKey(null);
    },
    [draftValue, onCellOverrideChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, cellKey: string) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCommitEdit(cellKey);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditingCellKey(null);
      }
    },
    [handleCommitEdit]
  );

  return (
    <div
      className="relative flex flex-col bg-white border border-neutral-300 rounded-lg shadow-xs overflow-hidden max-w-full"
      data-testid="virtual-grid-container"
    >
      {/* Grid instructions and status bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 text-xs text-neutral-600">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-neutral-800">
            Synthetic Grid: {dataset.rowCount.toLocaleString()} Rows × {dataset.columnCount} Periods
            (240,000 Cells)
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-200 text-neutral-700">
            Row Virtualization Active
          </span>
        </div>
        <div className="flex items-center gap-4 text-neutral-500">
          <span>
            Mounted Rows: <strong className="text-neutral-800">{virtualRows.length}</strong> /
            10,000
          </span>
          <span>
            Overrides: <strong className="text-neutral-800">{Object.keys(overrides).length}</strong>
          </span>
        </div>
      </div>

      {/* Main Scrollable Viewport (horizontal + vertical scrolling contained inside) */}
      <div
        ref={scrollContainerRef}
        role="region"
        aria-label="10,000-row virtualized synthetic grid"
        tabIndex={0}
        className="h-[540px] overflow-auto focus:outline-none focus:ring-1 focus:ring-blue-500 select-none"
      >
        <div
          role="table"
          aria-label="Synthetic benchmark dataset"
          aria-rowcount={dataset.rowCount}
          aria-colcount={dataset.columnCount + 1}
          style={{ width: `${totalGridWidth}px` }}
          className="relative text-xs text-neutral-800"
        >
          {/* Sticky Header Row */}
          <div
            role="rowgroup"
            className="sticky top-0 z-20 bg-neutral-100 border-b-2 border-neutral-300 shadow-xs"
          >
            <div
              role="row"
              aria-rowindex={1}
              className="flex h-9 items-center font-semibold text-neutral-700"
            >
              {/* Sticky Line Item Header */}
              <div
                role="columnheader"
                aria-colindex={1}
                style={{ width: `${LABEL_COL_WIDTH}px` }}
                className="sticky left-0 z-30 bg-neutral-100 px-3 py-2 border-r border-neutral-200 shrink-0"
              >
                Line Item
              </div>

              {/* 24 Monthly Column Headers */}
              {dataset.columns.map((colName, colIdx) => (
                <div
                  key={colName}
                  role="columnheader"
                  aria-colindex={colIdx + 2}
                  style={{ width: `${PERIOD_COL_WIDTH}px` }}
                  className="px-2 py-2 text-right border-r border-neutral-200 shrink-0 tabular-nums"
                >
                  {colName}
                </div>
              ))}
            </div>
          </div>

          {/* Virtualized Body Container */}
          <div role="rowgroup" style={{ height: `${totalHeight}px`, position: 'relative' }}>
            {virtualRows.map((virtualRow) => {
              const row = dataset.getRow(virtualRow.index);
              if (!row) return null;

              const isEven = virtualRow.index % 2 === 0;

              return (
                <div
                  key={row.id}
                  role="row"
                  aria-rowindex={virtualRow.index + 2}
                  data-virtual-row="true"
                  data-row-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                  className={`flex items-center border-b border-neutral-200 transition-colors ${
                    isEven ? 'bg-white' : 'bg-neutral-50/60'
                  } hover:bg-blue-50/40`}
                >
                  {/* Sticky Row Label Column */}
                  <div
                    role="rowheader"
                    style={{ width: `${LABEL_COL_WIDTH}px` }}
                    className={`sticky left-0 z-10 px-3 py-1.5 font-medium border-r border-neutral-200 truncate shrink-0 ${
                      isEven ? 'bg-white' : 'bg-neutral-50'
                    }`}
                    title={row.label}
                  >
                    {row.label}
                  </div>

                  {/* 24 Value Columns */}
                  {row.values.map((baseValue, colIdx) => {
                    const cellKey = `${row.id}:${colIdx}`;
                    const hasOverride = Object.prototype.hasOwnProperty.call(overrides, cellKey);
                    const displayValue = hasOverride ? overrides[cellKey]! : baseValue;
                    const isEditing = editingCellKey === cellKey;

                    return (
                      <div
                        key={colIdx}
                        role="cell"
                        aria-colindex={colIdx + 2}
                        style={{ width: `${PERIOD_COL_WIDTH}px` }}
                        onClick={() => handleCellClick(row, colIdx)}
                        className={`h-full px-2 py-1.5 text-right font-mono tabular-nums border-r border-neutral-200 shrink-0 cursor-pointer flex items-center justify-end transition-colors ${
                          hasOverride
                            ? 'bg-amber-50 text-amber-900 font-semibold border-amber-300'
                            : 'text-neutral-700 hover:bg-neutral-100'
                        }`}
                        title={
                          hasOverride
                            ? `Edited override: ${displayValue} (base: ${baseValue})`
                            : `Value: ${displayValue}`
                        }
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            autoFocus
                            value={draftValue}
                            onChange={(e) => setDraftValue(e.target.value)}
                            onBlur={() => handleCommitEdit(cellKey)}
                            onKeyDown={(e) => handleKeyDown(e, cellKey)}
                            className="w-full text-right px-1 py-0.5 bg-white border border-blue-500 rounded text-neutral-900 font-mono text-xs focus:outline-none"
                            aria-label={`Edit ${row.label} ${dataset.columns[colIdx]}`}
                          />
                        ) : (
                          <span>${displayValue.toLocaleString()}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
