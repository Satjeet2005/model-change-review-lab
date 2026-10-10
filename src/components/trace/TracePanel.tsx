import React from 'react';
import { useAppState, useAppDispatch } from '@/state/AppProvider';
import { Button } from '@/components/ui/Button';
import { TraceNodeList } from './TraceNodeList';
import { CellId } from '@/domain/types';

export interface TracePanelProps {
  onClose?: () => void;
}

export function TracePanel({ onClose }: TracePanelProps): React.JSX.Element | null {
  const { selectedTraceCellId, traceIndex, revision } = useAppState();
  const dispatch = useAppDispatch();

  if (!selectedTraceCellId) {
    return null;
  }

  const selectedNode = traceIndex.nodes[selectedTraceCellId];

  function handleClose() {
    if (onClose) {
      onClose();
    } else {
      dispatch({ type: 'SET_SELECTED_TRACE_CELL', cellId: null });
    }
  }

  function handleSelectNode(cellId: CellId) {
    dispatch({ type: 'SET_SELECTED_TRACE_CELL', cellId });
  }

  return (
    <section
      role="region"
      aria-label="Formula Dependency Trace Panel"
      className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 shadow-xs space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm sm:text-base font-bold text-neutral-900 tracking-tight">
              Formula Dependency Trace
            </h2>
            <span
              className="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded"
              title="Explains prototype formula definitions; not proprietary Drivetrain semantics"
            >
              Prototype Formula
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Synchronized with working scenario at revision{' '}
            <code className="font-mono font-bold text-neutral-700">{revision}</code>
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleClose}
          aria-label="Close Trace Panel"
          className="text-xs"
        >
          Close
        </Button>
      </div>

      {/* Selected Cell Root Info */}
      {!selectedNode ? (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
          Selected cell <code className="font-mono">{selectedTraceCellId}</code> does not exist in
          trace index.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-md">
            <div className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Selected Cell for Trace:</span>
              <span>Active Selection Root</span>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-bold text-neutral-900">{selectedNode.label}</span>
              <code className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-blue-200 text-neutral-700">
                {selectedNode.id}
              </code>
            </div>
          </div>

          {/* Recursive Dependency Tree */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
              Dependency Chain (DAG)
            </h3>
            <div className="border border-neutral-200 rounded-md p-3 bg-neutral-50/30 max-h-[460px] overflow-y-auto">
              <TraceNodeList
                nodeId={selectedTraceCellId}
                traceIndex={traceIndex}
                onSelectNode={handleSelectNode}
              />
            </div>
          </div>
        </div>
      )}

      {/* Disclosure disclaimer */}
      <div className="text-[11px] text-neutral-400 border-t border-neutral-100 pt-2 italic">
        Note: Traces reflect explicit calculation rules defined in the prototype domain engine.
      </div>
    </section>
  );
}
