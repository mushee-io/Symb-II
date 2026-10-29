import BigNumber from "bignumber.js";
import type {NadoAccountResponse,NadoMarketsResponse} from "../nado/types.ts";

export type PositionCrosscheck={state:"pass"|"fail"|"not-tested";detail:string;comparedPositions:number};
const result=(state:PositionCrosscheck["state"],detail:string,comparedPositions=0):PositionCrosscheck=>
 ({state,detail,comparedPositions});
const fresh=(stamp:string,now:number)=>{
 const t=Date.parse(stamp);return Number.isFinite(t)&&t<=now+5000&&now-t<180000;
};
const positive=(s:string)=>{
 try{
  if(!/^(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s))return false;
  const v=new BigNumber(s);
  return v.isFinite()&&v.gt(0);
 }catch{return false;}
};
/** Public account and ticker cross-check. Same indexer provider: this is a
 * consistency test, NOT independent exchange settlement or margin proof.
 */
export function crosscheckNadoPositions(
 account:NadoAccountResponse|undefined,
 markets:NadoMarketsResponse|undefined,
 now=Date.now(),
):PositionCrosscheck{
 if(!account||!markets)return result("not-tested","Nado account or separate market snapshot unavailable.");
 if(account.chainId!==57073||markets.chainId!==57073)
  return result("fail","Account and market responses must both be Ink 57073.");
 if(!fresh(account.updatedAt,now)||!fresh(markets.updatedAt,now))
  return result("fail","Nado account or market response was stale or time-inconsistent.");
 if(account.incomplete||!account.positionCoverageComplete||account.warnings.length>0)
  return result("not-tested","Nado account has incomplete subaccount or position coverage.");
 if(account.positions.length===0)
  return result("not-tested","No open Nado position available for product cross-check.");
 if(account.positions.length>100)
  return result("fail","Nado position count exceeds reviewed bounds.");
 const subs=new Set(account.subaccounts);
 if(subs.size!==account.subaccounts.length)return result("fail","Duplicate Nado subaccount names.");
 const marketMap=new Map<number,NadoMarketsResponse["markets"][number]>();
 for(const m of markets.markets){
  if(!Number.isSafeInteger(m.productId)||marketMap.has(m.productId))
   return result("fail","Missing or duplicate Nado market product IDs.");
  marketMap.set(m.productId,m);
 }
 const positions=new Set<string>();
 for(const p of account.positions){
  const key=[p.subaccount,p.productId,p.id].join(":");
  if(!p.id||!subs.has(p.subaccount)||positions.has(key)||p.marginMode!=="cross"||
     !Number.isSafeInteger(p.productId)||p.productId<0||
     !["long","short"].includes(p.side)||!positive(p.size))
   return result("fail","Open Nado position references duplicate, invalid, isolated or unknown subaccount/size.");
  positions.add(key);
  const m=marketMap.get(p.productId);
  if(!m||m.type!=="perp"||!Number.isFinite(m.lastPrice)||m.lastPrice<=0)
   return result("fail","An open position has no valid matching perpetual market reference.");
  if(account.subaccountHealth.filter(h=>h.subaccount===p.subaccount&&h.exists===true).length!==1)
   return result("fail","Open Nado position has no unique verified subaccount health record.");
 }
 return result("pass",
   "Every open cross-margin position matches an independently fetched Nado ticker product ID, a known subaccount and a health record. This is not order, liquidity or margin-after-trade validation.",
   positions.size);
}
