/** Display-only protocol-specific margin states, never used for execution or on-chain approvals. */
export type RiskState = "no-exposure" | "urgent" | "caution" | "above-warning-level" | "unknown";

/** Pool.getUserAccountData health factor < 1 permits liquidation. */
export function tydroRiskState(healthFactor: string | null): RiskState {
  if (healthFactor === null) return "no-exposure";
  if (!healthFactor.trim()) return "unknown";
  const value = Number(healthFactor);
  if (!Number.isFinite(value) || value < 0) return "unknown";
  if (value < 1) return "urgent";
  if (value < 1.5) return "caution";
  return "above-warning-level";
}

/** Nado maintenance health is a signed margin buffer, NOT an Aave health factor.
 * A negative value is an adverse engine health reading. Zero is a boundary;
 * never compare these values to Tydro's 1.0 health-factor liquidation threshold.
 */
export function nadoRiskState(maintenanceHealth: string | null, exists = true): RiskState {
  if (!exists) return "no-exposure";
  if (maintenanceHealth === null || !maintenanceHealth.trim()) return "unknown";
  const value = Number(maintenanceHealth);
  if (!Number.isFinite(value)) return "unknown";
  if (value < 0) return "urgent";
  if (value === 0) return "caution";
  return "above-warning-level";
}
