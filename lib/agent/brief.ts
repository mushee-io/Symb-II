import type { NadoAccountResponse } from "../nado/types.ts";
import type { TydroAccountResponse } from "../tydro/types.ts";
import { evaluateRiskAlerts, type FeedState } from "../risk/alerts.ts";

export type BriefIntent = "overview" | "risk" | "nado" | "tydro" | "next-steps";
export type CapitalBrief = {
  intent: BriefIntent; title: string; lines: string[];
  limitations: string[]; sources: string[]; complete: boolean;
  canTrade: false; generatedBy: "deterministic-read-only-rules";
};
export const INTENTS: {id:BriefIntent;label:string;prompt:string}[] = [
  {id:"overview",label:"Capital overview",prompt:"Summarise my Ink accounts"},
  {id:"risk",label:"Check my risk",prompt:"What are my current risk warnings?"},
  {id:"nado",label:"Nado positions",prompt:"Show my Nado trading positions"},
  {id:"tydro",label:"Tydro lending",prompt:"Explain my Tydro supply and debt"},
  {id:"next-steps",label:"Review checklist",prompt:"What should I review next?"},
];
export function classifyBriefIntent(text:string):BriefIntent|null {
  const v=text.toLowerCase().trim().slice(0,500);
  if(!v)return null;
  if(/(buy|sell|execute|withdraw|transfer|place order|send funds|private key|sign transaction)/.test(v))return null;
  if(/(what should|next step|review|action|improve|protect|reduce risk)/.test(v))return "next-steps";
  if(/(liquidat|risk|health|danger|safe|margin)/.test(v))return "risk";
  if(/(nado|trading|perp|order|position)/.test(v))return "nado";
  if(/(tydro|borrow|lend|supply|collateral|debt|loan)/.test(v))return "tydro";
  if(/(overview|summary|summari|capital|accounts|portfolio|balance|exposure)/.test(v))return "overview";
  return null;
}
const isRecent=(s:string,now:number)=>{const t=Date.parse(s);return Number.isFinite(t)&&t<=now+5000&&now-t<=180000};
const neat=(s:string,max=15)=>s.length>max?s.slice(0,max)+"…":s;
export function buildReadOnlyBrief(args:{
  intent:BriefIntent;wallet:string;nado:FeedState<NadoAccountResponse>;tydro:FeedState<TydroAccountResponse>;now?:number;
}):CapitalBrief{
  const {intent,wallet}=args;const now=args.now??Date.now();
  const lines:string[]=[],limitations:string[]=[],sources:string[]=[];
  const titles:Record<BriefIntent,string>={
    overview:"Ink capital overview",risk:"Current risk watch",nado:"Nado account activity",
    tydro:"Tydro lending snapshot","next-steps":"Read-only review checklist",
  };
  const result=():CapitalBrief=>({intent,title:titles[intent],lines,limitations,sources,
    complete:limitations.length===0,canTrade:false,generatedBy:"deterministic-read-only-rules"});
  if(!/^0x[0-9a-f]{40}$/i.test(wallet)){limitations.push("Connect a valid Ink wallet to access account-specific readings.");return result();}
  const goodN=args.nado.status==="success"&&args.nado.data?.chainId===57073&&args.nado.data.address.toLowerCase()===wallet.toLowerCase()&&isRecent(args.nado.data.updatedAt,now)
    ?args.nado.data:null;
  const goodT=args.tydro.status==="success"&&args.tydro.data?.chainId===57073&&args.tydro.data.address.toLowerCase()===wallet.toLowerCase()&&isRecent(args.tydro.data.updatedAt,now)
    ?args.tydro.data:null;
  if(!goodN)limitations.push("Nado account data is loading, unavailable, mismatched or older than three minutes.");
  else{sources.push("Nado engine/indexer · "+goodN.updatedAt);if(goodN.incomplete||!goodN.positionCoverageComplete)limitations.push("Nado account coverage is partial.");}
  if(!goodT)limitations.push("Tydro account data is loading, unavailable, mismatched or older than three minutes.");
  else{sources.push("Tydro Pool contracts · "+goodT.updatedAt);if(goodT.incomplete)limitations.push("Tydro account coverage is partial.");}
  const alerts=evaluateRiskAlerts({wallet,nado:{status:goodN?"success":"error",data:goodN??undefined},
    tydro:{status:goodT?"success":"error",data:goodT??undefined}},now);
  if(intent==="overview"){
    if(goodN)lines.push("Nado: "+goodN.positions.length+" indexed open position(s) in "+goodN.subaccounts.length+" queried cross-margin subaccount(s).");
    if(goodT)lines.push("Tydro: "+goodT.userReserves.filter(x=>Number(x.supplied)>0).length+" supplied token asset(s) and "+goodT.userReserves.filter(x=>Number(x.stableDebt)>0||Number(x.variableDebt)>0).length+" debt-bearing asset(s).");
    lines.push("Nado and Tydro hold separate margin/collateral. No combined account equity or transferable balance is inferred.");
  }
  if(intent==="nado"){
    if(goodN){
      lines.push("Nado open positions: "+goodN.positions.length+".");
      for(const p of goodN.positions.slice(0,8))
        lines.push(p.symbol+" · "+p.side+" · size "+neat(p.size)+" base · "+p.marginMode+" · "+p.subaccount+".");
      if(goodN.positions.length>8)limitations.push("Only the first eight Nado positions are described.");
      lines.push("Nado open orders: "+goodN.openOrders.length+". Indexed order entries: "+goodN.indexedOrders.length+".");
    }
    lines.push("Position inventory is not an executable order plan, current mark-to-market PnL or liquidation calculation.");
  }
  if(intent==="tydro"){
    if(goodT){
      lines.push(goodT.healthFactor===null?"Tydro reports no current debt health factor.":"Tydro health factor: "+neat(goodT.healthFactor,25)+".");
      lines.push("Reported protocol collateral: "+neat(goodT.collateralBase,22)+" oracle base units; debt: "+neat(goodT.debtBase,22)+" oracle base units.");
      for(const r of goodT.userReserves.slice(0,8))
        lines.push(r.symbol+" · supplied "+neat(r.supplied)+" · variable debt "+neat(r.variableDebt)+" · stable debt "+neat(r.stableDebt)+".");
      if(goodT.userReserves.length>8)limitations.push("Only the first eight Tydro assets are described.");
    }
    lines.push("Tydro oracle base units are not automatically USD. Borrowing and liquidation settings remain protocol-specific.");
  }
  if(intent==="risk"||intent==="next-steps"){
    const critical=alerts.filter(a=>a.level==="critical");const warnings=alerts.filter(a=>a.level==="warning");
    lines.push(critical.length+" critical and "+warnings.length+" warning condition(s) across available feed snapshots.");
    for(const alert of alerts.slice(0,8))lines.push(alert.source+" · "+alert.level+": "+alert.title+". "+alert.detail);
    if(alerts.length>8)limitations.push("Additional alerts exist outside this summary.");
    if(intent==="next-steps"){
      if(critical.length)lines.push("Review critical conditions in the official protocol interfaces before considering any changes.");
      if(warnings.length)lines.push("Check stale/partial feeds and confirm lending health and Nado maintenance buffers directly.");
      if(!critical.length&&!warnings.length)lines.push("Review your open Nado positions, Tydro borrowing health and the stress tools; absence of warnings is not proof of safety.");
      lines.push("No trade or borrowing action is prepared or authorised. Future actions require independent simulation and explicit approval.");
    }
  }
  if(!lines.length)lines.push("No verified account information is currently available for this brief.");
  return result();
}
