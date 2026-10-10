import { describe, it, expect } from 'vitest';
import { roundMoney } from '../math';

describe('Monetary Rounding Contract (T-009 / PRD §6.5 & §28.1)', () => {
  it('implements the exact PRD formula Math.round(value * 100) / 100', () => {
    expect(roundMoney(100)).toBe(100);
    expect(roundMoney(123.45)).toBe(123.45);
    expect(roundMoney(123.456)).toBe(123.46);
    expect(roundMoney(123.454)).toBe(123.45);
    expect(roundMoney(0)).toBe(0);
    expect(roundMoney(0.0001)).toBe(0);
    expect(roundMoney(0.0049)).toBe(0);
    expect(roundMoney(0.005)).toBe(0.01);
  });

  it('correctly handles negative values with two-decimal precision', () => {
    expect(roundMoney(-50)).toBe(-50);
    expect(roundMoney(-123.45)).toBe(-123.45);
    expect(roundMoney(-123.456)).toBe(-123.46);
    expect(roundMoney(-0) === 0).toBe(true);
    expect(Object.is(roundMoney(-0), -0)).toBe(true);
  });

  it('strictly adheres to JavaScript IEEE 754 Math.round behavior on edge boundaries', () => {
    // Under Math.round(val * 100) / 100:
    // 1.005 * 100 = 100.49999999999999 -> rounds to 100 / 100 = 1
    expect(roundMoney(1.005)).toBe(1);
    // 1.0051 * 100 = 100.51 -> rounds to 101 / 100 = 1.01
    expect(roundMoney(1.0051)).toBe(1.01);
    // 10.004 * 100 = 1000.4 -> rounds to 1000 / 100 = 10
    expect(roundMoney(10.004)).toBe(10);
    // 10.005 * 100 = 1000.5 -> rounds to 1001 / 100 = 10.01
    expect(roundMoney(10.005)).toBe(10.01);
  });

  it('handles large financial quantities without precision corruption', () => {
    expect(roundMoney(1_000_000)).toBe(1_000_000);
    expect(roundMoney(1_000_000.456)).toBe(1_000_000.46);
    expect(roundMoney(999_999_999.994)).toBe(999_999_999.99);
    expect(roundMoney(999_999_999.996)).toBe(1_000_000_000);
  });
});
