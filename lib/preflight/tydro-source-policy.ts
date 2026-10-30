import {TYDRO} from "../tydro/contracts.ts";
import type {TydroAccountResponse,TydroMarketsResponse} from "../tydro/types.ts";
import {validTydroReserveInventory} from "../verification/tydro-reserve-integrity.ts";

/**
 * Read-only preflight cross-source gate. All input is untrusted protocol data
 * until the account wallet, both market+account pool/network, reserve inventory
 * and snapshot time agree. This is NOT a verified repayment or wallet proof.
 */
export type TydroPreflightSourceAssessment={
 valid:boolean;
 reason:string;
};
const result=(valid:boolean,reason:string):TydroPreflightSourceAssessment=>({valid,reason});
const address=/^0x[0-9a-f]{40}$/i;
function recent(timestamp:unknown,now:number){
 if(typeof timestamp!=="string")return false;
 const time=Date.parse(timestamp);
 return Number.isFinite(time)&&time<=now+5000&&now-time>=0&&now-time<90000;
}
export function assessTydroPreflightSources(args:{
 wallet:string;asset:string;
 account:TydroAccountResponse;markets:TydroMarketsResponse;
 now:number;
}):TydroPreflightSourceAssessment{
 const {wallet,asset,account,markets,now}=args;
 if(!Number.isFinite(now)||!address.test(wallet)||!address.test(asset)||
    !account||!markets||
    typeof account.address!=="string"||typeof account.pool!=="string"||
    typeof markets.pool!=="string"||
    account.address.toLowerCase()!==wallet.toLowerCase()||
    account.chainId!==57073||markets.chainId!==57073||
    account.pool.toLowerCase()!==TYDRO.pool.toLowerCase()||
    markets.pool.toLowerCase()!==TYDRO.pool.toLowerCase())
  return result(false,"Ink wallet, chain or pinned Tydro Pool does not agree across sources.");
 if(account.incomplete!==false||markets.incomplete!==false||
    !Array.isArray(account.warnings)||account.warnings.length!==0||
    !Array.isArray(markets.warnings)||markets.warnings.length!==0)
  return result(false,"Tydro reserve coverage or protocol data is incomplete.");
 if(!recent(account.updatedAt,now)||!recent(markets.updatedAt,now)||
    Math.abs(Date.parse(account.updatedAt)-Date.parse(markets.updatedAt))>60000)
  return result(false,"Tydro account and market snapshots are stale or more than 60 seconds apart.");
 if(!validTydroReserveInventory(account)||
    !Array.isArray(markets.reserves)||markets.reserves.length<1||markets.reserves.length>32)
  return result(false,"User reserve or market inventory is malformed or exceeds reviewed bounds.");
 const listed=new Map<string,TydroMarketsResponse["reserves"][number]>();
 for(const reserve of markets.reserves){
  if(!reserve||typeof reserve.address!=="string"||!address.test(reserve.address)||
     !Number.isSafeInteger(reserve.decimals)||reserve.decimals<0||reserve.decimals>36||
     typeof reserve.symbol!=="string"||!reserve.symbol.trim()||reserve.symbol.length>80||
     typeof reserve.active!=="boolean"||typeof reserve.frozen!=="boolean"||
     typeof reserve.borrowEnabled!=="boolean"||typeof reserve.collateralEligible!=="boolean")
    return result(false,"Tydro market reserve metadata is malformed.");
  const id=reserve.address.toLowerCase();
  if(listed.has(id))return result(false,"Tydro market contains duplicate reserve addresses.");
  listed.set(id,reserve);
 }
 for(const reserve of account.userReserves){
  const listedReserve=listed.get(reserve.address.toLowerCase());
  if(!listedReserve||listedReserve.decimals!==reserve.decimals||
     listedReserve.symbol!==reserve.symbol)
    return result(false,"Tydro user reserve does not match the corresponding market reserve.");
 }
 const market=listed.get(asset.toLowerCase());
 const matches=account.userReserves.filter(r=>r.address.toLowerCase()===asset.toLowerCase());
 if(!market||matches.length!==1||matches[0].decimals!==market.decimals)
  return result(false,"Requested Tydro debt asset cannot be uniquely matched across sources.");
 return result(true,"Same Ink wallet, canonical Pool, unique target reserve, complete inventories and recent account/market snapshots agree. No transaction is permitted.");
}
