import { ModelAssumptions, ProposalWorkspace, TransactionRecord } from '@/domain/types';

export interface SessionSnapshot {
  sessionId: string;
  stateVersion: number;
  sessionResetBecauseExpired?: boolean;
  baselineAssumptions: ModelAssumptions;
  workingAssumptions: ModelAssumptions;
  revision: number;
  activeWorkspace: ProposalWorkspace | null;
  archivedWorkspaces: readonly ProposalWorkspace[];
  changeHistory: readonly TransactionRecord[];
  canUndo: boolean;
  changed?: boolean;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly requestId?: string;

  constructor(statusCode: number, detail: ApiErrorDetail) {
    super(detail.message || `API error ${statusCode}`);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = detail.code;
    this.details = detail.details;
    this.requestId = detail.requestId;
  }
}

export interface ModelResponse {
  baselineAssumptions: ModelAssumptions;
  workingAssumptions: ModelAssumptions;
  revision: number;
}

export interface GenerateProposalResponse {
  workspace: ProposalWorkspace;
  revision: number;
}

export interface AcceptProposalResponse {
  sessionSnapshot: SessionSnapshot;
  acceptedWorkspaceId: string;
  acceptedVariantId: string;
}

export interface CloseWorkspaceResponse {
  status: string;
  workspaceId: string;
  stateVersion: number;
}

export interface HistoryResponse {
  items: readonly TransactionRecord[];
  limit: number;
  offset: number;
  total: number;
  canUndo: boolean;
}

export interface HealthResponse {
  status: string;
  database: string;
}
