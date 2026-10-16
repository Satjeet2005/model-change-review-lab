import { createSeedAssumptions } from '@/domain/seed';
import {
  cloneModelAssumptions,
  cloneProposalOperations,
  applyOperationsToDraft
} from '@/domain/operations';
import { MockProposalProvider } from '@/domain/proposals';
import {
  CellId,
  ModelAssumptions,
  PeriodIndex,
  ProposalTemplateId,
  ProposalVariant,
  ProposalWorkspace,
  TransactionRecord
} from '@/domain/types';
import { SessionSnapshot } from '@/api/types';
import { validateAssumptionValue } from '@/domain/validation';

interface FakeSession {
  sessionId: string;
  stateVersion: number;
  revision: number;
  baselineAssumptions: ModelAssumptions;
  workingAssumptions: ModelAssumptions;
  activeWorkspace: ProposalWorkspace | null;
  archivedWorkspaces: ProposalWorkspace[];
  changeHistory: TransactionRecord[];
  canUndo: boolean;
}

const sessions = new Map<string, FakeSession>();
const mockProvider = new MockProposalProvider();

export function resetFakeApiServer(): void {
  sessions.clear();
}

function getOrCreateSession(token: string): FakeSession {
  let session = sessions.get(token);
  if (!session) {
    const baseline = createSeedAssumptions();
    const working = createSeedAssumptions();
    session = {
      sessionId: `sess-${token.slice(0, 8)}`,
      stateVersion: 1,
      revision: 1,
      baselineAssumptions: baseline,
      workingAssumptions: working,
      activeWorkspace: null,
      archivedWorkspaces: [],
      changeHistory: [],
      canUndo: false
    };
    sessions.set(token, session);
  }
  return session;
}

function toSnapshot(sess: FakeSession): SessionSnapshot {
  return {
    sessionId: sess.sessionId,
    stateVersion: sess.stateVersion,
    revision: sess.revision,
    baselineAssumptions: cloneModelAssumptions(sess.baselineAssumptions),
    workingAssumptions: cloneModelAssumptions(sess.workingAssumptions),
    activeWorkspace: sess.activeWorkspace,
    archivedWorkspaces: [...sess.archivedWorkspaces],
    changeHistory: [...sess.changeHistory],
    canUndo: sess.canUndo
  };
}

export async function handleFakeApiRequest(
  urlStr: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = new URL(urlStr, 'http://localhost:8000');
  const path = url.pathname;
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  const token = headers.get('X-Workspace-Token') || 'default-test-token';
  const session = getOrCreateSession(token);

  const jsonResponse = (body: unknown, status = 200) => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const errorResponse = (
    code: string,
    message: string,
    status = 400,
    details?: Record<string, unknown>
  ) => {
    return new Response(
      JSON.stringify({
        error: {
          code,
          message,
          details,
          requestId: 'fake-req-id'
        }
      }),
      {
        status,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  };

  // Health
  if (path === '/health') {
    return jsonResponse({ status: 'ok', database: 'ok' });
  }

  // Session
  if (path === '/api/v1/session') {
    if (method === 'POST' || method === 'GET') {
      return jsonResponse(toSnapshot(session));
    }
  }

  // Model
  if (path === '/api/v1/model' && method === 'GET') {
    return jsonResponse({
      baselineAssumptions: session.baselineAssumptions,
      workingAssumptions: session.workingAssumptions,
      revision: session.revision
    });
  }

  // Direct Edit
  if (path === '/api/v1/model/assumptions' && method === 'PATCH') {
    const body = JSON.parse(options.body as string);
    const { expectedRevision, targetCellId, proposedValue } = body;

    if (expectedRevision !== session.revision) {
      return errorResponse('revision_conflict', 'The model changed concurrently.', 409, {
        expectedRevision,
        currentRevision: session.revision
      });
    }

    if (typeof proposedValue !== 'number' || isNaN(proposedValue)) {
      return errorResponse('validation_error', 'Invalid proposed value', 422);
    }

    let targetKey = '';
    let targetPeriod: PeriodIndex | undefined = undefined;
    if (targetCellId === 'setting:startingRevenueUsd') {
      targetKey = 'startingRevenueUsd';
    } else if (targetCellId === 'setting:startingCashUsd') {
      targetKey = 'startingCashUsd';
    } else if (targetCellId.startsWith('assumption:')) {
      const parts = targetCellId.split(':');
      targetKey = parts[1] ?? '';
      targetPeriod = parseInt(parts[2]?.replace('M', '') ?? '1', 10) as PeriodIndex;
    }

    const valErr = validateAssumptionValue(targetKey, proposedValue, targetPeriod);
    if (valErr) {
      return errorResponse('validation_error', valErr.message, 422);
    }

    // Apply edit
    const newAssumptions = cloneModelAssumptions(session.workingAssumptions);
    if (targetCellId === 'setting:startingRevenueUsd') {
      newAssumptions.startingRevenueUsd = proposedValue;
    } else if (targetCellId === 'setting:startingCashUsd') {
      newAssumptions.startingCashUsd = proposedValue;
    } else if (targetCellId.startsWith('assumption:') && targetPeriod !== undefined) {
      const m = newAssumptions.months[targetPeriod - 1];
      if (m && targetKey in m) {
        (m as unknown as Record<string, number>)[targetKey] = proposedValue;
      }
    }

    const prevAssumptions = session.workingAssumptions;
    session.workingAssumptions = newAssumptions;
    session.revision += 1;
    session.stateVersion += 1;

    const tx: TransactionRecord = {
      id: `tx-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString(),
      kind: 'manual-edit',
      description: `Manual edit to ${targetCellId}`,
      affectedCellIds: [targetCellId as CellId],
      previousAssumptions: prevAssumptions,
      newAssumptions: newAssumptions,
      resultingRevision: session.revision
    };
    session.changeHistory.unshift(tx);
    session.canUndo = true;

    return jsonResponse(toSnapshot(session));
  }

  // Reset to baseline
  if (path === '/api/v1/model/reset' && method === 'POST') {
    const body = JSON.parse(options.body as string);
    const { expectedRevision } = body;
    if (expectedRevision !== session.revision) {
      return errorResponse('revision_conflict', 'The model changed concurrently.', 409);
    }

    const prevAssumptions = session.workingAssumptions;
    session.workingAssumptions = cloneModelAssumptions(session.baselineAssumptions);
    session.revision += 1;
    session.stateVersion += 1;

    const tx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      timestamp: new Date().toISOString(),
      kind: 'reset-to-baseline',
      description: 'Reset model to deterministic baseline assumptions',
      affectedCellIds: ['setting:startingRevenueUsd'],
      previousAssumptions: prevAssumptions,
      newAssumptions: session.workingAssumptions,
      resultingRevision: session.revision
    };
    session.changeHistory.unshift(tx);
    session.canUndo = false;

    return jsonResponse(toSnapshot(session));
  }

  // Proposals
  if (path === '/api/v1/proposals' && method === 'POST') {
    const body = JSON.parse(options.body as string);
    const { templateId, expectedRevision } = body;

    if (session.activeWorkspace !== null) {
      return errorResponse('active_workspace_exists', 'An active workspace exists.', 409);
    }
    if (expectedRevision !== session.revision) {
      return errorResponse('revision_conflict', 'Revision mismatch.', 409);
    }

    const prop = await mockProvider.generateProposal(
      templateId as ProposalTemplateId,
      session.workingAssumptions,
      session.revision
    );

    const variantId = `var-orig-${Date.now()}`;
    const variant: ProposalVariant = {
      id: variantId,
      label: 'Original proposal',
      sourceTemplateId: templateId as ProposalTemplateId,
      operations: cloneProposalOperations(prop.operations),
      resetSnapshotOperations: cloneProposalOperations(prop.operations),
      createdAt: new Date().toISOString()
    };

    const ws: ProposalWorkspace = {
      id: `ws-${Date.now()}`,
      baseRevision: session.revision,
      baseAssumptions: cloneModelAssumptions(session.workingAssumptions),
      sourceTemplateId: templateId as ProposalTemplateId,
      title: prop.title,
      description: prop.description,
      status: 'active',
      isStale: false,
      variants: [variant],
      selectedVariantId: variant.id,
      comparisonVariantIds: [variant.id],
      createdAt: new Date().toISOString()
    };

    session.stateVersion += 1;
    const versionedWs: ProposalWorkspace = {
      ...ws,
      stateVersion: session.stateVersion
    };
    session.activeWorkspace = versionedWs;
    return jsonResponse({ workspace: versionedWs, revision: session.revision });
  }

  // Variant Duplicate
  const varDupMatch = path.match(/^\/api\/v1\/proposals\/([^/]+)\/variants$/);
  if (varDupMatch && method === 'POST') {
    if (!session.activeWorkspace) return errorResponse('resource_not_found', 'No workspace', 404);
    const body = JSON.parse(options.body as string);
    const { sourceVariantId, label } = body;
    const srcVar = session.activeWorkspace.variants.find((v) => v.id === sourceVariantId);
    if (!srcVar) return errorResponse('resource_not_found', 'Variant not found', 404);

    const newVar: ProposalVariant = {
      id: `var-dup-${Date.now()}`,
      label: label || `Variant ${session.activeWorkspace.variants.length + 1}`,
      sourceTemplateId: srcVar.sourceTemplateId,
      duplicatedFromVariantId: srcVar.id,
      operations: cloneProposalOperations(srcVar.operations),
      resetSnapshotOperations: cloneProposalOperations(srcVar.operations),
      createdAt: new Date().toISOString()
    };

    session.stateVersion += 1;
    session.activeWorkspace = {
      ...session.activeWorkspace,
      stateVersion: session.stateVersion,
      variants: [...session.activeWorkspace.variants, newVar],
      selectedVariantId: newVar.id
    };
    return jsonResponse(session.activeWorkspace);
  }

  // Variant Edit / Remove / Reset
  const varActionMatch = path.match(/^\/api\/v1\/proposals\/([^/]+)\/variants\/([^/]+)(\/reset)?$/);
  if (varActionMatch) {
    if (!session.activeWorkspace) return errorResponse('resource_not_found', 'No workspace', 404);
    const variantId = varActionMatch[2];
    const isReset = Boolean(varActionMatch[3]);

    const vIdx = session.activeWorkspace.variants.findIndex((v) => v.id === variantId);
    if (vIdx < 0) return errorResponse('resource_not_found', 'Variant not found', 404);
    const targetVar = session.activeWorkspace.variants[vIdx]!;

    if (isReset && method === 'POST') {
      const resetVar: ProposalVariant = {
        ...targetVar,
        operations: cloneProposalOperations(targetVar.resetSnapshotOperations)
      };
      const nextVars = [...session.activeWorkspace.variants];
      nextVars[vIdx] = resetVar;
      session.stateVersion += 1;
      session.activeWorkspace = {
        ...session.activeWorkspace,
        stateVersion: session.stateVersion,
        variants: nextVars
      };
      return jsonResponse(session.activeWorkspace);
    }

    if (method === 'DELETE') {
      const nextVars = session.activeWorkspace.variants.filter((v) => v.id !== variantId);
      session.stateVersion += 1;
      session.activeWorkspace = {
        ...session.activeWorkspace,
        stateVersion: session.stateVersion,
        variants: nextVars,
        selectedVariantId: nextVars[0]?.id || ''
      };
      return jsonResponse(session.activeWorkspace);
    }

    if (method === 'PATCH') {
      const body = JSON.parse(options.body as string);
      const { targetCellId, proposedValue } = body;
      const nextOps = targetVar.operations.map((op) =>
        op.targetCellId === targetCellId ? { ...op, proposedValue } : op
      );
      const editedVar: ProposalVariant = { ...targetVar, operations: nextOps };
      const nextVars = [...session.activeWorkspace.variants];
      nextVars[vIdx] = editedVar;
      session.stateVersion += 1;
      session.activeWorkspace = {
        ...session.activeWorkspace,
        stateVersion: session.stateVersion,
        variants: nextVars
      };
      return jsonResponse(session.activeWorkspace);
    }
  }

  // Selection
  const selMatch = path.match(/^\/api\/v1\/proposals\/([^/]+)\/selection$/);
  if (selMatch && method === 'PATCH') {
    if (!session.activeWorkspace) return errorResponse('resource_not_found', 'No workspace', 404);
    const body = JSON.parse(options.body as string);
    session.stateVersion += 1;
    session.activeWorkspace = {
      ...session.activeWorkspace,
      stateVersion: session.stateVersion,
      selectedVariantId: body.selectedVariantId,
      comparisonVariantIds: body.comparisonVariantIds
    };
    return jsonResponse(session.activeWorkspace);
  }

  // Accept Proposal
  const accMatch = path.match(/^\/api\/v1\/proposals\/([^/]+)\/accept$/);
  if (accMatch && method === 'POST') {
    if (!session.activeWorkspace) return errorResponse('resource_not_found', 'No workspace', 404);
    const body = JSON.parse(options.body as string);
    const { variantId, expectedRevision } = body;

    if (
      expectedRevision !== session.revision ||
      session.activeWorkspace.baseRevision !== session.revision
    ) {
      return errorResponse('stale_proposal', 'Proposal is stale.', 409);
    }

    const v = session.activeWorkspace.variants.find((v) => v.id === variantId);
    if (!v) return errorResponse('resource_not_found', 'Variant not found', 404);

    const prevAssumptions = session.workingAssumptions;
    const newAssumptions = applyOperationsToDraft(prevAssumptions, v.operations);
    session.workingAssumptions = newAssumptions;
    session.revision += 1;
    session.stateVersion += 1;

    const tx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      timestamp: new Date().toISOString(),
      kind: 'proposal-accepted',
      description: `Accepted proposal: ${session.activeWorkspace.title} (${v.label})`,
      affectedCellIds: v.operations.map((o) => o.targetCellId),
      previousAssumptions: prevAssumptions,
      newAssumptions: newAssumptions,
      resultingRevision: session.revision,
      provenance: {
        proposalWorkspaceId: session.activeWorkspace.id,
        variantId: v.id,
        variantLabel: v.label,
        sourceTemplateId: session.activeWorkspace.sourceTemplateId,
        baseRevision: session.activeWorkspace.baseRevision
      }
    };
    session.changeHistory.unshift(tx);
    session.canUndo = true;
    const acceptedWsId = session.activeWorkspace.id;
    session.activeWorkspace = null;

    return jsonResponse({
      sessionSnapshot: toSnapshot(session),
      acceptedWorkspaceId: acceptedWsId,
      acceptedVariantId: v.id
    });
  }

  // Reject / Archive / Dismiss
  const closeMatch = path.match(/^\/api\/v1\/proposals\/([^/]+)\/(reject|archive|dismiss)$/);
  if (closeMatch && method === 'POST') {
    if (!session.activeWorkspace) return errorResponse('resource_not_found', 'No workspace', 404);
    const action = closeMatch[2];
    const wsId = session.activeWorkspace.id;
    session.stateVersion += 1;
    if (action === 'archive') {
      session.archivedWorkspaces.unshift({
        ...session.activeWorkspace,
        status: 'archived',
        stateVersion: session.stateVersion
      });
    }
    session.activeWorkspace = null;
    return jsonResponse({
      status: action === 'reject' ? 'rejected' : action === 'archive' ? 'archived' : 'dismissed',
      workspaceId: wsId,
      stateVersion: session.stateVersion
    });
  }

  // Undo
  if (path === '/api/v1/undo' && method === 'POST') {
    const body = JSON.parse(options.body as string);
    const { expectedRevision } = body;
    if (expectedRevision !== session.revision) {
      return errorResponse('revision_conflict', 'Revision conflict', 409);
    }
    if (session.changeHistory.length === 0) {
      return errorResponse('nothing_to_undo', 'Nothing to undo', 409);
    }

    const lastTx = session.changeHistory.find((t) => !t.undoneByTransactionId && t.kind !== 'undo');
    if (!lastTx) {
      return errorResponse('nothing_to_undo', 'Nothing to undo', 409);
    }

    const prevAssumptions = session.workingAssumptions;
    session.workingAssumptions = cloneModelAssumptions(lastTx.previousAssumptions);
    session.revision += 1;
    session.stateVersion += 1;

    const undoTxId = `tx-undo-${Date.now()}`;
    lastTx.undoneByTransactionId = undoTxId;

    const undoTx: TransactionRecord = {
      id: undoTxId,
      timestamp: new Date().toISOString(),
      kind: 'undo',
      description: `Undid: ${lastTx.description}`,
      affectedCellIds: lastTx.affectedCellIds,
      previousAssumptions: prevAssumptions,
      newAssumptions: session.workingAssumptions,
      resultingRevision: session.revision,
      undoesTransactionId: lastTx.id
    };
    session.changeHistory.unshift(undoTx);
    session.canUndo = session.changeHistory.some(
      (t) => !t.undoneByTransactionId && t.kind !== 'undo'
    );

    return jsonResponse(toSnapshot(session));
  }

  // History
  if (path === '/api/v1/history' && method === 'GET') {
    return jsonResponse({
      items: session.changeHistory,
      limit: 50,
      offset: 0,
      total: session.changeHistory.length,
      canUndo: session.canUndo
    });
  }

  return errorResponse('not_found', `Route ${method} ${path} not found`, 404);
}
