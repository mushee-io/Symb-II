import type { NadoAccountResponse } from "../nado/types.ts";
import type { TydroAccountResponse } from "../tydro/types.ts";
import { nadoRiskState, tydroRiskState } from "./status.ts";

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
      if(n.incomplete||n.positionCoverageComplete!==true){
        add(alerts,"Nado","warning","partial","Nado coverage incomplete","One or more subaccounts, positions, margin readings or histories may be missing.",n.updatedAt);
      }
      const seen=new Set<string>();
      for(const s of n.subaccountHealth){
        const key=s.subaccount.toLowerCase();
        if(seen.has(key))continue;
        seen.add(key);
        if(!s.exists)continue;
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
      if(n.subaccounts.length>n.subaccountHealth.length){
        add(alerts,"Nado","warning","missing-health","Missing Nado account health","Some discovered cross-margin subaccounts have no maintenance health reading.",n.updatedAt);
      }
    }else{
      const t=d as TydroAccountResponse;
      if(t.incomplete||t.warnings.length>0)
        add(alerts,"Tydro","warning","partial","Tydro account data incomplete","Some reserve balances, prices or configuration values could not be read.",t.updatedAt);
      if(t.healthFactor===null)continue;
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
  return alerts.sort((a,b)=>{
    const rank={critical:0,warning:1,info:2};
    return rank[a.level]-rank[b.level]||a.id.localeCompare(b.id);
  });
}
