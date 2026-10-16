import { ApiError, ApiErrorDetail, ApiErrorResponse } from './types';

export const STORAGE_TOKEN_KEY = 'mcrl.workspace-token.v1';

export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:8000';
  }
  throw new Error(
    'Missing required environment variable VITE_API_BASE_URL in production environment.'
  );
}

export function isApiConfigured(): boolean {
  try {
    getApiBaseUrl();
    return true;
  } catch {
    return false;
  }
}

export function generateSecureToken(): string {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error(
      'Cryptographically secure random number generation is not available in this environment.'
    );
  }
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function getOrCreateWorkspaceToken(): string {
  let token: string | null = null;
  try {
    token = localStorage.getItem(STORAGE_TOKEN_KEY);
  } catch {
    throw new Error(
      'Unable to access browser local storage for workspace token capability. Please enable cookies/local storage for this site.'
    );
  }

  if (!token || token.trim().length < 32) {
    token = generateSecureToken();
    try {
      localStorage.setItem(STORAGE_TOKEN_KEY, token);
    } catch {
      throw new Error(
        'Unable to persist workspace token in browser local storage. Please enable cookies/local storage for this site.'
      );
    }
  }

  return token.trim();
}

export function resetWorkspaceToken(): string {
  const newToken = generateSecureToken();
  try {
    localStorage.setItem(STORAGE_TOKEN_KEY, newToken);
  } catch {
    throw new Error(
      'Unable to persist reset workspace token in browser local storage. Please enable cookies/local storage for this site.'
    );
  }
  return newToken;
}

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  idempotencyKey?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const method = options.method ?? 'GET';
  const token = getOrCreateWorkspaceToken();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Workspace-Token': token
  };

  if (options.body !== undefined && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  const timeoutMs = options.timeoutMs ?? 15000;

  let attempts = 0;
  const maxAttempts = 2;

  while (attempts < maxAttempts) {
    attempts++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        throw new Error('Request aborted');
      }
      options.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetail: ApiErrorDetail;
        try {
          const errBody = (await response.json()) as ApiErrorResponse;
          errorDetail = errBody.error || {
            code: 'http_error',
            message: `Request failed with status ${response.status}`
          };
        } catch {
          errorDetail = {
            code: 'http_error',
            message: `Request failed with status ${response.status}`
          };
        }
        throw new ApiError(response.status, errorDetail);
      }

      if (response.status === 204) {
        return undefined as unknown as T;
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof ApiError) {
        throw err;
      }
      if (attempts >= maxAttempts) {
        const message = err instanceof Error ? err.message : 'Network request failed';
        throw new ApiError(0, {
          code: 'network_error',
          message: `Network error: ${message}. Please check your connection and retry.`
        });
      }
      await new Promise((res) => setTimeout(res, 300));
    }
  }

  throw new ApiError(0, {
    code: 'network_error',
    message: 'Request failed after retries'
  });
}
