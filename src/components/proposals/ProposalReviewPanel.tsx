import React, { useMemo, useState, useRef } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppProvider';
import { getNextVariantLabel } from '@/state/appReducer';
import {
  CalculatedRowKey,
  CellId,
  ProposalOperation,
  ProposalTemplateId,
  ProposalVariant,
  ProposalWorkspace
} from '@/domain/types';
import {
  validateProposalAcceptance,
  validateVariantOperationsForPreview
} from '@/domain/validation';
import { MockProposalProvider } from '@/domain/proposals';
import { cloneModelAssumptions, cloneProposalOperations } from '@/domain/operations';
import { calculateProposalVariantComparison } from '@/domain/proposalComparison';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { InlineNotice } from '@/components/app/InlineNotice';
import { ProposalDiff } from './ProposalDiff';
import { ProposalPreviewKPIs } from './ProposalPreviewKPIs';
import { ProposalImpactChart } from './ProposalImpactChart';
import { ProposalImpactTable } from './ProposalImpactTable';

export interface ProposalReviewPanelProps {
  proposalProvider?: MockProposalProvider;
}

export function ProposalReviewPanel({
  proposalProvider = new MockProposalProvider()
}: ProposalReviewPanelProps): React.JSX.Element | null {
  const {
    proposalWorkspace,
    archivedStaleWorkspaces,
    pendingProposal,
    proposalStatus,
    proposalError,
    revision,
    workingAssumptions
  } = useAppState();
  const dispatch = useAppDispatch();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedImpactMetric, setSelectedImpactMetric] = useState<CalculatedRowKey>('revenue');
  const [previewTab, setPreviewTab] = useState<'summary' | 'chart' | 'table'>('summary');
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [comparisonVariantBId, setComparisonVariantBId] = useState<string | null>(null);
  const [inspectingArchivedId, setInspectingArchivedId] = useState<string | null>(null);

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Active workspace / proposal data
  const activeWorkspace = proposalWorkspace;
  const selectedVariant: ProposalVariant | null = useMemo(() => {
    if (activeWorkspace) {
      return (
        activeWorkspace.variants.find((v) => v.id === activeWorkspace.selectedVariantId) ??
        activeWorkspace.variants[0] ??
        null
      );
    }
    if (pendingProposal) {
      return {
        id: 'legacy-var',
        label: 'Original proposal',
        sourceTemplateId: (pendingProposal.id as ProposalTemplateId) || 'hire-engineers-from-q3',
        operations: pendingProposal.operations,
        resetSnapshotOperations: pendingProposal.operations,
        createdAt: pendingProposal.createdAt
      };
    }
    return null;
  }, [activeWorkspace, pendingProposal]);

  const activeOperations = useMemo(
    () => (selectedVariant ? selectedVariant.operations : []),
    [selectedVariant]
  );

  const baseRevision = activeWorkspace
    ? activeWorkspace.baseRevision
    : (pendingProposal?.baseRevision ?? revision);

  const baseAssumptions = useMemo(() => {
    if (activeWorkspace) return activeWorkspace.baseAssumptions;
    return cloneModelAssumptions(workingAssumptions);
  }, [activeWorkspace, workingAssumptions]);

  const title = activeWorkspace?.title ?? pendingProposal?.title ?? 'Proposal';
  const description = activeWorkspace?.description ?? pendingProposal?.description ?? '';

  // Revision / Stale guard (PRD §6.8, §7.5, §14): Check if proposal baseRevision matches current revision
  const isStale = Boolean(baseRevision !== revision);

  // Variant B for comparison
  const variantB = useMemo(() => {
    if (!activeWorkspace || activeWorkspace.variants.length < 2) return null;
    if (comparisonVariantBId) {
      const found = activeWorkspace.variants.find((v) => v.id === comparisonVariantBId);
      if (found && found.id !== selectedVariant?.id) return found;
    }
    // Default to the first sibling variant that is not selectedVariant
    return activeWorkspace.variants.find((v) => v.id !== selectedVariant?.id) ?? null;
  }, [activeWorkspace, comparisonVariantBId, selectedVariant]);

  // Validate variant operations for preview (Fix 4)
  const variantAValidation = useMemo(
    () => validateVariantOperationsForPreview(activeOperations, baseAssumptions),
    [activeOperations, baseAssumptions]
  );

  const variantBValidation = useMemo(
    () =>
      isCompareMode && variantB
        ? validateVariantOperationsForPreview(variantB.operations, baseAssumptions)
        : { valid: true, errors: [] },
    [isCompareMode, variantB, baseAssumptions]
  );

  const hasPreviewValidationErrors = !variantAValidation.valid || !variantBValidation.valid;

  // Pure 24-month comparison calculation
  const comparisonResult = useMemo(() => {
    if (!selectedVariant || isStale || hasPreviewValidationErrors) return null;
    try {
      const variantBOps = isCompareMode && variantB ? variantB.operations : undefined;
      return calculateProposalVariantComparison(baseAssumptions, activeOperations, variantBOps);
    } catch {
      return null;
    }
  }, [
    baseAssumptions,
    activeOperations,
    isCompareMode,
    variantB,
    selectedVariant,
    isStale,
    hasPreviewValidationErrors
  ]);

  // Revalidate current operations against base assumptions
  const operationsValidation = useMemo(() => {
    if (activeOperations.length === 0) {
      return { valid: false, errors: [{ message: 'No operations' }] };
    }
    return validateProposalAcceptance(activeOperations, baseAssumptions);
  }, [activeOperations, baseAssumptions]);

  const hasEffectiveChanges = useMemo(() => {
    return activeOperations.some((op) => op.proposedValue !== op.previousValue);
  }, [activeOperations]);

  const hasInvalidOperations = !operationsValidation.valid && hasEffectiveChanges;

  const canAccept =
    Boolean(selectedVariant) &&
    !isStale &&
    hasEffectiveChanges &&
    operationsValidation.valid &&
    proposalStatus !== 'accepted' &&
    proposalStatus !== 'generating';

  function handleSelectVariant(variantId: string) {
    dispatch({ type: 'WORKSPACE_SELECT_VARIANT', variantId });
  }

  function handleTabKeyDown(e: React.KeyboardEvent, index: number) {
    if (!activeWorkspace) return;
    const count = activeWorkspace.variants.length;
    let targetIndex = -1;
    if (e.key === 'ArrowRight') {
      targetIndex = (index + 1) % count;
    } else if (e.key === 'ArrowLeft') {
      targetIndex = (index - 1 + count) % count;
    }
    if (targetIndex >= 0) {
      e.preventDefault();
      const targetVariant = activeWorkspace.variants[targetIndex];
      if (targetVariant) {
        handleSelectVariant(targetVariant.id);
        tabRefs.current[targetVariant.id]?.focus();
      }
    }
  }

  function handleDuplicateVariant() {
    if (!selectedVariant || isStale || !activeWorkspace) return;
    const newLabel = getNextVariantLabel(activeWorkspace.variants);
    const newVariantId = `var-${selectedVariant.id}-dup-${Date.now()}`;
    const createdAt = new Date().toISOString();
    dispatch({
      type: 'WORKSPACE_DUPLICATE_VARIANT',
      sourceVariantId: selectedVariant.id,
      newVariantId,
      newLabel,
      createdAt
    });
  }

  function handleRemoveVariant(variantId: string) {
    dispatch({ type: 'WORKSPACE_REMOVE_VARIANT', variantId });
    if (activeWorkspace) {
      const remaining = activeWorkspace.variants.find((v) => v.id !== variantId);
      if (remaining) {
        tabRefs.current[remaining.id]?.focus();
      }
    }
  }

  function handleResetEdits() {
    if (!selectedVariant || isStale) return;
    dispatch({
      type: 'WORKSPACE_RESET_VARIANT_EDITS',
      variantId: selectedVariant.id
    });
  }

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
    if (selectedVariant) {
      dispatch({
        type: 'WORKSPACE_EDIT_OPERATION',
        variantId: selectedVariant.id,
        targetCellId,
        proposedValue
      });
    } else {
      dispatch({ type: 'PROPOSAL_EDIT_OPERATION', targetCellId, proposedValue });
    }
  }

  async function handleCreateFreshVersion() {
    if (isRefreshing || !activeWorkspace) return;
    setIsRefreshing(true);
    const templateId = activeWorkspace.sourceTemplateId;

    // 1. Archive current stale workspace
    dispatch({ type: 'WORKSPACE_ARCHIVE_STALE' });

    // 2. Dispatch correlated fresh request
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const requestRevision = revision;
    const requestAssumptions = cloneModelAssumptions(workingAssumptions);

    dispatch({
      type: 'PROPOSAL_GENERATE_START',
      requestId,
      requestRevision,
      requestAssumptions
    });

    try {
      const generated = await proposalProvider.generateProposal(
        templateId,
        requestAssumptions,
        requestRevision
      );

      const variantId = `var-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const ops = cloneProposalOperations(generated.operations);
      const variant: ProposalVariant = {
        id: variantId,
        label: 'Original proposal',
        sourceTemplateId: templateId,
        operations: ops,
        resetSnapshotOperations: cloneProposalOperations(ops),
        createdAt: new Date().toISOString()
      };

      const freshWorkspace: ProposalWorkspace = {
        id: `ws-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        baseRevision: requestRevision,
        baseAssumptions: requestAssumptions,
        sourceTemplateId: templateId,
        title: generated.title,
        description: generated.description,
        variants: [variant],
        selectedVariantId: variant.id,
        comparisonVariantIds: [variant.id],
        createdAt: new Date().toISOString()
      };

      dispatch({
        type: 'PROPOSAL_GENERATE_SUCCESS',
        requestId,
        workspace: freshWorkspace
      });
    } catch (err) {
      dispatch({
        type: 'PROPOSAL_GENERATE_ERROR',
        requestId,
        error: err instanceof Error ? err.message : 'Fresh proposal generation failed'
      });
    } finally {
      setIsRefreshing(false);
    }
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
  if (!activeWorkspace && !pendingProposal && proposalStatus === 'error') {
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

  // Render archived drafts even if active workspace is dismissed
  if (!activeWorkspace && !pendingProposal) {
    if (archivedStaleWorkspaces.length > 0) {
      return (
        <section
          role="region"
          aria-label="Archived Stale Drafts"
          className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              Archived Stale Drafts ({archivedStaleWorkspaces.length})
            </h3>
            <span className="text-[11px] text-neutral-500">Read-only historical snapshots</span>
          </div>
          <div className="space-y-2">
            {archivedStaleWorkspaces.map((ws) => {
              const isInspecting = inspectingArchivedId === ws.id;
              return (
                <div
                  key={ws.id}
                  className="p-3 bg-white border border-neutral-200 rounded-md text-xs space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-neutral-800">{ws.title}</span>
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-mono">
                        Historical Base Rev: {ws.baseRevision}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-500">{ws.variants.length} variants</span>
                      <button
                        type="button"
                        onClick={() => setInspectingArchivedId(isInspecting ? null : ws.id)}
                        className="text-xs text-blue-600 hover:underline cursor-pointer"
                      >
                        {isInspecting ? 'Hide operations' : 'Inspect operations'}
                      </button>
                    </div>
                  </div>
                  {isInspecting && (
                    <div className="mt-2 pt-2 border-t border-neutral-200 space-y-3">
                      {ws.variants.map((v) => (
                        <div key={v.id} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-neutral-700">{v.label}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              (Historical Snapshot — Base Rev {ws.baseRevision})
                            </span>
                          </div>
                          <ProposalDiff operations={v.operations} readOnly={true} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      );
    }
    return null;
  }

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
            <h2 className="text-base font-bold text-neutral-900 tracking-tight">{title}</h2>
            <StatusBadge variant={isStale ? 'stale' : 'info'}>
              {isStale ? 'Stale Proposal' : 'Simulated Proposal'}
            </StatusBadge>
          </div>
          <p className="text-xs text-neutral-600">{description}</p>
        </div>

        {/* Metadata info */}
        <div className="flex sm:flex-col sm:items-end gap-1 text-[11px] text-neutral-400 font-mono">
          <span>Base Revision: {baseRevision}</span>
          <span>Current Revision: {revision}</span>
        </div>
      </div>

      {/* Variant Tabs Toolbar */}
      {activeWorkspace && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              role="tablist"
              aria-label="Proposal Variants"
              className="flex items-center gap-1.5 flex-wrap"
            >
              {activeWorkspace.variants.map((v, idx) => {
                const isSelected = v.id === selectedVariant?.id;

                return (
                  <button
                    key={v.id}
                    type="button"
                    role="tab"
                    id={`tab-${v.id}`}
                    aria-controls={`panel-${v.id}`}
                    aria-selected={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    ref={(el) => {
                      tabRefs.current[v.id] = el;
                    }}
                    onClick={() => handleSelectVariant(v.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, idx)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 text-blue-900 font-semibold'
                        : 'bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    {v.label}
                  </button>
                );
              })}
            </div>

            {/* Duplicate button */}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={activeWorkspace.variants.length >= 3 || isStale}
              onClick={handleDuplicateVariant}
              title={
                activeWorkspace.variants.length >= 3
                  ? 'Maximum of 3 variants reached'
                  : 'Duplicate this variant'
              }
              className="text-xs"
            >
              + Duplicate ({3 - activeWorkspace.variants.length} remaining)
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {!hasEffectiveChanges && (
              <span className="text-[11px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-300 px-2 py-0.5 rounded">
                No changes from base
              </span>
            )}
            {selectedVariant &&
              selectedVariant.id !== activeWorkspace.variants[0]?.id &&
              !isStale && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleRemoveVariant(selectedVariant.id)}
                  aria-label={`Remove ${selectedVariant.label}`}
                  className="text-xs text-red-600 hover:text-red-800 border-red-200 hover:bg-red-50"
                  title={`Remove ${selectedVariant.label}`}
                >
                  Remove {selectedVariant.label}
                </Button>
              )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isStale}
              onClick={handleResetEdits}
              className="text-xs text-neutral-600 hover:text-neutral-900"
              title="Reset variant back to creation snapshot"
            >
              Reset Variant
            </Button>
          </div>
        </div>
      )}

      {/* 2. Critical Stale Warning Notification */}
      {isStale && (
        <InlineNotice variant="error" title="Stale Revision Detected">
          <div className="space-y-2">
            <p>
              This proposal was generated against model revision {baseRevision}, but the active
              working model has advanced to revision {revision}. To prevent unintended or
              conflicting data mutations, stale proposals cannot be accepted.
            </p>
            {activeWorkspace && (
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isRefreshing}
                  onClick={handleCreateFreshVersion}
                  className="bg-white border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold"
                >
                  {isRefreshing
                    ? 'Creating fresh version…'
                    : 'Create fresh version from current model'}
                </Button>
              </div>
            )}
          </div>
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

      {/* 5. Projected Impact Preview (Suppressed when stale per PRD §6.8, §7.3 or when variant ops fail validation) */}
      {!isStale && hasPreviewValidationErrors && (
        <InlineNotice variant="error" title="Preview Unavailable: Invalid Operations">
          <p className="text-xs">
            Impact preview is suppressed because one or more variant operations failed validation.
          </p>
          <ul className="mt-1 list-disc list-inside text-xs space-y-0.5">
            {!variantAValidation.valid &&
              variantAValidation.errors.map((e, idx) => (
                <li key={`a-${idx}`}>
                  {selectedVariant?.label ?? 'Series A'}: {e.message}
                </li>
              ))}
            {!variantBValidation.valid &&
              variantBValidation.errors.map((e, idx) => (
                <li key={`b-${idx}`}>
                  {variantB?.label ?? 'Series B'}: {e.message}
                </li>
              ))}
          </ul>
        </InlineNotice>
      )}

      {!isStale && !hasPreviewValidationErrors && comparisonResult && (
        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700">
                Projected Impact Preview
              </h3>
              {activeWorkspace && activeWorkspace.variants.length >= 2 && (
                <div className="inline-flex rounded-md border border-neutral-200 bg-neutral-50 p-0.5 ml-2">
                  <button
                    type="button"
                    onClick={() => setIsCompareMode(false)}
                    aria-pressed={!isCompareMode}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                      !isCompareMode
                        ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Single Variant
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCompareMode(true)}
                    aria-pressed={isCompareMode}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                      isCompareMode
                        ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Compare 2 Variants
                  </button>
                </div>
              )}
            </div>

            {/* View Mode Toggle: Summary / Chart / Table */}
            <div
              role="group"
              aria-label="Impact Preview View Modes"
              className="inline-flex rounded-md border border-neutral-200 bg-neutral-50 p-0.5"
            >
              <button
                type="button"
                onClick={() => setPreviewTab('summary')}
                aria-pressed={previewTab === 'summary'}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                  previewTab === 'summary'
                    ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Summary Cards
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('chart')}
                aria-pressed={previewTab === 'chart'}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                  previewTab === 'chart'
                    ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                24M Horizon Chart
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('table')}
                aria-pressed={previewTab === 'table'}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                  previewTab === 'table'
                    ? 'bg-white text-neutral-900 shadow-2xs font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Monthly Data Table
              </button>
            </div>
          </div>

          {/* Sibling variant selector when compare mode is active */}
          {isCompareMode && activeWorkspace && activeWorkspace.variants.length >= 2 && (
            <div className="flex items-center gap-2 p-2.5 bg-neutral-50 rounded-md border border-neutral-200 text-xs">
              <span className="font-medium text-neutral-700">Comparing:</span>
              <span className="font-semibold text-blue-700">
                Series A: {selectedVariant?.label}
              </span>
              <span className="text-neutral-400">vs</span>
              <label htmlFor="variant-b-select" className="font-semibold text-green-700">
                Series B:
              </label>
              <select
                id="variant-b-select"
                aria-label="Series B Variant"
                value={variantB?.id ?? ''}
                onChange={(e) => setComparisonVariantBId(e.target.value)}
                className="bg-white border border-neutral-300 rounded px-2 py-0.5 text-xs text-neutral-800"
              >
                {activeWorkspace.variants
                  .filter((v) => v.id !== selectedVariant?.id)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Subview 1: Summary Cards */}
          {previewTab === 'summary' && (
            <div className="space-y-2">
              <ProposalPreviewKPIs
                proposal={{
                  id: activeWorkspace?.id ?? pendingProposal?.id ?? 'temp',
                  title,
                  description,
                  operations: activeOperations as ProposalOperation[],
                  baseRevision,
                  createdAt: activeWorkspace?.createdAt ?? pendingProposal?.createdAt ?? ''
                }}
                workingAssumptions={cloneModelAssumptions(baseAssumptions)}
              />
              <p className="text-[11px] text-neutral-500 italic">
                Ending cash is a simplified roll-forward using EBITDA; excludes working capital,
                CapEx, taxes, and financing.
              </p>
            </div>
          )}

          {/* Subview 2: 24-Month Chart */}
          {previewTab === 'chart' && (
            <ProposalImpactChart
              comparison={comparisonResult}
              selectedMetric={selectedImpactMetric}
              onSelectMetric={setSelectedImpactMetric}
              baseRevision={baseRevision}
              variantLabel={selectedVariant?.label ?? 'Proposed Variant'}
              variantBLabel={isCompareMode && variantB ? variantB.label : undefined}
            />
          )}

          {/* Subview 3: Monthly Breakdown Table */}
          {previewTab === 'table' && (
            <ProposalImpactTable
              comparison={comparisonResult}
              selectedMetric={selectedImpactMetric}
              baseRevision={baseRevision}
              variantLabel={selectedVariant?.label ?? 'Proposed Variant'}
              variantBLabel={isCompareMode && variantB ? variantB.label : undefined}
            />
          )}
        </div>
      )}

      {isStale && (
        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-md text-xs text-neutral-500 italic">
          Proposal impact preview is unavailable because the working model has advanced from
          revision {baseRevision} to revision {revision}. Generate a fresh version to preview impact
          against the current model.
        </div>
      )}

      {/* 6. Structured Diff Table */}
      {activeWorkspace ? (
        <>
          {/* Active variant panel containing editable ProposalDiff */}
          {selectedVariant && (
            <div
              role="tabpanel"
              id={`panel-${selectedVariant.id}`}
              aria-labelledby={`tab-${selectedVariant.id}`}
              tabIndex={0}
            >
              <ProposalDiff
                operations={activeOperations}
                onEditOperation={handleEditOperation}
                readOnly={isStale}
              />
            </div>
          )}
          {/* Inactive variant panels: present in DOM for aria-controls targets, hidden from view & accessibility tree */}
          {activeWorkspace.variants
            .filter((v) => v.id !== selectedVariant?.id)
            .map((v) => (
              <div
                key={v.id}
                role="tabpanel"
                id={`panel-${v.id}`}
                aria-labelledby={`tab-${v.id}`}
                tabIndex={-1}
                hidden
                className="hidden"
              />
            ))}
        </>
      ) : (
        <div
          role="tabpanel"
          id={selectedVariant ? `panel-${selectedVariant.id}` : 'panel-default'}
          aria-labelledby={selectedVariant ? `tab-${selectedVariant.id}` : undefined}
          tabIndex={0}
        >
          <ProposalDiff
            operations={activeOperations}
            onEditOperation={handleEditOperation}
            readOnly={isStale}
          />
        </div>
      )}

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
            aria-label={
              selectedVariant && selectedVariant.id !== activeWorkspace?.variants[0]?.id
                ? `Accept ${selectedVariant.label}`
                : 'Accept Proposal'
            }
            title={
              isStale
                ? 'Proposal is stale and cannot be accepted'
                : !hasEffectiveChanges
                  ? 'All proposed values equal base assumptions (no changes to apply)'
                  : hasInvalidOperations
                    ? 'Resolve invalid operations before accepting'
                    : 'Accept and atomically apply changes'
            }
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            Accept {selectedVariant ? selectedVariant.label : 'Proposal'}
          </Button>
        </div>
      </div>

      {/* 8. Archived Stale Drafts Accordion (Task 7) */}
      {archivedStaleWorkspaces.length > 0 && (
        <div className="pt-3 border-t border-neutral-200">
          <details className="group">
            <summary className="text-xs font-semibold text-neutral-700 cursor-pointer select-none hover:text-neutral-900 flex items-center justify-between">
              <span>Archived Stale Drafts ({archivedStaleWorkspaces.length} of max 3)</span>
              <span className="text-[11px] text-neutral-400 font-normal">
                Click to inspect historical drafts
              </span>
            </summary>
            <div className="mt-2 space-y-2 pt-2">
              {archivedStaleWorkspaces.map((archived) => {
                const isInspecting = inspectingArchivedId === archived.id;
                return (
                  <div
                    key={archived.id}
                    className="p-3 bg-neutral-50 border border-neutral-200 rounded-md text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-800">{archived.title}</span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-mono">
                          Historical Base Rev: {archived.baseRevision}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInspectingArchivedId(isInspecting ? null : archived.id)}
                        className="text-xs text-blue-600 hover:underline cursor-pointer"
                      >
                        {isInspecting ? 'Hide operations' : 'Inspect operations'}
                      </button>
                    </div>

                    {isInspecting && (
                      <div className="mt-2 pt-2 border-t border-neutral-200 space-y-3">
                        {archived.variants.map((v) => (
                          <div key={v.id} className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-neutral-700">{v.label}</span>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                (Historical Snapshot — Base Rev {archived.baseRevision})
                              </span>
                            </div>
                            <ProposalDiff operations={v.operations} readOnly={true} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
