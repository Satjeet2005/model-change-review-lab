// Vitest test setup
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { handleFakeApiRequest, resetFakeApiServer } from './fakeApiServer';

// Safe canvas context mock for axe-core running in jsdom
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = () => null;
}

const originalFetch = globalThis.fetch;

// Intercept fetch calls in test environment
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  if (urlStr.includes('/api/v1/') || urlStr.includes('/health')) {
    return handleFakeApiRequest(urlStr, init);
  }

  if (originalFetch) {
    return originalFetch(input, init);
  }

  throw new Error(`Unhandled fetch in test environment: ${urlStr}`);
};

afterEach(() => {
  resetFakeApiServer();
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});
