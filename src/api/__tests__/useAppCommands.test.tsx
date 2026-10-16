import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider, useAppState, useAppDispatch } from '@/state/AppProvider';
import { useAppCommands } from '../useAppCommands';
import { appCommands } from '../appCommands';
import { ApiError, SessionSnapshot } from '../types';
import { ProposalWorkspace, CellId } from '@/domain/types';
import { createSeedAssumptions } from '@/domain/seed';

function createTestSnapshot(overrides?: Partial<SessionSnapshot>): SessionSnapshot {
  return {
    sessionId: 'session-test-id',
    stateVersion: 1,
    revision: 1,
    baselineAssumptions: createSeedAssumptions(),
    workingAssumptions: createSeedAssumptions(),
    activeWorkspace: null,
    archivedWorkspaces: [],
    changeHistory: [],
    canUndo: false,
    ...overrides
  };
}

function TestCommandRig() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const commands = useAppCommands();

  const firstOpValue = state.proposalWorkspace?.variants[0]?.operations[0]?.proposedValue ?? null;

  return (
    <div>
      <span data-testid="selected-variant">
        {state.proposalWorkspace?.selectedVariantId ?? 'none'}
      </span>
      <span data-testid="has-workspace">{state.proposalWorkspace !== null ? 'yes' : 'no'}</span>
      <span data-testid="network-error">{state.networkError ?? 'none'}</span>
      <span data-testid="revision">{state.revision}</span>
      <span data-testid="is-mutating">{state.isMutating ? 'true' : 'false'}</span>
      <span data-testid="validation-error">{state.validationError ?? 'none'}</span>
      <span data-testid="state-version">{state.stateVersion}</span>
      <span data-testid="proposal-status">{state.proposalStatus}</span>
      <span data-testid="proposal-error">{state.proposalError ?? 'none'}</span>
      <span data-testid="first-op-val">
        {firstOpValue !== null ? String(firstOpValue) : 'none'}
      </span>

      <button
        data-testid="setup-ws"
        onClick={() => {
          const nextVer = (state.stateVersion || 1) + 1;
          const ws: ProposalWorkspace = {
            id: 'ws-test-1',
            sourceTemplateId: 'hire-engineers-from-q3',
            title: 'Test Workspace',
            description: 'Test description',
            baseRevision: state.revision || 1,
            stateVersion: nextVer,
            baseAssumptions: state.workingAssumptions,
            status: 'active',
            selectedVariantId: 'var-1',
            comparisonVariantIds: ['var-1'],
            createdAt: '2026-01-01T00:00:00Z',
            variants: [
              {
                id: 'var-1',
                label: 'Original',
                sourceTemplateId: 'hire-engineers-from-q3',
                duplicatedFromVariantId: undefined,
                operations: [
                  {
                    targetCellId: 'setting:startingRevenueUsd',
                    targetKey: 'startingRevenueUsd',
                    targetPeriod: null,
                    displayUnit: 'usd',
                    previousValue: 800000,
                    proposedValue: 850000,
                    changeLabel: 'Starting Revenue'
                  }
                ],
                resetSnapshotOperations: [],
                createdAt: '2026-01-01T00:00:00Z'
              },
              {
                id: 'var-2',
                label: 'Variant 2',
                sourceTemplateId: 'hire-engineers-from-q3',
                duplicatedFromVariantId: 'var-1',
                operations: [
                  {
                    targetCellId: 'setting:startingRevenueUsd',
                    targetKey: 'startingRevenueUsd',
                    targetPeriod: null,
                    displayUnit: 'usd',
                    previousValue: 800000,
                    proposedValue: 900000,
                    changeLabel: 'Starting Revenue'
                  }
                ],
                resetSnapshotOperations: [],
                createdAt: '2026-01-01T00:00:00Z'
              }
            ]
          };
          const snapshot = createTestSnapshot({
            sessionId: 'session-test-id',
            revision: state.revision || 1,
            stateVersion: nextVer,
            activeWorkspace: ws
          });
          dispatch({ type: 'SERVER_SNAPSHOT_APPLIED', snapshot });
        }}
      >
        Setup Workspace
      </button>

      <button
        data-testid="reinit-session"
        onClick={() => {
          const snapshot = createTestSnapshot({
            sessionId: 'session-new-id',
            activeWorkspace: null
          });
          dispatch({ type: 'SERVER_SNAPSHOT_APPLIED', snapshot });
        }}
      >
        Reinit Session
      </button>

      <button
        data-testid="select-var-2"
        onClick={async () => {
          await commands.updateSelection('var-2', ['var-2']);
        }}
      >
        Select Var 2
      </button>

      <button
        data-testid="select-var-1"
        onClick={async () => {
          await commands.updateSelection('var-1', ['var-1']);
        }}
      >
        Select Var 1
      </button>

      <button
        data-testid="edit-op-1"
        onClick={async () => {
          await commands.editVariantOperation(
            'var-1',
            'setting:startingRevenueUsd' as CellId,
            870000
          );
        }}
      >
        Edit Op 870k
      </button>

      <button
        data-testid="direct-edit"
        onClick={async () => {
          await commands.directEdit('setting:startingRevenueUsd' as CellId, 999000);
        }}
      >
        Direct Edit
      </button>

      <button
        data-testid="accept-proposal"
        onClick={async () => {
          await commands.acceptProposal('var-1');
        }}
      >
        Accept Proposal
      </button>

      <button
        data-testid="reject-proposal"
        onClick={async () => {
          await commands.rejectProposal();
        }}
      >
        Reject Proposal
      </button>

      <button
        data-testid="reset-baseline"
        onClick={async () => {
          await commands.resetToBaseline();
        }}
      >
        Reset Baseline
      </button>

      <button
        data-testid="undo-tx"
        onClick={async () => {
          await commands.undoLastTransaction();
        }}
      >
        Undo Tx
      </button>

      <button
        data-testid="apply-stale-snapshot"
        onClick={() => {
          const snapshot = createTestSnapshot({
            sessionId: state.sessionId || 'session-test-id',
            revision: state.revision,
            stateVersion: (state.stateVersion || 1) - 1,
            activeWorkspace: null
          });
          dispatch({ type: 'SERVER_SNAPSHOT_APPLIED', snapshot });
        }}
      >
        Apply Stale Snapshot
      </button>

      <button
        data-testid="generate-proposal"
        onClick={async () => {
          await commands.generateProposal('hire-engineers-from-q3');
        }}
      >
        Generate Proposal
      </button>

      <button
        data-testid="dismiss-proposal"
        onClick={async () => {
          await commands.dismissProposal();
        }}
      >
        Dismiss Proposal
      </button>
    </div>
  );
}

describe('useAppCommands Concurrency, Sequencing & 401 Recovery (P1, P2-2, P2-7)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rolls back selection and surfaces error when updateSelection fails on server', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestCommandRig />
      </AppProvider>
    );

    await user.click(screen.getByTestId('setup-ws'));
    expect(screen.getByTestId('selected-variant').textContent).toBe('var-1');

    vi.spyOn(appCommands, 'updateSelection').mockRejectedValueOnce(
      new ApiError(500, {
        code: 'server_error',
        message: 'Database connection failed during selection update'
      })
    );
    vi.spyOn(appCommands, 'reloadSession').mockRejectedValueOnce(new Error('Failed to reload'));

    await user.click(screen.getByTestId('select-var-2'));

    expect(screen.getByTestId('selected-variant').textContent).toBe('var-1');
    expect(screen.getByTestId('network-error').textContent).toContain('Database connection failed');
  });

  it('serializes concurrent selection requests and applies final user intent (P1)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestCommandRig />
      </AppProvider>
    );

    await user.click(screen.getByTestId('setup-ws'));
    expect(screen.getByTestId('selected-variant').textContent).toBe('var-1');

    const updateCalls: string[] = [];

    vi.spyOn(appCommands, 'updateSelection').mockImplementation(async (_wsId, selectedVarId) => {
      updateCalls.push(selectedVarId);
      return {
        id: 'ws-test-1',
        sourceTemplateId: 'hire-engineers-from-q3',
        title: 'Test Workspace',
        description: 'Test description',
        baseRevision: 1,
        baseAssumptions: createSeedAssumptions(),
        status: 'active',
        selectedVariantId: selectedVarId,
        comparisonVariantIds: [selectedVarId],
        createdAt: '2026-01-01T00:00:00Z',
        variants: [
          {
            id: selectedVarId,
            label: 'Selected',
            sourceTemplateId: 'hire-engineers-from-q3',
            duplicatedFromVariantId: undefined,
            operations: [],
            resetSnapshotOperations: [],
            createdAt: '2026-01-01T00:00:00Z'
          }
        ]
      };
    });

    // Fire rapid sequential clicks
    const p1 = user.click(screen.getByTestId('select-var-2'));
    const p2 = user.click(screen.getByTestId('select-var-1'));

    await Promise.all([p1, p2]);

    // Both calls executed sequentially through the queue in initiation order
    expect(updateCalls).toEqual(['var-2', 'var-1']);
    expect(screen.getByTestId('selected-variant').textContent).toBe('var-1');
  });

  it('serializes queued selection and acceptance and holds mutation lock continuously (P1)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestCommandRig />
      </AppProvider>
    );

    await user.click(screen.getByTestId('setup-ws'));
    expect(screen.getByTestId('selected-variant').textContent).toBe('var-1');

    let resolveSelection!: (val: ProposalWorkspace) => void;
    const pendingSelectionPromise = new Promise<ProposalWorkspace>((resolve) => {
      resolveSelection = resolve;
    });

    vi.spyOn(appCommands, 'updateSelection').mockImplementationOnce(() => pendingSelectionPromise);

    vi.spyOn(appCommands, 'acceptProposal').mockResolvedValueOnce({
      sessionSnapshot: createTestSnapshot({
        revision: 2,
        stateVersion: 3,
        activeWorkspace: null
      }),
      acceptedWorkspaceId: 'ws-test-1',
      acceptedVariantId: 'var-2'
    });

    // 1. Click select-var-2 -> updateSelection enters flight
    fireEvent.click(screen.getByTestId('select-var-2'));

    // 2. Click accept-proposal -> enqueued behind updateSelection
    fireEvent.click(screen.getByTestId('accept-proposal'));

    // Both are pending in coordinator -> mutation lock MUST be held
    expect(screen.getByTestId('is-mutating').textContent).toBe('true');

    // 3. Resolve selection
    resolveSelection({
      id: 'ws-test-1',
      sourceTemplateId: 'hire-engineers-from-q3',
      title: 'Test Workspace',
      description: 'Test description',
      baseRevision: 1,
      stateVersion: 2,
      baseAssumptions: createSeedAssumptions(),
      status: 'active',
      selectedVariantId: 'var-2',
      comparisonVariantIds: ['var-2'],
      createdAt: '2026-01-01T00:00:00Z',
      variants: []
    });

    await waitFor(() => expect(screen.getByTestId('is-mutating').textContent).toBe('false'));

    // Both finished -> workspace is closed and lock is finally released
    expect(screen.getByTestId('has-workspace').textContent).toBe('no');
  });

  it('skips queued selection when acceptance was executed first and preserves lock until completion (P1)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestCommandRig />
      </AppProvider>
    );

    await user.click(screen.getByTestId('setup-ws'));
    expect(screen.getByTestId('selected-variant').textContent).toBe('var-1');

    let resolveAccept!: (val: {
      sessionSnapshot: SessionSnapshot;
      acceptedWorkspaceId: string;
      acceptedVariantId: string;
    }) => void;
    const pendingAcceptPromise = new Promise<{
      sessionSnapshot: SessionSnapshot;
      acceptedWorkspaceId: string;
      acceptedVariantId: string;
    }>((resolve) => {
      resolveAccept = resolve;
    });

    vi.spyOn(appCommands, 'acceptProposal').mockImplementationOnce(() => pendingAcceptPromise);
    const updateSelectionSpy = vi.spyOn(appCommands, 'updateSelection');

    // 1. Click accept-proposal -> accept enters flight
    fireEvent.click(screen.getByTestId('accept-proposal'));

    // 2. Click select-var-2 -> enqueued behind accept
    fireEvent.click(screen.getByTestId('select-var-2'));

    expect(screen.getByTestId('is-mutating').textContent).toBe('true');

    // 3. Resolve accept
    resolveAccept({
      sessionSnapshot: createTestSnapshot({
        revision: 2,
        stateVersion: 2,
        activeWorkspace: null
      }),
      acceptedWorkspaceId: 'ws-test-1',
      acceptedVariantId: 'var-1'
    });

    await waitFor(() => expect(screen.getByTestId('is-mutating').textContent).toBe('false'));

    // Selection task saw workspace closed and epoch incremented -> skipped API call
    expect(updateSelectionSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('has-workspace').textContent).toBe('no');
  });

  it('serializes two queued workspace mutations plus a direct edit and holds lock continuously (P1)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestCommandRig />
      </AppProvider>
    );

    await user.click(screen.getByTestId('setup-ws'));

    const executionOrder: string[] = [];

    vi.spyOn(appCommands, 'updateSelection').mockImplementation(async (_wsId, varId) => {
      await new Promise((r) => setTimeout(r, 10));
      executionOrder.push(`selection:${varId}`);
      return {
        id: 'ws-test-1',
        sourceTemplateId: 'hire-engineers-from-q3',
        title: 'Test Workspace',
        description: 'Test description',
        baseRevision: 1,
        stateVersion: 2,
        baseAssumptions: createSeedAssumptions(),
        status: 'active',
        selectedVariantId: varId,
        comparisonVariantIds: [varId],
        createdAt: '2026-01-01T00:00:00Z',
        variants: []
      };
    });

    vi.spyOn(appCommands, 'editVariantOperation').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      executionOrder.push('editVariantOperation');
      return {
        id: 'ws-test-1',
        sourceTemplateId: 'hire-engineers-from-q3',
        title: 'Test Workspace',
        description: 'Test description',
        baseRevision: 1,
        stateVersion: 3,
        baseAssumptions: createSeedAssumptions(),
        status: 'active',
        selectedVariantId: 'var-2',
        comparisonVariantIds: ['var-2'],
        createdAt: '2026-01-01T00:00:00Z',
        variants: []
      };
    });

    vi.spyOn(appCommands, 'directEdit').mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      executionOrder.push('directEdit');
      return createTestSnapshot({
        revision: 2,
        stateVersion: 4,
        activeWorkspace: null
      });
    });

    // Fire all three in rapid succession
    fireEvent.click(screen.getByTestId('select-var-2'));
    fireEvent.click(screen.getByTestId('edit-op-1'));
    fireEvent.click(screen.getByTestId('direct-edit'));

    // Mutation lock is held immediately
    expect(screen.getByTestId('is-mutating').textContent).toBe('true');

    await waitFor(() => expect(screen.getByTestId('is-mutating').textContent).toBe('false'));

    // All three executed sequentially in queued order
    expect(executionOrder).toEqual(['selection:var-2', 'editVariantOperation', 'directEdit']);
  });

  it('serializes queued selection plus reset or undo and drops stale selection (P1)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestCommandRig />
      </AppProvider>
    );

    await user.click(screen.getByTestId('setup-ws'));

    let resolveReset!: (val: SessionSnapshot) => void;
    const pendingResetPromise = new Promise<SessionSnapshot>((resolve) => {
      resolveReset = resolve;
    });

    vi.spyOn(appCommands, 'resetToBaseline').mockImplementationOnce(() => pendingResetPromise);
    const updateSelectionSpy = vi.spyOn(appCommands, 'updateSelection');

    // Click reset-baseline, then click select-var-2
    fireEvent.click(screen.getByTestId('reset-baseline'));
    fireEvent.click(screen.getByTestId('select-var-2'));

    expect(screen.getByTestId('is-mutating').textContent).toBe('true');

    // Resolve reset
    resolveReset(
      createTestSnapshot({
        revision: 2,
        stateVersion: 2,
        activeWorkspace: null
      })
    );

    await waitFor(() => expect(screen.getByTestId('is-mutating').textContent).toBe('false'));

    expect(updateSelectionSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('has-workspace').textContent).toBe('no');
  });

  it('rejects stale session snapshot when revision is unchanged but stateVersion is lower (Finding 2)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestCommandRig />
      </AppProvider>
    );

    await user.click(screen.getByTestId('setup-ws'));
    expect(screen.getByTestId('selected-variant').textContent).toBe('var-1');

    // Newer workspace returned with stateVersion: 5
    vi.spyOn(appCommands, 'updateSelection').mockResolvedValueOnce({
      id: 'ws-test-1',
      sourceTemplateId: 'hire-engineers-from-q3',
      title: 'Test Workspace',
      description: 'Test description',
      baseRevision: 1,
      stateVersion: 5,
      baseAssumptions: createSeedAssumptions(),
      status: 'active',
      selectedVariantId: 'var-2',
      comparisonVariantIds: ['var-2'],
      createdAt: '2026-01-01T00:00:00Z',
      variants: []
    });

    await user.click(screen.getByTestId('select-var-2'));
    expect(screen.getByTestId('selected-variant').textContent).toBe('var-2');
    expect(screen.getByTestId('state-version').textContent).toBe('5');

    // Now deliver delayed older session snapshot (same revision: 1, but lower stateVersion: 4)
    await user.click(screen.getByTestId('apply-stale-snapshot'));

    // Stale snapshot must be rejected: selected-variant remains var-2 and workspace is preserved
    expect(screen.getByTestId('selected-variant').textContent).toBe('var-2');
    expect(screen.getByTestId('state-version').textContent).toBe('5');
    expect(screen.getByTestId('has-workspace').textContent).toBe('yes');
  });

  it('routes 409 stale proposal and 422 validation error to appropriate feedback without claiming connection interrupted (Finding 3)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestCommandRig />
      </AppProvider>
    );

    await user.click(screen.getByTestId('setup-ws'));

    // 1. 409 Conflict on updateSelection
    vi.spyOn(appCommands, 'updateSelection').mockRejectedValueOnce(
      new ApiError(409, {
        code: 'stale_proposal',
        message: 'Proposal workspace is stale'
      })
    );
    vi.spyOn(appCommands, 'reloadSession').mockResolvedValueOnce(
      createTestSnapshot({
        sessionId: 'session-test-id',
        revision: 2,
        stateVersion: 3,
        activeWorkspace: null
      })
    );

    await user.click(screen.getByTestId('select-var-2'));

    // Network error reflects concurrent change / refresh, NOT "Connection interrupted"
    const netErr = screen.getByTestId('network-error').textContent;
    expect(netErr).toContain('Model changed concurrently (Proposal workspace is stale)');
    expect(netErr).not.toContain('Connection interrupted');
    expect(netErr).not.toContain('Mutation outcome unknown');

    // 2. 422 Validation error on editVariantOperation
    await user.click(screen.getByTestId('setup-ws'));

    vi.spyOn(appCommands, 'editVariantOperation').mockRejectedValueOnce(
      new ApiError(422, {
        code: 'validation_error',
        message: 'Proposed value out of allowable PRD bounds'
      })
    );

    await user.click(screen.getByTestId('edit-op-1'));

    // Validation error is displayed in validationError, and networkError is NOT connection interrupted
    expect(screen.getByTestId('validation-error').textContent).toBe(
      'Proposed value out of allowable PRD bounds'
    );
  });

  it('drops late selection response when session reinitializes (P1)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestCommandRig />
      </AppProvider>
    );

    await user.click(screen.getByTestId('setup-ws'));
    expect(screen.getByTestId('selected-variant').textContent).toBe('var-1');

    let resolveSelection!: (val: ProposalWorkspace) => void;
    const pendingSelectionPromise = new Promise<ProposalWorkspace>((resolve) => {
      resolveSelection = resolve;
    });

    vi.spyOn(appCommands, 'updateSelection').mockImplementationOnce(() => pendingSelectionPromise);

    // Fire selection request
    user.click(screen.getByTestId('select-var-2'));

    // Session resets to session-new-id
    await user.click(screen.getByTestId('reinit-session'));
    expect(screen.getByTestId('has-workspace').textContent).toBe('no');

    // Now late selection returns from old session
    resolveSelection({
      id: 'ws-test-1',
      sourceTemplateId: 'hire-engineers-from-q3',
      title: 'Test Workspace',
      description: 'Test description',
      baseRevision: 1,
      baseAssumptions: createSeedAssumptions(),
      status: 'active',
      selectedVariantId: 'var-2',
      comparisonVariantIds: ['var-2'],
      createdAt: '2026-01-01T00:00:00Z',
      variants: []
    });

    // Stale response from old session dropped
    expect(screen.getByTestId('has-workspace').textContent).toBe('no');
  });

  it('keeps variant edits non-optimistic and updates on confirmation', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestCommandRig />
      </AppProvider>
    );

    await user.click(screen.getByTestId('setup-ws'));
    expect(screen.getByTestId('first-op-val').textContent).toBe('850000');

    let resolveEditA!: (val: ProposalWorkspace) => void;
    const editAPromise = new Promise<ProposalWorkspace>((resolve) => {
      resolveEditA = resolve;
    });

    vi.spyOn(appCommands, 'editVariantOperation').mockImplementationOnce(() => editAPromise);

    // Fire edit
    user.click(screen.getByTestId('edit-op-1'));

    // Non-optimistic: value is STILL 850000 while request is in flight
    expect(screen.getByTestId('first-op-val').textContent).toBe('850000');

    // Server confirms edit
    resolveEditA({
      id: 'ws-test-1',
      sourceTemplateId: 'hire-engineers-from-q3',
      title: 'Test Workspace',
      description: 'Test description',
      baseRevision: 1,
      baseAssumptions: createSeedAssumptions(),
      status: 'active',
      selectedVariantId: 'var-1',
      comparisonVariantIds: ['var-1'],
      createdAt: '2026-01-01T00:00:00Z',
      variants: [
        {
          id: 'var-1',
          label: 'Original',
          sourceTemplateId: 'hire-engineers-from-q3',
          duplicatedFromVariantId: undefined,
          operations: [
            {
              targetCellId: 'setting:startingRevenueUsd',
              targetKey: 'startingRevenueUsd',
              targetPeriod: null,
              displayUnit: 'usd',
              previousValue: 800000,
              proposedValue: 870000,
              changeLabel: 'Starting Revenue'
            }
          ],
          resetSnapshotOperations: [],
          createdAt: '2026-01-01T00:00:00Z'
        }
      ]
    });

    // Wait for resolution
    await screen.findByText('870000');
    expect(screen.getByTestId('first-op-val').textContent).toBe('870000');
  });

  it('recovers from 401 invalid_workspace_token on directEdit by reinitializing session (P2-2)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestCommandRig />
      </AppProvider>
    );

    // Mock directEdit failing with 401
    vi.spyOn(appCommands, 'directEdit').mockRejectedValueOnce(
      new ApiError(401, {
        code: 'invalid_workspace_token',
        message: 'Session token has expired'
      })
    );

    const freshSnapshot = createTestSnapshot({
      sessionId: 'session-reinit-new',
      revision: 1,
      sessionResetBecauseExpired: true
    });

    const initSpy = vi.spyOn(appCommands, 'initSession').mockResolvedValueOnce(freshSnapshot);

    await user.click(screen.getByTestId('direct-edit'));

    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('network-error').textContent).toContain(
      'Your session expired due to inactivity and has been reinitialized to baseline.'
    );
  });

  it('recovers from 401 invalid_workspace_token on acceptProposal by reinitializing session (P2-2)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestCommandRig />
      </AppProvider>
    );

    await user.click(screen.getByTestId('setup-ws'));

    vi.spyOn(appCommands, 'acceptProposal').mockRejectedValueOnce(
      new ApiError(401, {
        code: 'invalid_workspace_token',
        message: 'Expired capability token'
      })
    );

    const freshSnapshot = createTestSnapshot({
      sessionId: 'session-reinit-from-accept',
      revision: 1,
      sessionResetBecauseExpired: true
    });

    const initSpy = vi.spyOn(appCommands, 'initSession').mockResolvedValueOnce(freshSnapshot);

    await user.click(screen.getByTestId('accept-proposal'));

    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('network-error').textContent).toContain(
      'Your session expired due to inactivity'
    );
  });

  it('recovers from 401 invalid_workspace_token on editVariantOperation by reinitializing session (P2-2)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestCommandRig />
      </AppProvider>
    );

    await user.click(screen.getByTestId('setup-ws'));

    vi.spyOn(appCommands, 'editVariantOperation').mockRejectedValueOnce(
      new ApiError(401, {
        code: 'invalid_workspace_token',
        message: 'Expired capability token'
      })
    );

    const freshSnapshot = createTestSnapshot({
      sessionId: 'session-reinit-from-edit-var',
      revision: 1,
      sessionResetBecauseExpired: true
    });

    const initSpy = vi.spyOn(appCommands, 'initSession').mockResolvedValueOnce(freshSnapshot);

    await user.click(screen.getByTestId('edit-op-1'));

    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('network-error').textContent).toContain(
      'Your session expired due to inactivity'
    );
  });

  it('reconciles state with server reload on ambiguous transport error during mutation (P2)', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider>
        <TestCommandRig />
      </AppProvider>
    );

    await user.click(screen.getByTestId('setup-ws'));

    // Genuine transport error during mutation (e.g. network disconnect / fetch failure)
    vi.spyOn(appCommands, 'directEdit').mockRejectedValueOnce(
      new ApiError(0, {
        code: 'network_error',
        message: 'Failed to fetch'
      })
    );

    const reconciledSnapshot = createTestSnapshot({
      sessionId: 'session-test-id',
      revision: 2,
      stateVersion: 3,
      activeWorkspace: null
    });

    const reloadSpy = vi
      .spyOn(appCommands, 'reloadSession')
      .mockResolvedValueOnce(reconciledSnapshot);

    await user.click(screen.getByTestId('direct-edit'));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('network-error').textContent).toContain(
      'Connection interrupted during direct edit. State has been reconciled from the server.'
    );
    expect(screen.getByTestId('revision').textContent).toBe('2');
  });

  describe('Proposal Generation Error Routing (Round 5 P2)', () => {
    it('routes 422 validation error through known validation handler without ambiguous transport error', async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <TestCommandRig />
        </AppProvider>
      );

      vi.spyOn(appCommands, 'generateProposal').mockRejectedValueOnce(
        new ApiError(422, {
          code: 'validation_error',
          message: 'Requested template parameters violate policy'
        })
      );

      await user.click(screen.getByTestId('generate-proposal'));

      expect(screen.getByTestId('proposal-status').textContent).toBe('error');
      expect(screen.getByTestId('proposal-error').textContent).toBe(
        'Requested template parameters violate policy'
      );
      expect(screen.getByTestId('validation-error').textContent).toBe(
        'Requested template parameters violate policy'
      );
      // Must NOT be treated as transport failure
      expect(screen.getByTestId('network-error').textContent).toBe('none');
    });

    it('routes 404 resource not found through known error handler without ambiguous transport error', async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <TestCommandRig />
        </AppProvider>
      );

      vi.spyOn(appCommands, 'generateProposal').mockRejectedValueOnce(
        new ApiError(404, {
          code: 'resource_not_found',
          message: 'Proposal template not found'
        })
      );

      const reloadSpy = vi.spyOn(appCommands, 'reloadSession').mockResolvedValueOnce(
        createTestSnapshot({
          sessionId: 'session-test-id',
          revision: 1,
          stateVersion: 1
        })
      );

      await user.click(screen.getByTestId('generate-proposal'));

      expect(reloadSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('proposal-status').textContent).toBe('error');
      expect(screen.getByTestId('proposal-error').textContent).toBe('Proposal template not found');
      expect(screen.getByTestId('network-error').textContent).toBe(
        'Resource not found during proposal generation: Proposal template not found'
      );
      expect(screen.getByTestId('network-error').textContent).not.toContain(
        'Connection interrupted'
      );
    });

    it('routes 409 revision conflict through conflict handler and preserves request error', async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <TestCommandRig />
        </AppProvider>
      );

      vi.spyOn(appCommands, 'generateProposal').mockRejectedValueOnce(
        new ApiError(409, {
          code: 'revision_conflict',
          message: 'Model changed since proposal was requested.'
        })
      );

      const reloadSpy = vi.spyOn(appCommands, 'reloadSession').mockResolvedValueOnce(
        createTestSnapshot({
          sessionId: 'session-test-id',
          revision: 2,
          stateVersion: 2
        })
      );

      await user.click(screen.getByTestId('generate-proposal'));

      expect(reloadSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('proposal-status').textContent).toBe('error');
      expect(screen.getByTestId('proposal-error').textContent).toBe(
        'Model changed concurrently. Please try again.'
      );
      expect(screen.getByTestId('network-error').textContent).toContain(
        'Model changed concurrently'
      );
      expect(screen.getByTestId('revision').textContent).toBe('2');
    });

    it('routes 401 expired session through session reinitialization', async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <TestCommandRig />
        </AppProvider>
      );

      vi.spyOn(appCommands, 'generateProposal').mockRejectedValueOnce(
        new ApiError(401, {
          code: 'invalid_workspace_token',
          message: 'Session expired'
        })
      );

      const initSpy = vi.spyOn(appCommands, 'initSession').mockResolvedValueOnce(
        createTestSnapshot({
          sessionId: 'session-reinit-from-gen',
          revision: 1,
          stateVersion: 1,
          sessionResetBecauseExpired: true
        })
      );

      await user.click(screen.getByTestId('generate-proposal'));

      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('proposal-status').textContent).toBe('error');
      expect(screen.getByTestId('proposal-error').textContent).toBe(
        'Session expired. Reinitialized.'
      );
      expect(screen.getByTestId('network-error').textContent).toContain(
        'Your session expired due to inactivity'
      );
    });

    it('routes 500 server error as known server error without ambiguous transport error', async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <TestCommandRig />
        </AppProvider>
      );

      vi.spyOn(appCommands, 'generateProposal').mockRejectedValueOnce(
        new ApiError(500, {
          code: 'internal_server_error',
          message: 'Database query execution failure'
        })
      );

      await user.click(screen.getByTestId('generate-proposal'));

      expect(screen.getByTestId('proposal-status').textContent).toBe('error');
      expect(screen.getByTestId('proposal-error').textContent).toBe(
        'Database query execution failure'
      );
      expect(screen.getByTestId('network-error').textContent).toBe(
        'Server error during proposal generation: Database query execution failure'
      );
      expect(screen.getByTestId('network-error').textContent).not.toContain(
        'Connection interrupted'
      );
    });

    it('routes 400 bad request through known validation handler without ambiguous transport error', async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <TestCommandRig />
        </AppProvider>
      );

      vi.spyOn(appCommands, 'generateProposal').mockRejectedValueOnce(
        new ApiError(400, {
          code: 'bad_request',
          message: 'Malformed proposal parameters'
        })
      );

      await user.click(screen.getByTestId('generate-proposal'));

      expect(screen.getByTestId('proposal-status').textContent).toBe('error');
      expect(screen.getByTestId('proposal-error').textContent).toBe(
        'Malformed proposal parameters'
      );
      expect(screen.getByTestId('validation-error').textContent).toBe(
        'Malformed proposal parameters'
      );
      // Must NOT claim connection interrupted or ambiguous transport error
      expect(screen.getByTestId('network-error').textContent).toBe('none');
    });

    it('routes 403 forbidden through known access denied handler without ambiguous transport error', async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <TestCommandRig />
        </AppProvider>
      );

      vi.spyOn(appCommands, 'generateProposal').mockRejectedValueOnce(
        new ApiError(403, {
          code: 'forbidden',
          message: 'Workspace mutation forbidden'
        })
      );

      await user.click(screen.getByTestId('generate-proposal'));

      expect(screen.getByTestId('proposal-status').textContent).toBe('error');
      expect(screen.getByTestId('proposal-error').textContent).toBe('Workspace mutation forbidden');
      expect(screen.getByTestId('network-error').textContent).toBe(
        'Access denied during proposal generation: Workspace mutation forbidden'
      );
      expect(screen.getByTestId('network-error').textContent).not.toContain(
        'Connection interrupted'
      );
    });

    it('routes 503 service unavailable through known service unavailable handler without ambiguous transport error', async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <TestCommandRig />
        </AppProvider>
      );

      vi.spyOn(appCommands, 'generateProposal').mockRejectedValueOnce(
        new ApiError(503, {
          code: 'service_unavailable',
          message: 'AI generation service temporarily unavailable'
        })
      );

      await user.click(screen.getByTestId('generate-proposal'));

      expect(screen.getByTestId('proposal-status').textContent).toBe('error');
      expect(screen.getByTestId('proposal-error').textContent).toBe(
        'AI generation service temporarily unavailable'
      );
      expect(screen.getByTestId('network-error').textContent).toBe(
        'Service unavailable during proposal generation: AI generation service temporarily unavailable'
      );
      expect(screen.getByTestId('network-error').textContent).not.toContain(
        'Connection interrupted'
      );
    });
  });

  describe('Reject and Dismiss Proposal Session Synchronization (Round 5 P1)', () => {
    it('rejectProposal calls API, reloads session snapshot, and sets stateVersion and rejected status', async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <TestCommandRig />
        </AppProvider>
      );

      await user.click(screen.getByTestId('setup-ws'));
      expect(screen.getByTestId('has-workspace').textContent).toBe('yes');
      expect(screen.getByTestId('state-version').textContent).toBe('2');

      const rejectSpy = vi.spyOn(appCommands, 'rejectProposal').mockResolvedValueOnce({
        status: 'rejected',
        workspaceId: 'ws-test-1',
        stateVersion: 3
      });

      const reloadSpy = vi.spyOn(appCommands, 'reloadSession').mockResolvedValueOnce(
        createTestSnapshot({
          sessionId: 'session-test-id',
          revision: 1,
          stateVersion: 3,
          activeWorkspace: null
        })
      );

      await user.click(screen.getByTestId('reject-proposal'));

      expect(rejectSpy).toHaveBeenCalledTimes(1);
      expect(reloadSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('has-workspace').textContent).toBe('no');
      expect(screen.getByTestId('proposal-status').textContent).toBe('rejected');
      expect(screen.getByTestId('state-version').textContent).toBe('3');
    });

    it('dismissProposal calls API, reloads session snapshot, and advances stateVersion', async () => {
      const user = userEvent.setup();
      render(
        <AppProvider>
          <TestCommandRig />
        </AppProvider>
      );

      await user.click(screen.getByTestId('setup-ws'));
      expect(screen.getByTestId('has-workspace').textContent).toBe('yes');
      expect(screen.getByTestId('state-version').textContent).toBe('2');

      const dismissSpy = vi.spyOn(appCommands, 'dismissProposal').mockResolvedValueOnce({
        status: 'dismissed',
        workspaceId: 'ws-test-1',
        stateVersion: 4
      });

      const reloadSpy = vi.spyOn(appCommands, 'reloadSession').mockResolvedValueOnce(
        createTestSnapshot({
          sessionId: 'session-test-id',
          revision: 1,
          stateVersion: 4,
          activeWorkspace: null
        })
      );

      await user.click(screen.getByTestId('dismiss-proposal'));

      expect(dismissSpy).toHaveBeenCalledTimes(1);
      expect(reloadSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('has-workspace').textContent).toBe('no');
      expect(screen.getByTestId('proposal-status').textContent).toBe('idle');
      expect(screen.getByTestId('state-version').textContent).toBe('4');
    });
  });
});
