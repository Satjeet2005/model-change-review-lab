import React from 'react';
import { CellId, TraceIndex, TraceNode } from '@/domain/types';
import { formatCurrency, formatPercentage, formatInteger } from '@/domain/formatting';

export interface TraceNodeListProps {
  nodeId: CellId;
  traceIndex: TraceIndex;
  visitedIds?: Set<CellId>;
  depth?: number;
  onSelectNode?: (cellId: CellId) => void;
}

function formatNodeValue(node: TraceNode): string {
  if (node.unit === '$') {
    return formatCurrency(node.value);
  }
  if (node.unit === '%') {
    return formatPercentage(node.value);
  }
  if (node.unit === 'FTE') {
    return formatInteger(node.value);
  }
  return String(node.value);
}

export function TraceNodeList({
  nodeId,
  traceIndex,
  visitedIds = new Set<CellId>(),
  depth = 0,
  onSelectNode
}: TraceNodeListProps): React.JSX.Element {
  const node = traceIndex.nodes[nodeId];

  // Defensive check for dangling node reference
  if (!node) {
    return (
      <div className="p-2 text-xs text-red-600 bg-red-50 rounded border border-red-200">
        Unknown dependency cell: <code className="font-mono">{nodeId}</code>
      </div>
    );
  }

  // Cycle prevention guard
  if (visitedIds.has(nodeId)) {
    return (
      <div className="p-2 text-xs text-amber-700 bg-amber-50 rounded border border-amber-200">
        Circular reference detected: <code className="font-mono">{nodeId}</code>
      </div>
    );
  }

  const nextVisited = new Set(visitedIds);
  nextVisited.add(nodeId);

  const isAssumptionOrSetting = node.kind === 'assumption' || node.kind === 'setting';
  const hasInputs = node.inputIds && node.inputIds.length > 0;

  return (
    <div className={`space-y-2 ${depth > 0 ? 'ml-4 pl-3 border-l-2 border-neutral-200' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2.5 rounded-md bg-neutral-50 border border-neutral-200 hover:bg-neutral-100/70 transition-colors">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-neutral-900">{node.label}</span>
            <span
              className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded tracking-wide ${
                node.kind === 'calculated'
                  ? 'bg-blue-100 text-blue-800'
                  : node.kind === 'assumption'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {node.kind}
            </span>
          </div>
          {node.formulaLabel && (
            <p className="text-[11px] font-mono text-neutral-600 italic">= {node.formulaLabel}</p>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className="text-xs font-mono font-bold text-neutral-900 bg-white px-2 py-0.5 rounded border border-neutral-200 tabular-nums">
            {formatNodeValue(node)}
          </span>
          {onSelectNode && node.kind === 'calculated' && depth > 0 && (
            <button
              type="button"
              onClick={() => onSelectNode(node.id)}
              className="text-[11px] text-blue-600 hover:underline cursor-pointer"
              title={`Trace ${node.label} directly`}
            >
              Trace this
            </button>
          )}
        </div>
      </div>

      {/* Recursive Inputs Rendering */}
      {hasInputs && (
        <div className="space-y-2 mt-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 pl-1">
            Inputs:
          </div>
          {node.inputIds.map((inputId) => (
            <TraceNodeList
              key={inputId}
              nodeId={inputId}
              traceIndex={traceIndex}
              visitedIds={nextVisited}
              depth={depth + 1}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}

      {isAssumptionOrSetting && depth > 0 && (
        <div className="text-[11px] text-neutral-400 italic pl-1">
          ↳ Terminal input ({node.kind})
        </div>
      )}
    </div>
  );
}
