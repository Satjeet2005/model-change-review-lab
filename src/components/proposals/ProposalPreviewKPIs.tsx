import React, { useMemo } from 'react';
import { ChangeProposal } from '@/domain/types';
import { ModelAssumptions } from '@/domain/types';
import { applyOperationsToDraft } from '@/domain/operations';
import { calculateModel } from '@/domain/calculation';
import { formatCurrency, formatDelta } from '@/domain/formatting';

export interface ProposalPreviewKPIsProps {
  proposal: ChangeProposal;
  workingAssumptions: ModelAssumptions;
}

export function ProposalPreviewKPIs({
  proposal,
  workingAssumptions
}: ProposalPreviewKPIsProps): React.JSX.Element {
  // Cloned preview calculation using pure Phase 1 engine
  const previewData = useMemo(() => {
    try {
      const draft = applyOperationsToDraft(workingAssumptions, proposal.operations);
      const workingCalculated = calculateModel(workingAssumptions);
      const draftCalculated = calculateModel(draft);

      const wSum = workingCalculated.summary;
      const dSum = draftCalculated.summary;

      return {
        valid: true,
        m24Revenue: dSum.m24Revenue,
        revenueDelta: dSum.m24Revenue - wSum.m24Revenue,
        m24Ebitda: dSum.m24Ebitda,
        ebitdaDelta: dSum.m24Ebitda - wSum.m24Ebitda,
        m24EndingCash: dSum.m24EndingCash,
        cashDelta: dSum.m24EndingCash - wSum.m24EndingCash,
        error: null
      };
    } catch (err) {
      return {
        valid: false,
        m24Revenue: 0,
        revenueDelta: 0,
        m24Ebitda: 0,
        ebitdaDelta: 0,
        m24EndingCash: 0,
        cashDelta: 0,
        error: err instanceof Error ? err.message : 'Invalid operation preview'
      };
    }
  }, [proposal, workingAssumptions]);

  if (!previewData.valid) {
    return (
      <div
        role="alert"
        className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700"
      >
        <span className="font-semibold">Preview Unavailable:</span> {previewData.error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Revenue Impact */}
      <div className="p-3 bg-white border border-neutral-200 rounded-md shadow-2xs">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Preview M24 Revenue
          </span>
          <span
            className={`text-xs font-mono font-medium px-1.5 py-0.2 rounded ${
              previewData.revenueDelta > 0
                ? 'bg-green-50 text-green-700'
                : previewData.revenueDelta < 0
                  ? 'bg-red-50 text-red-700'
                  : 'text-neutral-500'
            }`}
          >
            {formatDelta(previewData.revenueDelta, 'currency')}
          </span>
        </div>
        <div className="text-lg font-bold font-mono tabular-nums text-neutral-900">
          {formatCurrency(previewData.m24Revenue)}
        </div>
      </div>

      {/* EBITDA Impact */}
      <div className="p-3 bg-white border border-neutral-200 rounded-md shadow-2xs">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Preview M24 EBITDA
          </span>
          <span
            className={`text-xs font-mono font-medium px-1.5 py-0.2 rounded ${
              previewData.ebitdaDelta > 0
                ? 'bg-green-50 text-green-700'
                : previewData.ebitdaDelta < 0
                  ? 'bg-red-50 text-red-700'
                  : 'text-neutral-500'
            }`}
          >
            {formatDelta(previewData.ebitdaDelta, 'currency')}
          </span>
        </div>
        <div
          className={`text-lg font-bold font-mono tabular-nums ${
            previewData.m24Ebitda < 0 ? 'text-red-600' : 'text-neutral-900'
          }`}
        >
          {formatCurrency(previewData.m24Ebitda)}
        </div>
      </div>

      {/* Ending Cash Impact */}
      <div className="p-3 bg-white border border-neutral-200 rounded-md shadow-2xs">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
            Preview M24 Ending Cash
          </span>
          <span
            className={`text-xs font-mono font-medium px-1.5 py-0.2 rounded ${
              previewData.cashDelta > 0
                ? 'bg-green-50 text-green-700'
                : previewData.cashDelta < 0
                  ? 'bg-red-50 text-red-700'
                  : 'text-neutral-500'
            }`}
          >
            {formatDelta(previewData.cashDelta, 'currency')}
          </span>
        </div>
        <div
          className={`text-lg font-bold font-mono tabular-nums ${
            previewData.m24EndingCash < 0 ? 'text-red-600' : 'text-neutral-900'
          }`}
        >
          {formatCurrency(previewData.m24EndingCash)}
        </div>
      </div>
    </div>
  );
}
