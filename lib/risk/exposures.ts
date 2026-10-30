import BigNumber from "bignumber.js";
import type {NadoAccountResponse} from "../nado/types.ts";
import type {TydroAccountResponse} from "../tydro/types.ts";
import {validTydroReserveInventory} from "../verification/tydro-reserve-integrity.ts";

/** Display-only, per-protocol exposure inventory. Never merge asset units or
 * infer combined collateral, liquidation health or authenticated ownership.
 */
export type ExposureRow={
 protocol:"Nado"|"Tydro";
 market:string;
 kind:"perpetual long"|"perpetual short"|"lending supply"|"lending variable debt"|"lending stable debt";
 amount:string;units:"base position"|"native token";
};
export type ExposureInventory={
 complete:boolean;warnings:string[];
 nadoPositions:number;tydroSuppliedAssets:number;tydroBorrowedAssets:number;
 rows:ExposureRow[];
};
const MAX_ROWS=60,MAX_AGE_MS=180000,MAX_SKEW_MS=60000;
const empty=(warning:string):ExposureInventory=>({
 complete:false,warnings:[warning],nadoPositions:0,
 tydroSuppliedAssets:0,tydroBorrowedAssets:0,rows:[],
});
const walletAddress=(s:unknown):s is string=>
 typeof s==="string"&&/^0x[0-9a-f]{40}$/i.test(s);
const timestamp=(date:unknown,now:number):number|null=>{
 if(typeof date!=="string"||!Number.isFinite(now))return null;
 const value=Date.parse(date);
 return Number.isFinite(value)&&value<=now+5000&&now-value>=0&&
   now-value<MAX_AGE_MS?value:null;
};
const amount=(s:unknown):BigNumber|null=>{
 if(typeof s!=="string"||s.length<1||s.length>128||
   !/^(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d{1,4})?$/i.test(s))return null;
 const n=new BigNumber(s);
 return n.isFinite()&&n.gte(0)?n:null;
};
const positive=(s:unknown)=>amount(s)?.gt(0)===true;
function validNadoRows(nado:NadoAccountResponse):boolean{
 if(!Array.isArray(nado.positions)||nado.positions.length>600||
    !Array.isArray(nado.subaccounts)||nado.subaccounts.length>6||
    !Array.isArray(nado.subaccountHealth)||
    !Array.isArray(nado.warnings))return false;
 const names=new Set<string>();
 for(const name of nado.subaccounts){
  if(typeof name!=="string"||!name.trim()||name.length>80||
     names.has(name.toLowerCase()))return false;
  names.add(name.toLowerCase());
 }
 const positionKeys=new Set<string>();
 for(const p of nado.positions){
  if(!p||typeof p.id!=="string"||!p.id||p.id.length>160||
     typeof p.subaccount!=="string"||!names.has(p.subaccount.toLowerCase())||
     !Number.isSafeInteger(p.productId)||p.productId<0||
     (p.side!=="long"&&p.side!=="short")||p.marginMode!=="cross"||
     typeof p.symbol!=="string"||!p.symbol.trim()||p.symbol.length>80||
     /^product #/i.test(p.symbol.trim())||
     !positive(p.size)||!positive(p.entryPrice))return false;
  const key=JSON.stringify([p.subaccount.toLowerCase(),p.productId,p.id]);
  if(positionKeys.has(key))return false;
  positionKeys.add(key);
 }
 return true;
}

/** A bad wallet/chain, stale or skewed snapshot, duplicate asset, or
 * malformed position invalidates the displayed cross-protocol inventory.
 * Partial-but-well-formed provider data may be shown with a warning, never
 * marked complete. No source value is ever considered spend authorization.
 */
export function buildExposureInventory(
 nado:NadoAccountResponse,tydro:TydroAccountResponse,now=Date.now()
):ExposureInventory{
 if(!nado||!tydro||!walletAddress(nado.address)||!walletAddress(tydro.address)||
    nado.chainId!==57073||tydro.chainId!==57073||
    nado.address.toLowerCase()!==tydro.address.toLowerCase())
  return empty("Protocol accounts do not identify the same valid Ink wallet.");
 const nadoAt=timestamp(nado.updatedAt,now);
 const tydroAt=timestamp(tydro.updatedAt,now);
 if(nadoAt===null||tydroAt===null)
  return empty("Nado or Tydro snapshot is stale or has an invalid timestamp. Refresh both sources.");
 if(Math.abs(nadoAt-tydroAt)>MAX_SKEW_MS)
  return empty("Nado and Tydro snapshots are more than 60 seconds apart. Refresh both sources.");
 if(!validNadoRows(nado)||!validTydroReserveInventory(tydro)||
    !Array.isArray(tydro.warnings))
  return empty("Protocol position or reserve inventory is malformed or duplicated. Data is withheld.");

 const warnings:string[]=[];
 const healthNames=new Set<string>();
 let healthCoverageValid=nado.subaccounts.length===nado.subaccountHealth.length;
 for(const h of nado.subaccountHealth){
  if(!h||typeof h.subaccount!=="string"||!h.subaccount.trim()||
     healthNames.has(h.subaccount.toLowerCase())||
     !nado.subaccounts.some(x=>x.toLowerCase()===h.subaccount.toLowerCase())||
     h.exists!==true)healthCoverageValid=false;
  else healthNames.add(h.subaccount.toLowerCase());
 }
 if(nado.incomplete!==false||nado.positionCoverageComplete!==true||
    nado.warnings.length>0||!healthCoverageValid)
  warnings.push("Nado position or health coverage is incomplete; missing subaccounts or positions remain possible.");
 if(tydro.incomplete!==false||tydro.warnings.length>0)
  warnings.push("Tydro reserve coverage is incomplete; additional exposure may be missing.");
 const rows:ExposureRow[]=[];
 for(const p of nado.positions)
  rows.push({protocol:"Nado",market:p.symbol,
   kind:p.side==="long"?"perpetual long":"perpetual short",
   amount:p.size,units:"base position"});
 let supplied=0,borrowed=0;
 for(const r of tydro.userReserves){
  if(positive(r.supplied)){
   supplied++;
   rows.push({protocol:"Tydro",market:r.symbol,kind:"lending supply",
    amount:r.supplied,units:"native token"});
  }
  if(positive(r.variableDebt)){
   rows.push({protocol:"Tydro",market:r.symbol,kind:"lending variable debt",
    amount:r.variableDebt,units:"native token"});
  }
  if(positive(r.stableDebt)){
   rows.push({protocol:"Tydro",market:r.symbol,kind:"lending stable debt",
    amount:r.stableDebt,units:"native token"});
  }
  if(positive(r.variableDebt)||positive(r.stableDebt))borrowed++;
 }
 if(rows.length>MAX_ROWS)
  warnings.push("More than 60 exposure rows were found; the display is truncated and not complete.");
 return {
  complete:warnings.length===0,warnings,
  nadoPositions:nado.positions.length,tydroSuppliedAssets:supplied,
  tydroBorrowedAssets:borrowed,rows:rows.slice(0,MAX_ROWS),
 };
}
