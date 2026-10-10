import React, { useMemo } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppProvider';
import { CellId } from '@/domain/types';
import { validateOperationSet } from '@/domain/validation';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { InlineNotice } from '@/components/app/InlineNotice';
import { ProposalDiff } from './ProposalDiff';
import { ProposalPreviewKPIs } from './ProposalPreviewKPIs';

export function ProposalReviewPanel(): React.JSX.Element | null {
  const { pendingProposal, proposalStatus, proposalError, revision, workingAssumptions } =
    useAppState();
  const dispatch = useAppDispatch();

  // Validate current draft operations (declared before any early returns to obey Rules of Hooks)
  const operationsValidation = useMemo(() => {
    if (!pendingProposal) return { valid: true, errors: [] };
    return validateOperationSet(pendingProposal.operations);
  }, [pendingProposal]);

  // If no proposal is pending and not in acknowledged/error state, do not render panel
  if (!pendingProposal && proposalStatus !== 'error' && proposalStatus !== 'rejected') {
    return null;
  }

  // 1. Revision / Stale guard (PRD §6.8, §7.5, §14): Check if proposal baseRevision matches current revision
  const isStale = Boolean(pendingProposal && pendingProposal.baseRevision !== revision);

  const hasInvalidOperations = !operationsValidation.valid;
  const canAccept =
    pendingProposal &&
    !isStale &&
    !hasInvalidOperations &&
    proposalStatus !== 'accepted' &&
    proposalStatus !== 'generating';

  function handleAccept() {
    if (!canAccept) return;
    dispatch({ type: 'PROPOSAL_ACCEPT' });
  }

  function handleReject() {
    dispatch({ type: 'PROPOSAL_REJECT' });
  }

  function handleDismiss() {
    dispatch({ type: 'PROPOSAL_DISMISS' });
  }

  function handleEditOperation(targetCellId: CellId, proposedValue: number) {
    dispatch({ type: 'PROPOSAL_EDIT_OPERATION', targetCellId, proposedValue });
  }

  // Acknowledgement banner for accepted state
  if (proposalStatus === 'accepted') {
    return (
      <div className="bg-green-50 border border-green-300 rounded-lg p-4 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-green-700 font-bold text-sm">✓ Change Proposal Accepted</span>
            <StatusBadge variant="success">Committed to Working Scenario</StatusBadge>
          </div>
          <Button size="sm" variant="outline" onClick={handleDismiss} className="text-xs">
            Dismiss
          </Button>
        </div>
        <p className="mt-2 text-xs text-green-900 leading-relaxed">
          The proposed operations have been atomically committed into the working financial model.
          Model revision advanced to <code className="font-mono font-bold">{revision}</code>. All
          derived metrics and trace indices have been recomputed.
        </p>
      </div>
    );
  }

  // Acknowledgement banner for rejected state
  if (proposalStatus === 'rejected') {
    return (
      <div className="bg-neutral-50 border border-neutral-300 rounded-lg p-4 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-neutral-700 font-bold text-sm">Proposal Rejected</span>
            <StatusBadge variant="default">Discarded</StatusBadge>
          </div>
          <Button size="sm" variant="outline" onClick={handleDismiss} className="text-xs">
            Dismiss
          </Button>
        </div>
        <p className="mt-2 text-xs text-neutral-600">
          The simulated proposal was discarded. No canonical assumptions, calculated outputs, or
          model revisions were altered.
        </p>
      </div>
    );
  }

  // Error state without a draft
  if (!pendingProposal && proposalStatus === 'error') {
    return (
      <div className="bg-red-50 border border-red-300 rounded-lg p-4 shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <span className="text-red-700 font-bold text-sm">Proposal Generation Failed</span>
          <Button size="sm" variant="outline" onClick={handleDismiss} className="text-xs">
            Dismiss
          </Button>
        </div>
        <p className="mt-2 text-xs text-red-800">{proposalError}</p>
      </div>
    );
  }

  if (!pendingProposal) return null;

  return (
    <section
      role="region"
      aria-label="Change Proposal Review and Approval Panel"
      className="bg-white border border-neutral-200 rounded-lg p-4 sm:p-5 shadow-xs space-y-4"
    >
      {/* 1. Proposal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-neutral-900 tracking-tight">
              {pendingProposal.title}
            </h2>
            <StatusBadge variant={isStale ? 'stale' : 'info'}>
              {isStale ? 'Stale Proposal' : 'Simulated Proposal'}
            </StatusBadge>
          </div>
          <p className="text-xs text-neutral-600">{pendingProposal.description}</p>
        </div>

        {/* Metadata info */}
        <div className="flex sm:flex-col sm:items-end gap-1 text-[11px] text-neutral-400 font-mono">
          <span>Base Revision: {pendingProposal.baseRevision}</span>
          <span>Current Revision: {revision}</span>
        </div>
      </div>

      {/* 2. Critical Stale Warning Notification */}
      {isStale && (
        <InlineNotice variant="error" title="Stale Revision Detected">
          This proposal was generated against model revision {pendingProposal.baseRevision}, but the
          active working model has advanced to revision {revision}. To prevent unintended or
          conflicting data mutations, stale proposals cannot be accepted. Please reject or generate
          a fresh proposal against the current revision.
        </InlineNotice>
      )}

      {/* 3. Validation Errors in edited draft */}
      {hasInvalidOperations && (
        <InlineNotice variant="error" title="Invalid Operations">
          {operationsValidation.errors.map((e, idx) => (
            <div key={idx}>• {e.message}</div>
          ))}
        </InlineNotice>
      )}

      {/* 4. Top-level Proposal Execution Error */}
      {proposalError && !isStale && !hasInvalidOperations && (
        <InlineNotice variant="error" title="Action Failed">
          {proposalError}
        </InlineNotice>
      )}

      {/* 5. Isolated Preview KPIs */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-2">
          Projected Impact Preview (Cloned Draft Engine)
        </h3>
        <ProposalPreviewKPIs proposal={pendingProposal} workingAssumptions={workingAssumptions} />
      </div>

      {/* 6. Structured Diff Table */}
      <ProposalDiff
        operations={pendingProposal.operations}
        onEditOperation={handleEditOperation}
        readOnly={isStale}
      />

      {/* 7. Action Bar: Human Decision Gateway */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-100">
        <div className="text-[11px] text-neutral-500">
          Accepting applies all operations atomically to the working scenario.
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReject}
            className="text-neutral-700 hover:text-neutral-900"
          >
            Reject Proposal
          </Button>

          <Button
            type="button"
            disabled={!canAccept}
            onClick={handleAccept}
            title={
              isStale
                ? 'Proposal is stale and cannot be accepted'
                : hasInvalidOperations
                  ? 'Resolve invalid operations before accepting'
                  : 'Accept and atomically apply changes'
            }
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            Accept Proposal
          </Button>
        </div>
      </div>
    </section>
  );
}
