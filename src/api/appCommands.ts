import { apiClient, generateIdempotencyKey } from './client';
import {
  AcceptProposalResponse,
  CloseWorkspaceResponse,
  GenerateProposalResponse,
  HistoryResponse,
  ModelResponse,
  SessionSnapshot
} from './types';
import { CellId, ProposalTemplateId, ProposalWorkspace } from '@/domain/types';

export const appCommands = {
  /**
   * Initializes or resumes the user's session.
   * Does NOT require Idempotency-Key because token hash is identity.
   */
  async initSession(): Promise<SessionSnapshot> {
    return apiClient<SessionSnapshot>('/api/v1/session', {
      method: 'POST'
    });
  },

  /**
   * Fetches the latest session snapshot from the server.
   */
  async reloadSession(): Promise<SessionSnapshot> {
    return apiClient<SessionSnapshot>('/api/v1/session', {
      method: 'GET'
    });
  },

  /**
   * Reads the current model assumptions and revision.
   */
  async fetchModel(): Promise<ModelResponse> {
    return apiClient<ModelResponse>('/api/v1/model', {
      method: 'GET'
    });
  },

  /**
   * Atomically commits a single direct cell edit.
   */
  async directEdit(
    targetCellId: CellId,
    proposedValue: number,
    expectedRevision: number
  ): Promise<SessionSnapshot> {
    return apiClient<SessionSnapshot>('/api/v1/model/assumptions', {
      method: 'PATCH',
      body: {
        expectedRevision,
        targetCellId,
        proposedValue
      },
      idempotencyKey: generateIdempotencyKey()
    });
  },

  /**
   * Resets working assumptions back to baseline.
   */
  async resetToBaseline(expectedRevision: number): Promise<SessionSnapshot> {
    return apiClient<SessionSnapshot>('/api/v1/model/reset', {
      method: 'POST',
      body: {
        expectedRevision
      },
      idempotencyKey: generateIdempotencyKey()
    });
  },

  /**
   * Generates a new proposal workspace from a deterministic template.
   */
  async generateProposal(
    templateId: ProposalTemplateId,
    expectedRevision: number
  ): Promise<GenerateProposalResponse> {
    return apiClient<GenerateProposalResponse>('/api/v1/proposals', {
      method: 'POST',
      body: {
        templateId,
        expectedRevision
      },
      idempotencyKey: generateIdempotencyKey()
    });
  },

  /**
   * Duplicates a variant inside an active proposal workspace.
   */
  async duplicateVariant(
    workspaceId: string,
    sourceVariantId: string,
    label: string
  ): Promise<ProposalWorkspace> {
    return apiClient<ProposalWorkspace>(`/api/v1/proposals/${workspaceId}/variants`, {
      method: 'POST',
      body: {
        sourceVariantId,
        label
      },
      idempotencyKey: generateIdempotencyKey()
    });
  },

  /**
   * Edits a single operation value inside a variant.
   */
  async editVariantOperation(
    workspaceId: string,
    variantId: string,
    targetCellId: CellId,
    proposedValue: number
  ): Promise<ProposalWorkspace> {
    return apiClient<ProposalWorkspace>(`/api/v1/proposals/${workspaceId}/variants/${variantId}`, {
      method: 'PATCH',
      body: {
        targetCellId,
        proposedValue
      },
      idempotencyKey: generateIdempotencyKey()
    });
  },

  /**
   * Resets a variant back to its reset snapshot operations.
   */
  async resetVariant(workspaceId: string, variantId: string): Promise<ProposalWorkspace> {
    return apiClient<ProposalWorkspace>(
      `/api/v1/proposals/${workspaceId}/variants/${variantId}/reset`,
      {
        method: 'POST',
        idempotencyKey: generateIdempotencyKey()
      }
    );
  },

  /**
   * Removes a non-original variant from a workspace.
   */
  async removeVariant(workspaceId: string, variantId: string): Promise<ProposalWorkspace> {
    return apiClient<ProposalWorkspace>(`/api/v1/proposals/${workspaceId}/variants/${variantId}`, {
      method: 'DELETE',
      idempotencyKey: generateIdempotencyKey()
    });
  },

  /**
   * Updates variant selection and comparison list for the workspace.
   */
  async updateSelection(
    workspaceId: string,
    selectedVariantId: string,
    comparisonVariantIds: readonly [string, string?]
  ): Promise<ProposalWorkspace> {
    return apiClient<ProposalWorkspace>(`/api/v1/proposals/${workspaceId}/selection`, {
      method: 'PATCH',
      body: {
        selectedVariantId,
        comparisonVariantIds
      },
      idempotencyKey: generateIdempotencyKey()
    });
  },

  /**
   * Accepts a proposal variant and commits changes into canonical model.
   */
  async acceptProposal(
    workspaceId: string,
    variantId: string,
    expectedRevision: number
  ): Promise<AcceptProposalResponse> {
    return apiClient<AcceptProposalResponse>(`/api/v1/proposals/${workspaceId}/accept`, {
      method: 'POST',
      body: {
        variantId,
        expectedRevision
      },
      idempotencyKey: generateIdempotencyKey()
    });
  },

  /**
   * Rejects an active proposal workspace.
   */
  async rejectProposal(workspaceId: string): Promise<CloseWorkspaceResponse> {
    return apiClient<CloseWorkspaceResponse>(`/api/v1/proposals/${workspaceId}/reject`, {
      method: 'POST',
      idempotencyKey: generateIdempotencyKey()
    });
  },

  /**
   * Archives a stale proposal workspace.
   */
  async archiveProposal(workspaceId: string): Promise<CloseWorkspaceResponse> {
    return apiClient<CloseWorkspaceResponse>(`/api/v1/proposals/${workspaceId}/archive`, {
      method: 'POST',
      idempotencyKey: generateIdempotencyKey()
    });
  },

  /**
   * Dismisses a stale proposal workspace without archiving.
   */
  async dismissProposal(workspaceId: string): Promise<CloseWorkspaceResponse> {
    return apiClient<CloseWorkspaceResponse>(`/api/v1/proposals/${workspaceId}/dismiss`, {
      method: 'POST',
      idempotencyKey: generateIdempotencyKey()
    });
  },

  /**
   * Undoes the last eligible committed transaction.
   */
  async undoLastTransaction(expectedRevision: number): Promise<SessionSnapshot> {
    return apiClient<SessionSnapshot>('/api/v1/undo', {
      method: 'POST',
      body: {
        expectedRevision
      },
      idempotencyKey: generateIdempotencyKey()
    });
  },

  /**
   * Fetches paginated transaction history.
   */
  async fetchHistory(limit = 50, offset = 0): Promise<HistoryResponse> {
    return apiClient<HistoryResponse>(`/api/v1/history?limit=${limit}&offset=${offset}`, {
      method: 'GET'
    });
  }
};
