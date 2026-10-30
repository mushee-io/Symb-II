import type {TydroAccountResponse} from "../tydro/types.ts";

/** Cross-check untrusted user-reserve rows before reporting active debt.
 * Does not compare balances to a second provider or authenticate wallet control.
 * Every row is bounded to the reviewed Aave V3 reserve interface shape.
 */
export function validTydroReserveInventory(account:TydroAccountResponse):boolean{
 const rows=account.userReserves;
 if(!Array.isArray(rows)||rows.length>32)return false;
 const seen=new Set<string>();
 const amount=(value:unknown)=>
  typeof value==="string"&&value.length>0&&value.length<=128&&
  /^\d+(?:\.\d+)?$/.test(value);
 for(const row of rows){
  if(!row||typeof row!=="object"||typeof row.address!=="string"||
     !/^0x[0-9a-f]{40}$/i.test(row.address))return false;
  const id=row.address.toLowerCase();
  if(seen.has(id))return false;
  seen.add(id);
  if(typeof row.symbol!=="string"||row.symbol.trim().length===0||
     row.symbol.length>80||!Number.isSafeInteger(row.decimals)||
     row.decimals<0||row.decimals>36||
     !Number.isSafeInteger(row.liquidationThresholdBps)||
     row.liquidationThresholdBps<0||row.liquidationThresholdBps>10000||
     typeof row.usingAsCollateral!=="boolean"||
     !amount(row.supplied)||!amount(row.variableDebt)||!amount(row.stableDebt)||
     (row.oraclePriceRaw!==null&&
      (typeof row.oraclePriceRaw!=="string"||
       !/^[1-9]\d*$/.test(row.oraclePriceRaw)||row.oraclePriceRaw.length>128)))
   return false;
 }
 return true;
}
