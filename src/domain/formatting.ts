/**
 * Centralized Financial Formatting and Parsing Module
 * PRD §28.1 & §29.11: Intl.NumberFormat wrapped in domain/formatting.ts
 */

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const currencyWithCentsFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 2
});

const integerFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0
});

/**
 * Formats a monetary number into standard USD currency string.
 * e.g. 750000 -> "$750,000" or 1234.56 -> "$1,234.56"
 */
export function formatCurrency(value: number, forceCents: boolean = false): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const hasDecimals = Math.abs(value % 1) > 0.0001;
  if (forceCents || hasDecimals) {
    return currencyWithCentsFormatter.format(value);
  }
  return currencyFormatter.format(value);
}

/**
 * Formats a decimal fraction into a percentage string.
 * e.g. 0.025 -> "2.5%"
 */
export function formatPercentage(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return percentFormatter.format(value);
}

/**
 * Formats an integer count (such as FTE).
 * e.g. 18 -> "18"
 */
export function formatInteger(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return integerFormatter.format(Math.round(value));
}

/**
 * Formats variance/delta values with explicit leading +/- signs.
 */
export function formatDelta(
  value: number,
  type: 'currency' | 'percent' | 'integer' = 'currency'
): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const prefix = value > 0 ? '+' : '';
  if (type === 'currency') {
    return `${prefix}${formatCurrency(value)}`;
  }
  if (type === 'percent') {
    return `${prefix}${(value * 100).toFixed(1)}%`;
  }
  return `${prefix}${formatInteger(value)}`;
}

/**
 * Parses raw text input from editable cells into a finite number.
 * Strips currency symbols, commas, and percentage signs where appropriate.
 * Returns NaN if input cannot be parsed cleanly.
 */
export function parseEditableValue(input: string, isPercent: boolean = false): number {
  if (typeof input !== 'string') {
    return NaN;
  }
  const trimmed = input.trim();
  if (trimmed === '') {
    return NaN;
  }

  // Strip leading $, trailing % and thousands commas
  let cleaned = trimmed.replace(/\$/g, '').replace(/,/g, '');
  if (cleaned.endsWith('%')) {
    cleaned = cleaned.slice(0, -1).trim();
    isPercent = true;
  }

  // Strict numeric format check
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return NaN;
  }

  const val = Number(cleaned);
  if (!Number.isFinite(val)) {
    return NaN;
  }

  return isPercent ? val / 100 : val;
}
