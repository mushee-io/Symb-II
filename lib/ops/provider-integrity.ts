import type {NadoMarketsResponse} from "../nado/types.ts";
import type {TydroMarketsResponse} from "../tydro/types.ts";
import {TYDRO} from "../tydro/contracts.ts";

type Evidence={valid:boolean;reason:string};
const fail=(reason:string):Evidence=>({valid:false,reason});
const pass=(reason:string):Evidence=>({valid:true,reason});
const observedRecently=(stamp:string,now:number):boolean=>{
 const time=Date.parse(stamp);
 return Number.isFinite(time)&&time<=now+5000&&now-time<180_000;
};
const address=(s:string)=>/^0x[a-f0-9]{40}$/i.test(s);
const amount=(s:string)=>/^\d+(?:\.\d+)?$/.test(s);

/** Checks shape and consistency of a freshly received Nado *response*.
 * A recent HTTP response is NOT proof of a fresh underlying trade or oracle.
 */
export function assessNadoMarketIntegrity(data:NadoMarketsResponse,now=Date.now()):Evidence{
 if(data.chainId!==57073||data.source!=="Nado indexer"||!observedRecently(data.updatedAt,now))
  return fail("Nado chain, source or response timestamp is invalid.");
 if(!Array.isArray(data.markets)||data.markets.length===0||data.markets.length>512)
  return fail("Nado returned an empty or unbounded market list.");
 const seen=new Set<number>();let perps=0;
 for(const m of data.markets){
  if(!Number.isSafeInteger(m.productId)||m.productId<0||seen.has(m.productId))
    return fail("Nado product IDs are missing, duplicate or invalid.");
  seen.add(m.productId);
  if(!["spot","perp"].includes(m.type)||!m.symbol||!m.base||!m.quote)
    return fail("Nado product type or market metadata is missing.");
  if(!Number.isFinite(m.lastPrice)||m.lastPrice<=0||
     !Number.isFinite(m.volume24h)||m.volume24h<0||
     !Number.isFinite(m.change24h))
    return fail("Nado ticker prices or metrics are invalid.");
  if(m.type==="perp")perps++;
 }
 if(perps===0)return fail("No Nado perpetual market was discovered.");
 return pass("Nado markets have consistent metadata, unique IDs and positive price references; upstream feed age and execution remain unverified.");
}
/** Contract deployment pin and response coverage checks. No onchain trading. */
export function assessTydroMarketIntegrity(data:TydroMarketsResponse,now=Date.now()):Evidence{
 if(data.chainId!==57073||data.pool.toLowerCase()!==TYDRO.pool.toLowerCase()||
    data.source!=="Tydro (Aave V3 Ink) contracts"||!observedRecently(data.updatedAt,now))
  return fail("Tydro Pool deployment, Ink chain or response timestamp disagrees.");
 if(data.incomplete||data.warnings.length>0)
  return fail("Tydro reserve queries were partial or emitted warnings.");
 if(!Array.isArray(data.reserves)||data.reserves.length===0||data.reserves.length>32)
  return fail("Tydro returned an empty or unbounded reserve list.");
 const seen=new Set<string>();let active=0;
 for(const r of data.reserves){
  const key=r.address.toLowerCase();
  if(!address(r.address)||seen.has(key)||!r.symbol||
     !Number.isInteger(r.decimals)||r.decimals<0||r.decimals>36)
   return fail("Tydro reserve addresses or token metadata disagree.");
  seen.add(key);
  if(!amount(r.supplied)||!amount(r.borrowed)||
     !Number.isFinite(r.supplyAprPct)||r.supplyAprPct<0||
     !Number.isFinite(r.borrowAprPct)||r.borrowAprPct<0||
     !Number.isFinite(r.ltvPct)||r.ltvPct<0||r.ltvPct>100||
     !Number.isFinite(r.liquidationThresholdPct)||r.liquidationThresholdPct<0||
     r.liquidationThresholdPct>100)
   return fail("Tydro reserve balances or risk metadata are invalid.");
  if(r.active)active++;
 }
 if(active===0)return fail("No active Tydro reserves were returned.");
 return pass("Pinned Ink Pool, complete reserve coverage and coherent token/risk metadata observed; independent provider transaction behavior is unverified.");
}
