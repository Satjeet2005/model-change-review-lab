import { useCallback, useRef } from 'react';
import { useAppState, useAppDispatch } from '@/state/AppProvider';
import { appCommands } from './appCommands';
import { ApiError, SessionSnapshot } from './types';
import { CellId, ProposalTemplateId } from '@/domain/types';
import { getNextVariantLabel } from '@/state/appReducer';
import { ProposalUiStatus } from '@/state/appState';
import { ProposalWorkspace } from '@/domain/types';

export function useAppCommands() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const stateRef = useRef(state);
  stateRef.current = state;

  const isMutatingRef = useRef(false);
  const pendingMutationCountRef = useRef(0);
  const mutationQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const workspaceEpochRef = useRef(state.workspaceEpoch);
  const prevEpochRef = useRef(state.workspaceEpoch);
  if (state.workspaceEpoch !== prevEpochRef.current) {
    prevEpochRef.current = state.workspaceEpoch;
    workspaceEpochRef.current = state.workspaceEpoch;
  }
  const isHandling401Ref = useRef(false);

  const applySnapshotOrRefetch = useCallback(
    async (snapshot: SessionSnapshot, proposalStatus?: ProposalUiStatus) => {
      const curr = stateRef.current;
      if (
        curr.sessionId &&
        snapshot.sessionId === curr.sessionId &&
        (snapshot.revision < curr.revision || snapshot.stateVersion < curr.stateVersion)
      ) {
        try {
          const fresh = await appCommands.reloadSession();
          dispatch({ type: 'SERVER_SNAPSHOT_APPLIED', snapshot: fresh, proposalStatus });
        } catch {
          // ignore
        }
        return;
      }
      dispatch({ type: 'SERVER_SNAPSHOT_APPLIED', snapshot, proposalStatus });
    },
    [dispatch]
  );

  const handleAmbiguousTransportError = useCallback(
    async (actionName: string, err: unknown) => {
      try {
        const freshSnapshot = await appCommands.reloadSession();
        await applySnapshotOrRefetch(freshSnapshot);
        dispatch({
          type: 'SET_NETWORK_ERROR',
          error: `Connection interrupted during ${actionName}. State has been reconciled from the server.`
        });
      } catch {
        const detail = err instanceof Error ? err.message : 'Unknown network failure';
        dispatch({
          type: 'SET_NETWORK_ERROR',
          error: `Mutation outcome unknown. Connection failed during ${actionName} (${detail}) and state could not be reconciled. Please retry connection.`
        });
      }
    },
    [applySnapshotOrRefetch, dispatch]
  );

  const handle409Conflict = useCallback(
    async (err: ApiError) => {
      try {
        const freshSnapshot = await appCommands.reloadSession();
        await applySnapshotOrRefetch(freshSnapshot);
        dispatch({
          type: 'SET_NETWORK_ERROR',
          error: `Model changed concurrently (${err.message}). State has been refreshed.`
        });
      } catch {
        dispatch({
          type: 'SET_NETWORK_ERROR',
          error: `Conflict occurred: ${err.message}. Failed to refresh session.`
        });
      }
    },
    [applySnapshotOrRefetch, dispatch]
  );

  const handle401Expired = useCallback(
    async (err: ApiError) => {
      if (isHandling401Ref.current) return;
      isHandling401Ref.current = true;
      workspaceEpochRef.current++; // Invalidate pending workspace requests
      try {
        const freshSnapshot = await appCommands.initSession();
        dispatch({ type: 'SERVER_SNAPSHOT_APPLIED', snapshot: freshSnapshot });
        if (freshSnapshot.sessionResetBecauseExpired) {
          dispatch({
            type: 'SET_NETWORK_ERROR',
            error: 'Your session expired due to inactivity and has been reinitialized to baseline.'
          });
        }
      } catch {
        dispatch({
          type: 'SET_NETWORK_ERROR',
          error: `Session expired (${err.message}). Reinitialization failed.`
        });
      } finally {
        isHandling401Ref.current = false;
      }
    },
    [dispatch]
  );

  const handleKnownOrTransportError = useCallback(
    async (actionName: string, err: unknown) => {
      if (err instanceof ApiError && err.statusCode > 0) {
        if (err.statusCode === 401 || err.code === 'invalid_workspace_token') {
          await handle401Expired(err);
          return;
        }
        if (
          err.statusCode === 409 ||
          err.code === 'revision_conflict' ||
          err.code === 'stale_proposal' ||
          err.code === 'workspace_not_active' ||
          err.code === 'active_workspace_exists'
        ) {
          await handle409Conflict(err);
          return;
        }
        if (err.statusCode === 422 || err.code === 'validation_error') {
          dispatch({
            type: 'SET_VALIDATION_ERROR',
            error: err.message || `Validation error during ${actionName}`
          });
          return;
        }
        if (err.statusCode === 400 || err.code === 'bad_request') {
          dispatch({
            type: 'SET_VALIDATION_ERROR',
            error: err.message || `Bad request during ${actionName}`
          });
          return;
        }
        if (
          err.statusCode === 403 ||
          err.code === 'forbidden' ||
          err.code === 'permission_denied'
        ) {
          dispatch({
            type: 'SET_NETWORK_ERROR',
            error: `Access denied during ${actionName}: ${err.message}`
          });
          return;
        }
        if (err.statusCode === 404 || err.code === 'resource_not_found') {
          try {
            const freshSnapshot = await appCommands.reloadSession();
            await applySnapshotOrRefetch(freshSnapshot);
          } catch {
            // ignore
          }
          dispatch({
            type: 'SET_NETWORK_ERROR',
            error: `Resource not found during ${actionName}: ${err.message}`
          });
          return;
        }
        if (err.statusCode === 503 || err.code === 'service_unavailable') {
          dispatch({
            type: 'SET_NETWORK_ERROR',
            error: `Service unavailable during ${actionName}: ${err.message}`
          });
          return;
        }
        if (err.statusCode === 500) {
          dispatch({
            type: 'SET_NETWORK_ERROR',
            error: `Server error during ${actionName}: ${err.message}`
          });
          return;
        }
        if (err.statusCode >= 500) {
          dispatch({
            type: 'SET_NETWORK_ERROR',
            error: `Server error during ${actionName}: ${err.message}`
          });
          return;
        }
        if (err.statusCode >= 400) {
          dispatch({
            type: 'SET_NETWORK_ERROR',
            error: `Request failed during ${actionName} (${err.statusCode}): ${err.message}`
          });
          return;
        }
      }
      await handleAmbiguousTransportError(actionName, err);
    },
    [
      applySnapshotOrRefetch,
      dispatch,
      handle401Expired,
      handle409Conflict,
      handleAmbiguousTransportError
    ]
  );

  const enqueueMutation = useCallback(
    async <T>(_actionName: string, task: () => Promise<T>): Promise<T | false> => {
      pendingMutationCountRef.current++;
      isMutatingRef.current = true;
      dispatch({ type: 'SET_MUTATING', isMutating: true });

      const runTask = async (): Promise<T | false> => {
        try {
          return await task();
        } finally {
          pendingMutationCountRef.current--;
          if (pendingMutationCountRef.current <= 0) {
            pendingMutationCountRef.current = 0;
            isMutatingRef.current = false;
            dispatch({ type: 'SET_MUTATING', isMutating: false });
          }
        }
      };

      const chained = mutationQueueRef.current.then(runTask, runTask);
      mutationQueueRef.current = chained.then(
        () => {},
        () => {}
      );
      return await chained;
    },
    [dispatch]
  );

  const retryInit = useCallback(async () => {
    dispatch({ type: 'SET_INITIALIZING', isInitializing: true });
    dispatch({ type: 'SET_NETWORK_ERROR', error: null });
    try {
      const snapshot = await appCommands.initSession();
      await applySnapshotOrRefetch(snapshot);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Initialization failed';
      dispatch({ type: 'SET_NETWORK_ERROR', error: message });
    } finally {
      dispatch({ type: 'SET_INITIALIZING', isInitializing: false });
    }
  }, [applySnapshotOrRefetch, dispatch]);

  const enqueueWorkspaceMutation = useCallback(
    async (
      actionName: string,
      fn: (epoch: number, sessionId: string) => Promise<ProposalWorkspace>
    ): Promise<boolean> => {
      const curr = stateRef.current;
      const ws = curr.proposalWorkspace;
      if (!ws) return false;

      const epoch = workspaceEpochRef.current;
      const sessionId = curr.sessionId ?? undefined;

      return (
        (await enqueueMutation(actionName, async () => {
          // If epoch or workspace became invalid while queued (e.g. accept/reset occurred), skip network call
          if (
            workspaceEpochRef.current !== epoch ||
            (sessionId !== undefined &&
              stateRef.current.sessionId !== null &&
              stateRef.current.sessionId !== sessionId) ||
            !stateRef.current.proposalWorkspace
          ) {
            return false;
          }

          try {
            const updatedWs = await fn(epoch, sessionId ?? '');

            // Verify epoch and session are STILL current after network call
            if (
              workspaceEpochRef.current === epoch &&
              (sessionId === undefined ||
                stateRef.current.sessionId === null ||
                stateRef.current.sessionId === sessionId) &&
              stateRef.current.proposalWorkspace !== null
            ) {
              dispatch({
                type: 'WORKSPACE_UPDATED',
                workspace: updatedWs,
                sessionId,
                epoch
              });
              return true;
            }
            return false;
          } catch (err) {
            if (
              workspaceEpochRef.current === epoch &&
              (sessionId === undefined ||
                stateRef.current.sessionId === null ||
                stateRef.current.sessionId === sessionId)
            ) {
              await handleKnownOrTransportError(actionName, err);
            }
            return false;
          }
        })) || false
      );
    },
    [dispatch, enqueueMutation, handleKnownOrTransportError]
  );

  const directEdit = useCallback(
    async (cellId: CellId, proposedValue: number): Promise<boolean> => {
      return (
        (await enqueueMutation('direct edit', async () => {
          const curr = stateRef.current;
          try {
            const snapshot = await appCommands.directEdit(cellId, proposedValue, curr.revision);
            await applySnapshotOrRefetch(snapshot);
            return true;
          } catch (err) {
            await handleKnownOrTransportError('direct edit', err);
            return false;
          }
        })) || false
      );
    },
    [applySnapshotOrRefetch, enqueueMutation, handleKnownOrTransportError]
  );

  const resetToBaseline = useCallback(async (): Promise<boolean> => {
    return (
      (await enqueueMutation('reset to baseline', async () => {
        const curr = stateRef.current;
        workspaceEpochRef.current++;
        try {
          const snapshot = await appCommands.resetToBaseline(curr.revision);
          await applySnapshotOrRefetch(snapshot);
          return true;
        } catch (err) {
          await handleKnownOrTransportError('reset to baseline', err);
          return false;
        }
      })) || false
    );
  }, [applySnapshotOrRefetch, enqueueMutation, handleKnownOrTransportError]);

  const generateProposal = useCallback(
    async (templateId: ProposalTemplateId): Promise<boolean> => {
      const curr = stateRef.current;
      if (curr.proposalStatus === 'generating') {
        return false;
      }

      return (
        (await enqueueMutation('proposal generation', async () => {
          const c = stateRef.current;
          if (c.proposalStatus === 'generating') return false;

          workspaceEpochRef.current++;
          const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          dispatch({
            type: 'PROPOSAL_GENERATE_START',
            requestId,
            requestRevision: c.revision,
            requestAssumptions: c.workingAssumptions
          });

          try {
            const res = await appCommands.generateProposal(templateId, c.revision);
            dispatch({
              type: 'PROPOSAL_GENERATE_SUCCESS',
              requestId,
              workspace: res.workspace
            });
            return true;
          } catch (err) {
            let errorMsg = err instanceof Error ? err.message : 'Proposal generation failed';
            if (err instanceof ApiError) {
              if (err.code === 'active_workspace_exists') {
                errorMsg = 'An active proposal workspace already exists.';
              } else if (err.code === 'revision_conflict' || err.statusCode === 409) {
                errorMsg = 'Model changed concurrently. Please try again.';
              } else if (err.code === 'invalid_workspace_token' || err.statusCode === 401) {
                errorMsg = 'Session expired. Reinitialized.';
              }
            }

            dispatch({
              type: 'PROPOSAL_GENERATE_ERROR',
              requestId,
              error: errorMsg
            });

            await handleKnownOrTransportError('proposal generation', err);
            return false;
          }
        })) || false
      );
    },
    [dispatch, enqueueMutation, handleKnownOrTransportError]
  );

  const duplicateVariant = useCallback(
    async (sourceVariantId: string, label?: string): Promise<boolean> => {
      const ws = stateRef.current.proposalWorkspace;
      if (!ws) return false;
      const newLabel = label || getNextVariantLabel(ws.variants);
      return enqueueWorkspaceMutation('duplicate variant', () =>
        appCommands.duplicateVariant(ws.id, sourceVariantId, newLabel)
      );
    },
    [enqueueWorkspaceMutation]
  );

  const editVariantOperation = useCallback(
    async (variantId: string, targetCellId: CellId, proposedValue: number): Promise<boolean> => {
      const ws = stateRef.current.proposalWorkspace;
      if (!ws) return false;
      return enqueueWorkspaceMutation('edit variant operation', () =>
        appCommands.editVariantOperation(ws.id, variantId, targetCellId, proposedValue)
      );
    },
    [enqueueWorkspaceMutation]
  );

  const resetVariant = useCallback(
    async (variantId: string): Promise<boolean> => {
      const ws = stateRef.current.proposalWorkspace;
      if (!ws) return false;
      return enqueueWorkspaceMutation('reset variant', () =>
        appCommands.resetVariant(ws.id, variantId)
      );
    },
    [enqueueWorkspaceMutation]
  );

  const removeVariant = useCallback(
    async (variantId: string): Promise<boolean> => {
      const ws = stateRef.current.proposalWorkspace;
      if (!ws) return false;
      return enqueueWorkspaceMutation('remove variant', () =>
        appCommands.removeVariant(ws.id, variantId)
      );
    },
    [enqueueWorkspaceMutation]
  );

  const updateSelection = useCallback(
    async (
      selectedVariantId: string,
      comparisonVariantIds: readonly [string, string?]
    ): Promise<boolean> => {
      const ws = stateRef.current.proposalWorkspace;
      if (!ws) return false;
      return enqueueWorkspaceMutation('selection update', () =>
        appCommands.updateSelection(ws.id, selectedVariantId, comparisonVariantIds)
      );
    },
    [enqueueWorkspaceMutation]
  );

  const acceptProposal = useCallback(
    async (variantId: string): Promise<boolean> => {
      const curr = stateRef.current;
      const ws = curr.proposalWorkspace;
      if (!ws) return false;

      return (
        (await enqueueMutation('accept proposal', async () => {
          const c = stateRef.current;
          const currentWs = c.proposalWorkspace;
          if (!currentWs) return false;

          workspaceEpochRef.current++; // Invalidate pending/queued workspace responses
          try {
            const res = await appCommands.acceptProposal(currentWs.id, variantId, c.revision);
            await applySnapshotOrRefetch(res.sessionSnapshot, 'accepted');
            return true;
          } catch (err) {
            await handleKnownOrTransportError('accept proposal', err);
            return false;
          }
        })) || false
      );
    },
    [applySnapshotOrRefetch, enqueueMutation, handleKnownOrTransportError]
  );

  const rejectProposal = useCallback(async (): Promise<boolean> => {
    const curr = stateRef.current;
    const ws = curr.proposalWorkspace;
    if (!ws) return false;

    return (
      (await enqueueMutation('reject proposal', async () => {
        const c = stateRef.current;
        const currentWs = c.proposalWorkspace;
        if (!currentWs) return false;

        workspaceEpochRef.current++;
        try {
          await appCommands.rejectProposal(currentWs.id);
          const snap = await appCommands.reloadSession();
          await applySnapshotOrRefetch(snap, 'rejected');
          return true;
        } catch (err) {
          await handleKnownOrTransportError('reject proposal', err);
          return false;
        }
      })) || false
    );
  }, [applySnapshotOrRefetch, enqueueMutation, handleKnownOrTransportError]);

  const archiveProposal = useCallback(async (): Promise<boolean> => {
    const curr = stateRef.current;
    const ws = curr.proposalWorkspace;
    if (!ws) return false;

    return (
      (await enqueueMutation('archive proposal', async () => {
        const c = stateRef.current;
        const currentWs = c.proposalWorkspace;
        if (!currentWs) return false;

        workspaceEpochRef.current++;
        try {
          await appCommands.archiveProposal(currentWs.id);
          const snap = await appCommands.reloadSession();
          await applySnapshotOrRefetch(snap);
          return true;
        } catch (err) {
          await handleKnownOrTransportError('archive proposal', err);
          return false;
        }
      })) || false
    );
  }, [applySnapshotOrRefetch, enqueueMutation, handleKnownOrTransportError]);

  const createFreshVersion = useCallback(
    async (templateId: ProposalTemplateId): Promise<boolean> => {
      const curr = stateRef.current;
      const ws = curr.proposalWorkspace;
      if (!ws) return false;

      return (
        (await enqueueMutation('create fresh proposal', async () => {
          const c = stateRef.current;
          const currentWs = c.proposalWorkspace;
          if (!currentWs) return false;

          workspaceEpochRef.current++;
          try {
            await appCommands.archiveProposal(currentWs.id);
            await appCommands.generateProposal(templateId, c.revision);
            const snap = await appCommands.reloadSession();
            await applySnapshotOrRefetch(snap, 'review');
            return true;
          } catch (err) {
            await handleKnownOrTransportError('create fresh proposal', err);
            return false;
          }
        })) || false
      );
    },
    [applySnapshotOrRefetch, enqueueMutation, handleKnownOrTransportError]
  );

  const dismissProposal = useCallback(async (): Promise<boolean> => {
    return (
      (await enqueueMutation('dismiss proposal', async () => {
        const c = stateRef.current;
        const ws = c.proposalWorkspace;
        if (!ws) {
          dispatch({ type: 'PROPOSAL_DISMISS' });
          return true;
        }

        workspaceEpochRef.current++;
        try {
          await appCommands.dismissProposal(ws.id);
          const snap = await appCommands.reloadSession();
          await applySnapshotOrRefetch(snap, 'idle');
          return true;
        } catch (err) {
          await handleKnownOrTransportError('dismiss proposal', err);
          return false;
        }
      })) || false
    );
  }, [applySnapshotOrRefetch, dispatch, enqueueMutation, handleKnownOrTransportError]);

  const undoLastTransaction = useCallback(async (): Promise<boolean> => {
    const curr = stateRef.current;
    if (!curr.canUndo) return false;

    return (
      (await enqueueMutation('undo transaction', async () => {
        const c = stateRef.current;
        if (!c.canUndo) return false;

        workspaceEpochRef.current++;
        try {
          const snapshot = await appCommands.undoLastTransaction(c.revision);
          await applySnapshotOrRefetch(snapshot);
          return true;
        } catch (err) {
          await handleKnownOrTransportError('undo transaction', err);
          return false;
        }
      })) || false
    );
  }, [applySnapshotOrRefetch, enqueueMutation, handleKnownOrTransportError]);

  return {
    retryInit,
    directEdit,
    resetToBaseline,
    generateProposal,
    duplicateVariant,
    editVariantOperation,
    resetVariant,
    removeVariant,
    updateSelection,
    acceptProposal,
    rejectProposal,
    archiveProposal,
    createFreshVersion,
    dismissProposal,
    undoLastTransaction
  };
}
