// Vitest test setup
import '@testing-library/jest-dom/vitest';

// Safe canvas context mock for axe-core running in jsdom
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = () => null;
}
