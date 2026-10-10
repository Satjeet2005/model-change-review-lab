import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDelta,
  formatInteger,
  formatPercentage,
  parseEditableValue
} from '../formatting';

describe('Financial Formatting and Parsing (T-023)', () => {
  describe('formatCurrency', () => {
    it('formats positive integers without cents', () => {
      expect(formatCurrency(750000)).toBe('$750,000');
      expect(formatCurrency(0)).toBe('$0');
    });

    it('formats decimals and fractional cents', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(750000, true)).toBe('$750,000.00');
    });

    it('formats negative currency', () => {
      expect(formatCurrency(-50000)).toBe('-$50,000');
      expect(formatCurrency(-123.45)).toBe('-$123.45');
    });

    it('handles non-finite values safely', () => {
      expect(formatCurrency(NaN)).toBe('—');
      expect(formatCurrency(Infinity)).toBe('—');
    });
  });

  describe('formatPercentage', () => {
    it('formats decimal fractions as percentages', () => {
      expect(formatPercentage(0.025)).toBe('2.5%');
      expect(formatPercentage(0.1)).toBe('10.0%');
      expect(formatPercentage(-0.05)).toBe('-5.0%');
      expect(formatPercentage(0)).toBe('0.0%');
    });

    it('handles non-finite percentage values safely', () => {
      expect(formatPercentage(NaN)).toBe('—');
      expect(formatPercentage(-Infinity)).toBe('—');
    });
  });

  describe('formatInteger', () => {
    it('formats counts and FTE numbers', () => {
      expect(formatInteger(18)).toBe('18');
      expect(formatInteger(1000)).toBe('1,000');
      expect(formatInteger(0)).toBe('0');
      expect(formatInteger(NaN)).toBe('—');
    });
  });

  describe('formatDelta', () => {
    it('formats positive and negative deltas with explicit signs', () => {
      expect(formatDelta(5000, 'currency')).toBe('+$5,000');
      expect(formatDelta(-5000, 'currency')).toBe('-$5,000');
      expect(formatDelta(0.05, 'percent')).toBe('+5.0%');
      expect(formatDelta(-0.02, 'percent')).toBe('-2.0%');
      expect(formatDelta(2, 'integer')).toBe('+2');
      expect(formatDelta(-2, 'integer')).toBe('-2');
    });
  });

  describe('parseEditableValue', () => {
    it('parses valid numeric strings and formatted numbers', () => {
      expect(parseEditableValue('750000')).toBe(750000);
      expect(parseEditableValue(' $750,000 ')).toBe(750000);
      expect(parseEditableValue('1234.56')).toBe(1234.56);
      expect(parseEditableValue('-50000')).toBe(-50000);
      expect(parseEditableValue('2.5%', true)).toBe(0.025);
      expect(parseEditableValue(' 5% ')).toBe(0.05);
    });

    it('rejects malformed text, empty strings, and trailing characters without coercion', () => {
      expect(parseEditableValue('')).toBeNaN();
      expect(parseEditableValue('   ')).toBeNaN();
      expect(parseEditableValue('750000abc')).toBeNaN();
      expect(parseEditableValue('12.34.56')).toBeNaN();
      expect(parseEditableValue('two')).toBeNaN();
    });
  });
});
