/**
 * Shared Monetary Rounding Contract
 * PRD §6.5 & §28.1: Deterministic two-decimal rounding
 */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
