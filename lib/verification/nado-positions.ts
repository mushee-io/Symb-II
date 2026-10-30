import BigNumber from "bignumber.js";
import type {NadoAccountResponse,NadoMarketsResponse} from "../nado/types.ts";

export type PositionCrosscheck={state:"pass"|"fail"|"not-tested";detail:string;comparedPositions:number};
const result=(state:PositionCrosscheck["state"],detail:string,comparedPositions=0):PositionCrosscheck=>
 ({state,detail,comparedPositions});
const fresh=(stamp:string,now:number)=>{
 const t=Date.parse(stamp);return Number.isFinite(t)&&t<=now+5000&&now-t<180000;
};
const finiteAmount=(s:unknown):BigNumber|null=>{
 // SDK/indexer amounts can contain decimal/scientific notation. Reject
 // NaN, infinity, malformed or excessively long untrusted strings.
 if(typeof s!=="string"||s.length<1||s.length>128||
    !/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d{1,4})?$/i.test(s))
  return null;
 const n=new BigNumber(s);
 return n.isFinite()?n:null;
};
const positive=(s:unknown)=>finiteAmount(s)?.gt(0)===true;
const validHealth=(h:NadoAccountResponse["subaccountHealth"][number])=>{
 const maintenance=finiteAmount(h.maintenanceHealth);
 const initial=finiteAmount(h.initialHealth);
 const assets=finiteAmount(h.maintenanceAssets);
 const liabilities=finiteAmount(h.maintenanceLiabilities);
 // Negative health is legitimate for an underwater account. Negative
 // asset or liability amounts are not valid observations.
 return maintenance!==null&&initial!==null&&assets!==null&&liabilities!==null&&
   assets.gte(0)&&liabilities.gte(0);
};
const canonicalSymbol=(symbol:unknown)=>
 typeof symbol==="string"&&symbol.length>0&&symbol.length<=80?
   symbol.trim().toUpperCase():null;

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
  // Product IDs alone can agree even if engine and indexer labels disagree.
  // A "Product #..." fallback explicitly means a symbol is unknown.
  const positionSymbol=canonicalSymbol(p.symbol);
  const tickerSymbol=canonicalSymbol(m.symbol);
  if(!positionSymbol||!tickerSymbol||positionSymbol!==tickerSymbol||
     /^PRODUCT #/i.test(positionSymbol))
   return result("fail","Nado engine position symbol disagrees with its indexer market ticker.");
  if(!positive(p.entryPrice))
   return result("fail","An active Nado position has no positive, finite entry price.");
  const health=account.subaccountHealth.filter(h=>
    h.subaccount===p.subaccount&&h.exists===true);
  if(health.length!==1||!validHealth(health[0]))
   return result("fail","Open Nado position lacks a unique, finite subaccount health observation.");
 }
 return result("pass",
   "Every open cross-margin position matches an separately fetched Nado ticker product ID (same provider), a known subaccount and a health record. This is not order, liquidity or margin-after-trade validation.",
   positions.size);
}
