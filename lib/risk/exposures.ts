import type { NadoAccountResponse } from "../nado/types.ts";
import type { TydroAccountResponse } from "../tydro/types.ts";

/** Per-protocol exposure inventory: never merge different assets or quote currencies. */
export type ExposureRow = {
  protocol: "Nado" | "Tydro";
  market: string;
  kind: "perpetual long" | "perpetual short" | "lending supply" | "lending variable debt" | "lending stable debt";
  amount: string;
  units: "base position" | "native token";
};
export type ExposureInventory = {
  complete: boolean;
  warnings: string[];
  nadoPositions: number;
  tydroSuppliedAssets: number;
  tydroBorrowedAssets: number;
  rows: ExposureRow[];
};
const MAX_ROWS=60;
function positive(value:string){
  return /^\d+(?:\.\d+)?$/.test(value) && value.replace(/0|\./g,"").length>0;
}
export function buildExposureInventory(nado:NadoAccountResponse,tydro:TydroAccountResponse):ExposureInventory{
  const warnings:string[]=[];
  if(nado.chainId!==57073||tydro.chainId!==57073||
    nado.address.toLowerCase()!==tydro.address.toLowerCase()) {
    return {complete:false,warnings:["Protocol accounts are not for the same Ink wallet."],nadoPositions:0,tydroSuppliedAssets:0,tydroBorrowedAssets:0,rows:[]};
  }
  if(nado.incomplete||nado.warnings.length) warnings.push("Nado did not return a complete first-page account view.");
  if(tydro.incomplete||tydro.warnings.length) warnings.push("Tydro account data is incomplete.");
  const rows:ExposureRow[]=[];
  for(const p of nado.positions){
    rows.push({protocol:"Nado",market:p.symbol,kind:p.side==="long"?"perpetual long":"perpetual short",
      amount:p.size,units:"base position"});
  }
  let supplied=0,borrowed=0;
  for(const r of tydro.userReserves){
    if(positive(r.supplied)){
      supplied++;
      rows.push({protocol:"Tydro",market:r.symbol,kind:"lending supply",amount:r.supplied,units:"native token"});
    }
    if(positive(r.variableDebt)){
      borrowed++;
      rows.push({protocol:"Tydro",market:r.symbol,kind:"lending variable debt",amount:r.variableDebt,units:"native token"});
    }
    if(positive(r.stableDebt)){
      if(!positive(r.variableDebt)) borrowed++;
      rows.push({protocol:"Tydro",market:r.symbol,kind:"lending stable debt",amount:r.stableDebt,units:"native token"});
    }
  }
  if(rows.length>MAX_ROWS) warnings.push("Only the first 60 positions are displayed; not all exposures are shown.");
  return {
    complete:warnings.length===0,
    warnings,
    nadoPositions:nado.positions.length,
    tydroSuppliedAssets:supplied,tydroBorrowedAssets:borrowed,
    rows:rows.slice(0,MAX_ROWS),
  };
}
