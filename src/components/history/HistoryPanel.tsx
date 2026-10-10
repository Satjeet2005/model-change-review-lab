import React from 'react';
import { TransactionRecord } from '@/domain/types';
import { StatusBadge } from '@/components/ui/StatusBadge';

export interface HistoryPanelProps {
  history: readonly TransactionRecord[];
  onUndoLast?: () => void;
  canUndo?: boolean;
}

export function HistoryPanel({
  history,
  onUndoLast,
  canUndo = false
}: HistoryPanelProps): React.JSX.Element {
  return (
    <section
      role="region"
      aria-label="Committed Change History"
      className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 shadow-xs space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-neutral-900 tracking-tight">Change History</h2>
            <StatusBadge variant="default">
              {history.length} {history.length === 1 ? 'Transaction' : 'Transactions'}
            </StatusBadge>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Committed model transitions ordered newest first (undoable local prototype history)
          </p>
        </div>

        {onUndoLast && (
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndoLast}
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs self-start sm:self-center"
          >
            Undo Latest Change
          </button>
        )}
      </div>

      {/* Empty State */}
      {history.length === 0 ? (
        <div
          role="status"
          className="p-8 text-center border border-dashed border-neutral-200 rounded-lg bg-neutral-50/50"
        >
          <p className="text-sm font-semibold text-neutral-700">No committed changes yet</p>
          <p className="text-xs text-neutral-500 mt-1 max-w-md mx-auto">
            The working scenario is currently identical to the baseline seed model. Edits committed
            directly or via accepted change proposals will be recorded here.
          </p>
        </div>
      ) : (
        /* Transaction Timeline */
        <div className="space-y-3" role="feed" aria-label="Transaction list">
          {history.map((tx, idx) => {
            const isManual = tx.kind === 'manual-edit';
            const cellCount = tx.affectedCellIds.length;
            const timeFormatted = new Date(tx.timestamp).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });

            return (
              <article
                key={tx.id}
                aria-posinset={idx + 1}
                aria-setsize={history.length}
                className="p-3.5 rounded-lg border border-neutral-200 bg-neutral-50/40 hover:bg-neutral-50 transition-colors space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge variant={isManual ? 'info' : 'success'}>
                      {isManual ? 'Manual Edit' : 'Accepted Proposal'}
                    </StatusBadge>
                    <span className="text-xs font-bold text-neutral-900">{tx.description}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-500">
                    <span>Resulting Rev: {tx.resultingRevision}</span>
                    <span>·</span>
                    <time dateTime={tx.timestamp}>{timeFormatted}</time>
                  </div>
                </div>

                <div className="text-xs text-neutral-600">
                  <span className="font-medium text-neutral-700">
                    {cellCount} affected {cellCount === 1 ? 'cell' : 'cells'}:
                  </span>{' '}
                  <span className="font-mono text-[11px] text-neutral-500">
                    {tx.affectedCellIds.slice(0, 4).join(', ')}
                    {cellCount > 4 ? ` … and ${cellCount - 4} more` : ''}
                  </span>
                </div>

                {/* Diff summary for manual edit or first operation */}
                {isManual && tx.affectedCellIds[0] && (
                  <div className="text-[11px] font-mono bg-white px-2.5 py-1.5 rounded border border-neutral-200 flex items-center gap-2">
                    <span className="text-neutral-500">Target: {tx.affectedCellIds[0]}</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Audit disclaimer */}
      <div className="text-[11px] text-neutral-400 border-t border-neutral-100 pt-2 italic">
        Disclaimer: Change history is maintained in-memory for interactive review and does not
        constitute an immutable, compliance-grade audit log.
      </div>
    </section>
  );
}
