import { formatUnits, parseUnits } from "viem";
import type { TydroAccountResponse, TydroUserReserve } from "../tydro/types.ts";

/** Deterministic, read-only single-asset parallel-price shock. No transaction execution.
 * The approximate health factor preserves the protocol's reported starting HF,
 * scales each asset's liquidation-weighted collateral and debt proportionally, and
 * fails closed when baseline accounting differs materially or unsupported eMode is active.
 * Assumes fixed balances, liquidation thresholds and no intervening transactions.
 */
export type StressResult =
  | { ok: true; currentHealthFactor: string; projectedHealthFactor: string; shockPct: number; asset: string; state: "urgent"|"caution"|"above-warning-level"; baselineDeviationBps: number }
  | { ok: false; reason: string };

function nativeAmount(value: string, decimals: number) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw Error("Invalid asset precision.");
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw Error("Invalid token balance.");
  return parseUnits(value, decimals);
}
function val(amount: string, reserve: TydroUserReserve): bigint {
  if (reserve.oraclePriceRaw===null || !/^\d+$/.test(reserve.oraclePriceRaw)) throw Error("Missing oracle price.");
  const price=BigInt(reserve.oraclePriceRaw);
  if(price<=0n) throw Error("Zero oracle price.");
  return nativeAmount(amount,reserve.decimals) * price / 10n ** BigInt(reserve.decimals);
}
export function simulateTydroShock(
  account: TydroAccountResponse,
  asset: string,
  shockPct: number,
): StressResult {
  if (!Number.isInteger(shockPct) || shockPct < -50 || shockPct > 50)
    return {ok:false,reason:"Choose a whole-number shock from -50% to +50%."};
  if (account.chainId !== 57073 || account.incomplete || account.warnings.length > 0)
    return {ok:false,reason:"Account data is partial or belongs to a different network."};
  if (account.userEModeCategory !== 0)
    return {ok:false,reason:"eMode or unknown risk configuration requires a dedicated simulation model."};
  if(account.healthFactor===null)
    return {ok:false,reason:"This account has no debt, so a debt-liquidation health-factor scenario is not applicable."};
  if (!/^\d+(?:\.\d+)?$/.test(account.healthFactor))
    return {ok:false,reason:"Invalid on-chain health factor."};
  if (account.userReserves.length===0)
    return {ok:false,reason:"No lending positions were found."};
  const selected=account.userReserves.find(r=>r.address.toLowerCase()===asset.toLowerCase());
  if(!selected) return {ok:false,reason:"Select an asset held or borrowed in this Tydro account."};
  try{
    const baseHF=parseUnits(account.healthFactor,18);
    let collateral=0n,debt=0n,adjustedCollateral=0n,adjustedDebt=0n;
    const factor=BigInt(100+shockPct);
    for (const reserve of account.userReserves){
      if (!Number.isInteger(reserve.liquidationThresholdBps) || reserve.liquidationThresholdBps < 0 || reserve.liquidationThresholdBps>10000)
        return {ok:false,reason:"Invalid liquidation parameters from the protocol."};
      const weighted=reserve.usingAsCollateral ?
        val(reserve.supplied,reserve)*BigInt(reserve.liquidationThresholdBps) : 0n;
      const borrowed=val(reserve.variableDebt,reserve)+val(reserve.stableDebt,reserve);
      const hit=reserve.address.toLowerCase()===asset.toLowerCase();
      collateral+=weighted;
      debt+=borrowed;
      adjustedCollateral+=hit?weighted*factor:weighted*100n;
      adjustedDebt+=hit?borrowed*factor:borrowed*100n;
    }
    if(debt<=0n || collateral<=0n || adjustedDebt<=0n)
      return {ok:false,reason:"Collateral or debt cannot be valued reliably."};
    // Collateral is weighted in bps, so scale by 10_000 to compare against the
    // protocol's ray-scaled HF. This baseline check catches unsupported modes
    // or missing precision/price data instead of silently claiming correctness.
    const inferredHF=collateral * 10n ** 18n / (debt * 10000n);
    const deviation=baseHF===0n?10000n :
      (inferredHF>baseHF?inferredHF-baseHF:baseHF-inferredHF)*10000n/baseHF;
    if(deviation>200n)
      return {ok:false,reason:"On-chain health factor does not reconcile within 2% of the reserve model. Scenario withheld."};
    const projected=baseHF*adjustedCollateral*debt/(collateral*adjustedDebt);
    const state=projected<10n**18n?"urgent":projected<15n*10n**17n?"caution":"above-warning-level";
    return {
      ok:true,currentHealthFactor:formatUnits(baseHF,18),
      projectedHealthFactor:formatUnits(projected,18),
      shockPct,asset:selected.symbol,state,baselineDeviationBps:Number(deviation),
    };
  }catch{
    return {ok:false,reason:"Price, reserve precision or balance was invalid. Scenario withheld."};
  }
}
