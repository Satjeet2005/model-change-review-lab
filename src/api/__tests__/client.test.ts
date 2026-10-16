import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  apiClient,
  getApiBaseUrl,
  getOrCreateWorkspaceToken,
  resetWorkspaceToken,
  generateIdempotencyKey,
  STORAGE_TOKEN_KEY
} from '../client';
import { appCommands } from '../appCommands';
import { ApiError } from '../types';

describe('API Client & Token Management (PRD §5.1, §8.6, §11.6)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Workspace Token Capability', () => {
    it('generates a 32-byte secure base64url token and persists it in localStorage', () => {
      expect(localStorage.getItem(STORAGE_TOKEN_KEY)).toBeNull();
      const token1 = getOrCreateWorkspaceToken();
      expect(token1).toBeTruthy();
      expect(token1.length).toBe(43);
      expect(token1).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(localStorage.getItem(STORAGE_TOKEN_KEY)).toBe(token1);

      // Re-accessing returns the same token
      const token2 = getOrCreateWorkspaceToken();
      expect(token2).toBe(token1);
    });

    it('resets the workspace token to a new 32-byte token', () => {
      const token1 = getOrCreateWorkspaceToken();
      const token2 = resetWorkspaceToken();
      expect(token2).not.toBe(token1);
      expect(token2.length).toBe(43);
      expect(localStorage.getItem(STORAGE_TOKEN_KEY)).toBe(token2);
    });

    it('generates distinct idempotency keys per call', () => {
      const k1 = generateIdempotencyKey();
      const k2 = generateIdempotencyKey();
      expect(k1).toBeTruthy();
      expect(k2).toBeTruthy();
      expect(k1).not.toBe(k2);
    });

    it('fails closed when localStorage.getItem throws and makes no API request with fallback token', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });

      expect(() => getOrCreateWorkspaceToken()).toThrow(/local storage/i);

      await expect(apiClient('/api/v1/session')).rejects.toThrow(/local storage/i);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fails closed when localStorage.setItem throws and makes no API request with fallback token', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceeded', 'QuotaExceededError');
      });

      expect(() => getOrCreateWorkspaceToken()).toThrow(/persist workspace token/i);

      await expect(apiClient('/api/v1/session')).rejects.toThrow(/persist workspace token/i);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fails closed when crypto.getRandomValues is unavailable', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const originalCrypto = globalThis.crypto;
      // @ts-expect-error simulating environment without crypto
      delete globalThis.crypto;

      try {
        expect(() => getOrCreateWorkspaceToken()).toThrow(/secure random/i);
        await expect(apiClient('/api/v1/session')).rejects.toThrow(/secure random/i);
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        globalThis.crypto = originalCrypto;
      }
    });
  });

  describe('Base URL Configuration & Guard', () => {
    it('trims trailing slashes from API base URL', () => {
      const url = getApiBaseUrl();
      expect(url).not.toMatch(/\/$/);
    });
  });

  describe('apiClient Network & Error Envelope', () => {
    it('parses structured ApiError on 409 conflict', async () => {
      const errorPayload = {
        error: {
          code: 'revision_conflict',
          message: 'The model changed concurrently.',
          details: { expectedRevision: 1, currentRevision: 2 },
          requestId: 'req-409-test'
        }
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(errorPayload), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      await expect(
        apiClient('/api/v1/model/assumptions', {
          method: 'PATCH',
          body: {
            expectedRevision: 1,
            targetCellId: 'setting:startingRevenueUsd',
            proposedValue: 900000
          }
        })
      ).rejects.toThrow(ApiError);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify(errorPayload), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      try {
        await apiClient('/api/v1/model/assumptions', { method: 'PATCH' });
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.statusCode).toBe(409);
        expect(apiErr.code).toBe('revision_conflict');
        expect(apiErr.message).toBe('The model changed concurrently.');
        expect(apiErr.details).toEqual({ expectedRevision: 1, currentRevision: 2 });
        expect(apiErr.requestId).toBe('req-409-test');
      }
    });

    it('attaches X-Workspace-Token and Idempotency-Key headers', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const token = getOrCreateWorkspaceToken();
      await apiClient('/api/v1/test', {
        method: 'POST',
        body: { foo: 'bar' },
        idempotencyKey: 'test-idemp-123'
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const call = fetchSpy.mock.calls[0]!;
      const headers = call[1]?.headers as Record<string, string>;
      expect(headers['X-Workspace-Token']).toBe(token);
      expect(headers['Idempotency-Key']).toBe('test-idemp-123');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('retries once on transient network failure before throwing network_error', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'));

      try {
        await apiClient('/api/v1/test', { timeoutMs: 500 });
        expect.unreachable('Should have thrown network error');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.statusCode).toBe(0);
        expect(apiErr.code).toBe('network_error');
        expect(apiErr.message).toContain('Network error');
      }

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('appCommands Integration with typed responses', () => {
    it('fetches session and model snapshots', async () => {
      const snap = await appCommands.initSession();
      expect(snap).toBeDefined();
      expect(snap.revision).toBeGreaterThanOrEqual(1);
      expect(snap.workingAssumptions).toBeDefined();

      const reloaded = await appCommands.reloadSession();
      expect(reloaded.revision).toBe(snap.revision);

      const model = await appCommands.fetchModel();
      expect(model.revision).toBe(snap.revision);
      expect(model.workingAssumptions).toBeDefined();
    });

    it('commits direct edits and advances revision', async () => {
      const initial = await appCommands.reloadSession();
      const updated = await appCommands.directEdit(
        'setting:startingRevenueUsd',
        999000,
        initial.revision
      );
      expect(updated.revision).toBe(initial.revision + 1);
      expect(updated.workingAssumptions.startingRevenueUsd).toBe(999000);
      expect(updated.changeHistory.length).toBeGreaterThan(0);
    });

    it('generates, edits, resets, duplicates, and rejects proposal workspace', async () => {
      const current = await appCommands.reloadSession();
      const genRes = await appCommands.generateProposal('hire-engineers-from-q3', current.revision);
      expect(genRes.workspace).toBeDefined();
      expect(genRes.workspace.title).toContain('Hire');
      expect(genRes.workspace.variants.length).toBe(1);

      const wsId = genRes.workspace.id;
      const vId = genRes.workspace.variants[0]!.id;

      // Duplicate variant
      const wsWithDup = await appCommands.duplicateVariant(wsId, vId, 'Variant 2');
      expect(wsWithDup.variants.length).toBe(2);

      // Edit variant
      const wsEdited = await appCommands.editVariantOperation(
        wsId,
        vId,
        'assumption:engineeringFte:M07',
        25
      );
      const editedVar = wsEdited.variants.find((v) => v.id === vId);
      const editedOp = editedVar?.operations.find(
        (o) => o.targetCellId === 'assumption:engineeringFte:M07'
      );
      expect(editedOp?.proposedValue).toBe(25);

      // Reset variant
      const wsReset = await appCommands.resetVariant(wsId, vId);
      const resetVar = wsReset.variants.find((v) => v.id === vId);
      const resetOp = resetVar?.operations.find(
        (o) => o.targetCellId === 'assumption:engineeringFte:M07'
      );
      expect(resetOp?.proposedValue).not.toBe(25);

      // Reject proposal
      await appCommands.rejectProposal(wsId);
      const afterReject = await appCommands.reloadSession();
      expect(afterReject.activeWorkspace).toBeNull();
    });

    it('accepts proposal and supports undo', async () => {
      const current = await appCommands.reloadSession();
      const genRes = await appCommands.generateProposal('hire-engineers-from-q3', current.revision);
      const vId = genRes.workspace.variants[0]!.id;

      const acceptRes = await appCommands.acceptProposal(
        genRes.workspace.id,
        vId,
        current.revision
      );
      expect(acceptRes.sessionSnapshot.revision).toBe(current.revision + 1);
      expect(acceptRes.sessionSnapshot.activeWorkspace).toBeNull();

      // Undo
      const undoSnap = await appCommands.undoLastTransaction(acceptRes.sessionSnapshot.revision);
      expect(undoSnap.revision).toBe(acceptRes.sessionSnapshot.revision + 1);
      expect(undoSnap.changeHistory[0]!.kind).toBe('undo');
    });
  });
});
