import React, { useState } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppProvider';
import { MockProposalProvider, PROPOSAL_PRESETS, ProposalTemplateId } from '@/domain/proposals';
import { ProposalVariant, ProposalWorkspace } from '@/domain/types';
import { cloneModelAssumptions, cloneProposalOperations } from '@/domain/operations';
import { Button } from '@/components/ui/Button';

export interface ProposalPromptSelectorProps {
  provider?: MockProposalProvider;
}

export function ProposalPromptSelector({
  provider = new MockProposalProvider()
}: ProposalPromptSelectorProps): React.JSX.Element {
  const { workingAssumptions, revision, proposalStatus, proposalWorkspace, pendingProposal } =
    useAppState();
  const dispatch = useAppDispatch();
  const [generatingId, setGeneratingId] = useState<ProposalTemplateId | null>(null);

  const isGenerating = proposalStatus === 'generating';
  const hasActiveWorkspace = Boolean(proposalWorkspace || pendingProposal);

  async function handleSelectPreset(templateId: ProposalTemplateId) {
    if (isGenerating || hasActiveWorkspace) return;

    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const requestRevision = revision;
    const requestAssumptions = cloneModelAssumptions(workingAssumptions);

    setGeneratingId(templateId);
    dispatch({
      type: 'PROPOSAL_GENERATE_START',
      requestId,
      requestRevision,
      requestAssumptions
    });

    try {
      // Deterministic simulation
      const proposal = await provider.generateProposal(
        templateId,
        requestAssumptions,
        requestRevision
      );

      const variantId = `var-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const ops = cloneProposalOperations(proposal.operations);
      const variant: ProposalVariant = {
        id: variantId,
        label: 'Original proposal',
        sourceTemplateId: templateId,
        operations: ops,
        resetSnapshotOperations: cloneProposalOperations(ops),
        createdAt: new Date().toISOString()
      };

      const workspace: ProposalWorkspace = {
        id: `ws-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        baseRevision: requestRevision,
        baseAssumptions: requestAssumptions,
        sourceTemplateId: templateId,
        title: proposal.title,
        description: proposal.description,
        variants: [variant],
        selectedVariantId: variant.id,
        comparisonVariantIds: [variant.id],
        createdAt: new Date().toISOString()
      };

      dispatch({
        type: 'PROPOSAL_GENERATE_SUCCESS',
        requestId,
        workspace
      });
    } catch (err) {
      dispatch({
        type: 'PROPOSAL_GENERATE_ERROR',
        requestId,
        error: err instanceof Error ? err.message : 'Proposal generation failed'
      });
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-neutral-100 pb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-800 tracking-wide uppercase">
            Propose a Model Change
          </h2>
          <span
            className="text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded"
            title="All proposals in this lab are deterministically simulated locally"
          >
            Simulated AI proposal
          </span>
        </div>
        <span className="text-xs text-neutral-500">
          Select a predefined intent to generate a structured review proposal
        </span>
      </div>

      {hasActiveWorkspace && (
        <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 flex items-center justify-between">
          <span>
            <strong>Active Proposal in Review:</strong> Review, accept, or reject the open draft
            before generating a new preset proposal.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PROPOSAL_PRESETS.map((preset) => {
          const isLoadingThis = isGenerating && generatingId === preset.id;

          return (
            <div
              key={preset.id}
              className="flex flex-col justify-between p-3 rounded-md border border-neutral-200 hover:border-blue-300 hover:bg-neutral-50/50 transition-all gap-2"
            >
              <div>
                <h3 className="text-xs font-bold text-neutral-900 mb-1">{preset.label}</h3>
                <p className="text-xs text-neutral-600 leading-snug">{preset.description}</p>
                <div className="mt-1 text-[11px] font-mono text-neutral-400">
                  {preset.intentSummary}
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                disabled={isGenerating || hasActiveWorkspace}
                onClick={() => handleSelectPreset(preset.id)}
                title={
                  hasActiveWorkspace
                    ? 'A proposal workspace is already active. Review, accept, or reject the current draft first.'
                    : 'Generate proposal'
                }
                className="w-full mt-1 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 disabled:opacity-50"
              >
                {isLoadingThis ? 'Generating proposal…' : 'Generate Proposal'}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
