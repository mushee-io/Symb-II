/** Display-only protocol-specific margin states, never used for execution or on-chain approvals. */
export type RiskState = "no-exposure" | "urgent" | "caution" | "above-warning-level" | "unknown";

/** A null Aave HF proves NO debt only if the separately observed Pool debt
 * is exactly zero. Missing or malformed debt is unknown, never safe.
 * Display-only; risk categories are not transaction policy.
 */
export function tydroRiskState(
 healthFactor: string | null,
 debtBase: string | null = null,
): RiskState {
  const validDebt=typeof debtBase==="string"&&debtBase.length>0&&
    debtBase.length<=128&&/^(?:\d+(?:\.\\d+)?|\\.\\d+)$/.test(debtBase);
  const debt=validDebt?Number(debtBase):NaN;
  if(!Number.isFinite(debt)||debt<0)return "unknown";
  if(healthFactor===null)return debt===0?"no-exposure":"unknown";
  // If a health factor is populated but the Pool says no debt, these inputs
  // contradict one another; do not show a reassuring score.
  if(debt===0||!healthFactor.trim()||healthFactor.length>128)return "unknown";
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
