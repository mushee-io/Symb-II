import type { NadoAccountResponse } from "../nado/types.ts";
import type { TydroAccountResponse } from "../tydro/types.ts";
import { nadoRiskState, tydroRiskState } from "./status.ts";
import {validTydroReserveInventory} from "../verification/tydro-reserve-integrity.ts";

/** Read-only diagnostics. Alerts are snapshots, not evidence of current safety. */
export type AlertLevel = "critical" | "warning" | "info";
export type RiskAlert = {
  id: string; source: "Nado" | "Tydro"; level: AlertLevel;
  title: string; detail: string; observedAt: string;
};
export type FeedState<T> = { status: "loading" | "error" | "success"; data?: T };
export type AlertInput = {
  wallet: string;
  nado: FeedState<NadoAccountResponse>;
  tydro: FeedState<TydroAccountResponse>;
};
const MAX_AGE_MS = 180_000;
function validTime(value:string,now:number){
  const ms=Date.parse(value);
  return Number.isFinite(ms)&&ms<=now+5000&&now-ms<=MAX_AGE_MS;
}
function add(alerts:RiskAlert[],source:RiskAlert["source"],level:AlertLevel,id:string,title:string,detail:string,observedAt:string){
  alerts.push({id:source.toLowerCase()+":"+id,source,level,title,detail,observedAt});
}
function validNumber(value:string){
  if(typeof value!=="string"||!value.trim()||!/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value))return null;
  const n=Number(value);return Number.isFinite(n)?n:null;
}

/** Distinguishes provider failures, partial records and actual adverse readings.
 * Never interpret a failed feed, missing subaccount or stale value as safe.
 */
export function evaluateRiskAlerts(input:AlertInput,now=Date.now()):RiskAlert[]{
  const alerts:RiskAlert[]=[];
  if(!/^0x[0-9a-f]{40}$/i.test(input.wallet))return alerts;
  for(const source of ["Nado","Tydro"] as const){
    const feed=source==="Nado"?input.nado:input.tydro;
    if(feed.status==="loading")continue;
    if(feed.status==="error"||!feed.data){
      add(alerts,source,"warning","unavailable",source+" risk status unknown","Live account data could not be read. No safe status is inferred.",new Date(now).toISOString());
      continue;
    }
    const d=feed.data;
    if(d.chainId!==57073||d.address.toLowerCase()!==input.wallet.toLowerCase()){
      add(alerts,source,"warning","mismatch",source+" account mismatch","Unexpected network or wallet. Exposure and health readings are withheld.",new Date(now).toISOString());
      continue;
    }
    if(!validTime(d.updatedAt,now)){
      add(alerts,source,"warning","stale",source+" data may be stale","The account snapshot is older than three minutes or has an invalid timestamp.",d.updatedAt);
      continue;
    }
    if(source==="Nado"){
      const n=d as NadoAccountResponse;
      if(!Array.isArray(n.subaccounts)||!Array.isArray(n.subaccountHealth)||
         !Array.isArray(n.warnings)){
        add(alerts,"Nado","warning","malformed-inventory","Nado account health inventory unavailable","Subaccount health data is missing or malformed; do not infer safety.",n.updatedAt);
        continue;
      }
      if(n.incomplete||n.positionCoverageComplete!==true||n.warnings.length>0){
        add(alerts,"Nado","warning","partial","Nado coverage incomplete","One or more subaccounts, positions, margin readings or histories may be missing.",n.updatedAt);
      }
      const expected=new Set(n.subaccounts.map(name=>String(name).toLowerCase()));
      const seen=new Set<string>();
      const observed=new Set<string>();
      let duplicate=false,unmatched=false;
      if(expected.size!==n.subaccounts.length)duplicate=true;
      for(const s of n.subaccountHealth){
        if(!s||typeof s.subaccount!=="string"||!s.subaccount.trim()){
          unmatched=true;continue;
        }
        const key=s.subaccount.toLowerCase();
        if(seen.has(key))duplicate=true;
        seen.add(key);
        if(!expected.has(key))unmatched=true;
        if(!s.exists)continue;
        observed.add(key);
        const health=validNumber(s.maintenanceHealth);
        if(health===null){
          add(alerts,"Nado","warning","unknown:"+key,"Nado margin reading unavailable","Maintenance health for "+s.subaccount+" could not be interpreted.",n.updatedAt);
          continue;
        }
        const risk=nadoRiskState(s.maintenanceHealth,true);
        if(risk==="urgent")
          add(alerts,"Nado","critical","maintenance:"+key,"Nado adverse maintenance health",s.subaccount+" has negative maintenance health. Check Nado directly; this is not a liquidation guarantee.",n.updatedAt);
        else if(risk==="caution")
          add(alerts,"Nado","warning","maintenance:"+key,"Nado maintenance health at zero",s.subaccount+" is at a critical margin boundary. Verify directly on Nado.",n.updatedAt);
      }
      if(duplicate)
        add(alerts,"Nado","warning","duplicate-health","Nado health records conflict","Duplicate subaccount inventory or health records were returned. A positive reading cannot be treated as independently corroborated.",n.updatedAt);
      if(unmatched)
        add(alerts,"Nado","warning","unmatched-health","Nado health inventory mismatch","A health entry could not be matched to the discovered subaccounts.",n.updatedAt);
      if([...expected].some(key=>!observed.has(key))){
        add(alerts,"Nado","warning","missing-health","Missing Nado account health","One or more discovered cross-margin subaccounts have no valid existing health record.",n.updatedAt);
      }
    }else{
      const t=d as TydroAccountResponse;
      if(t.incomplete||!Array.isArray(t.warnings)||t.warnings.length>0)
        add(alerts,"Tydro","warning","partial","Tydro account data incomplete","Some reserve balances, prices or configuration values could not be read.",t.updatedAt);
      if(!validTydroReserveInventory(t))
        add(alerts,"Tydro","warning","reserve-integrity","Tydro reserve inventory inconsistent","Borrowed and supplied assets cannot be trusted until the reserve inventory is reconciled.",t.updatedAt);
      const debt=validNumber(t.debtBase);
      if(debt===null||debt<0)
        add(alerts,"Tydro","warning","unknown-debt","Tydro debt amount unavailable","The displayed account debt could not be validated; do not infer a safe borrower position.",t.updatedAt);
      if(t.healthFactor===null){
        // AAVE's null health factor is expected for NO-debt wallets, not
        // for borrowers. Do not accidentally classify unknown borrower risk
        // as safe simply because its health-factor RPC read failed.
        if(debt===null||debt>0)
          add(alerts,"Tydro","warning","unknown-health","Tydro borrower health unavailable","Debt was reported but the health factor is missing. Liquidation risk cannot be evaluated.",t.updatedAt);
        continue;
      }
      if(debt===0)
        add(alerts,"Tydro","warning","health-without-debt","Tydro debt and health disagree","The Pool health factor is present but account debt is zero; validate the account independently.",t.updatedAt);
      const hf=validNumber(t.healthFactor);
      if(hf===null||hf<0){
        add(alerts,"Tydro","warning","unknown-health","Tydro health factor unavailable","The lending health factor could not be interpreted.",t.updatedAt);
        continue;
      }
      const risk=tydroRiskState(t.healthFactor);
      if(risk==="urgent")
        add(alerts,"Tydro","critical","health","Tydro liquidation vulnerability","Health factor is below 1.0. Liquidation may be possible; verify the account on Tydro.",t.updatedAt);
      else if(risk==="caution")
        add(alerts,"Tydro","warning","health","Tydro health buffer is low","Health factor is below 1.5. Monitor lending health and collateral changes.",t.updatedAt);
    }
  }
  const sorted=alerts.sort((a,b)=>{
    const rank={critical:0,warning:1,info:2};
    return rank[a.level]-rank[b.level]||a.id.localeCompare(b.id);
  });
  // If duplicate provider rows contain conflicting health, retain the most
  // severe alert for a given ID rather than accidentally hiding the adverse
  // reading or displaying multiple indistinguishable alerts.
  const ids=new Set<string>();
  return sorted.filter(alert=>{
    if(ids.has(alert.id))return false;
    ids.add(alert.id);
    return true;
  });
}
