import type {AlertInput,AlertLevel,RiskAlert} from "./alerts.ts";
import {evaluateRiskAlerts} from "./alerts.ts";
import {validTydroReserveInventory} from "../verification/tydro-reserve-integrity.ts";

/**
 * M11 browser-tab-only diagnostic timeline. No browser storage, network calls,
 * balance amounts, wallet signatures, positions or persistent audit claims.
 * An event means "the currently fetched alert set changed", not that a trade,
 * liquidation, delivered notification or finality proof took place.
 */
export type InTabRiskEvent={
  at:string;
  kind:"initial"|"changed"|"recovery";
  critical:number;
  warning:number;
  details:{source:"Nado"|"Tydro";level:AlertLevel;title:string}[];
};
export type InTabRiskTimeline={
  wallet:string;
  fingerprint:string|null;
  events:InTabRiskEvent[];
  lastObservedAt:string|null;
};

const WALLET=/^0x[0-9a-f]{40}$/i;
const MAX_EVENTS=40;
const validFresh=(stamp:unknown,now:number)=>{
  if(typeof stamp!=="string")return false;
  const t=Date.parse(stamp);
  return Number.isFinite(t)&&t<=now+5000&&now-t>=0&&now-t<180000;
};
export function emptyInTabRiskTimeline(wallet:string):InTabRiskTimeline {
  return {wallet:WALLET.test(wallet)?wallet.toLowerCase():"",fingerprint:null,events:[],lastObservedAt:null};
}
function completeForRecovery(input:AlertInput,now:number):boolean {
  const wallet=input.wallet.toLowerCase();
  const n=input.nado,t=input.tydro;
  if(n.status!=="success"||t.status!=="success"||!n.data||!t.data)return false;
  if(n.data.chainId!==57073||t.data.chainId!==57073||
    typeof n.data.address!=="string"||typeof t.data.address!=="string"||
    n.data.address.toLowerCase()!==wallet||t.data.address.toLowerCase()!==wallet||
    !validFresh(n.data.updatedAt,now)||!validFresh(t.data.updatedAt,now)||
    n.data.incomplete!==false||t.data.incomplete!==false||
    n.data.positionCoverageComplete!==true||
    !Array.isArray(n.data.warnings)||n.data.warnings.length!==0||
    !Array.isArray(t.data.warnings)||t.data.warnings.length!==0||
    !Array.isArray(n.data.subaccounts)||!Array.isArray(n.data.subaccountHealth)||
    !validTydroReserveInventory(t.data))
    return false;
  return true;
}
/**
 * Feed failures produce "unknown" alerts in the existing evaluator. Loading
 * never clears an existing event. No-warning events only mean the two full,
 * fresh snapshots contain no flagged diagnostics—not financial safety.
 */
export function advanceInTabRiskTimeline(
  current:InTabRiskTimeline|undefined,
  input:AlertInput,
  now=Date.now(),
):InTabRiskTimeline {
  const wallet=typeof input?.wallet==="string"&&WALLET.test(input.wallet)?
    input.wallet.toLowerCase():"";
  const prior=current?.wallet===wallet?current:emptyInTabRiskTimeline(wallet);
  if(!wallet||!Number.isFinite(now)||
     (prior.lastObservedAt!==null&&now<Date.parse(prior.lastObservedAt)))
    return prior;
  if(input.nado.status==="loading"||input.tydro.status==="loading")return prior;
  const alerts=evaluateRiskAlerts(input,now);
  // An evaluator bug or incomplete feed must never turn "no warnings" into
  // recovery; require explicit coherent, fresh data from BOTH protocols.
  if(alerts.length===0&&!completeForRecovery(input,now))return prior;
  const ordered=[...alerts].sort((a,b)=>a.id.localeCompare(b.id));
  const fingerprint=JSON.stringify(ordered.map(a=>[a.id,a.level]));
  if(fingerprint===prior.fingerprint)return prior;
  // A recovery is meaningful only after an earlier observed condition.
  // The initial empty snapshot is merely an initial observation.
  const kind:InTabRiskEvent["kind"]=prior.fingerprint===null?"initial":
    alerts.length===0?"recovery":"changed";
  const event:InTabRiskEvent={
    at:new Date(now).toISOString(),kind,
    critical:alerts.filter(a=>a.level==="critical").length,
    warning:alerts.filter(a=>a.level==="warning").length,
    details:ordered.slice(0,60).map((a:RiskAlert)=>({
      source:a.source,level:a.level,title:a.title,
    })),
  };
  return {wallet,fingerprint,events:[event,...prior.events].slice(0,MAX_EVENTS),
    lastObservedAt:event.at};
}
/** Clear visible history, but keep the observed fingerprint to avoid immediate
 * recreation of the identical event on the next React refresh.
 */
export function clearInTabRiskTimeline(current:InTabRiskTimeline,wallet:string):InTabRiskTimeline {
  if(!WALLET.test(wallet)||current.wallet!==wallet.toLowerCase())
    return emptyInTabRiskTimeline(wallet);
  return {...current,events:[]};
}
