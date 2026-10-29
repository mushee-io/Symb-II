import {parseUnits} from "viem";
import type {TydroAccountResponse} from "../tydro/types.ts";
import {TYDRO} from "../tydro/contracts.ts";

export type TydroDirectObservation={
  observedAt:string;blockTimestamp:string;blockNumber:string;
  chainId:number;verifiedProviderPool:string;
  oracleBaseUnit:string;collateralBaseRaw:string;debtBaseRaw:string;
  availableBorrowsBaseRaw:string;healthFactorRaw:string;emodeCategory:string;
};
export type DirectCheck={
  state:"pass"|"fail"|"not-tested";
  detail:string;
  blockNumber:string|null;
  matchedFields:number;
  comparedFields:number;
};
function decimalsFromUnit(unit:bigint):number|null{
  if(unit<1n)return null;
  let decimals=0;
  while(unit>1n&&unit%10n===0n&&decimals<=36){unit/=10n;decimals++;}
  return unit===1n&&decimals<=36?decimals:null;
}
function consistent(view:string,raw:bigint,decimals:number):boolean{
  // 0.2% allowance for separately observed onchain interest and collateral;
  // no float conversion anywhere.
  try{
    if(!/^\d+(?:\.\d+)?$/.test(view))return false;
    const parsed=parseUnits(view,decimals);
    const diff=parsed>=raw?parsed-raw:raw-parsed;
    const permitted=raw/500n>2n?raw/500n:2n;
    return diff<=permitted;
  }catch{return false;}
}
/** Reconcile a second, independently read Ink RPC contract state against
 * the HTTP adapter. This is informational, not a wallet signature,
 * a proof of available transaction funds or a signed agreement.
 * Export only the status/details, NEVER the account raw balances.
 */
export function reconcileTydroDirect(
 account:TydroAccountResponse|undefined,
 direct:TydroDirectObservation|undefined,
 now=Date.now(),
):DirectCheck{
 const unavailable=(detail:string):DirectCheck=>({state:"not-tested",detail,blockNumber:null,matchedFields:0,comparedFields:0});
 const failed=(detail:string):DirectCheck=>({state:"fail",detail,blockNumber:direct?.blockNumber??null,matchedFields:0,comparedFields:0});
 if(!account||!direct)return unavailable("Independent on-chain contract comparison was not available.");
 const stamp=Date.parse(direct.observedAt), blockTime=Date.parse(direct.blockTimestamp),feed=Date.parse(account.updatedAt);
 if([stamp,blockTime,feed].some(n=>!Number.isFinite(n)||n>now+5000||now-n>180000))
   return failed("Direct block or account snapshot is stale or time-inconsistent.");
 if(direct.chainId!==57073||account.chainId!==57073||
    direct.verifiedProviderPool.toLowerCase()!==TYDRO.pool.toLowerCase()||
    account.pool.toLowerCase()!==TYDRO.pool.toLowerCase())
   return failed("Independent contract deployment or Ink chain ID does not match the pinned Tydro Pool.");
 if(!/^\d+$/.test(direct.blockNumber))return failed("Invalid reference block number.");
 if(account.incomplete||account.warnings.length||account.userEModeCategory===null)
   return unavailable("Tydro HTTP adapter is partial; no positive reconciliation claim is possible.");
 if(!Number.isSafeInteger(account.userEModeCategory)||account.userEModeCategory<0)
   return failed("Tydro adapter returned an invalid eMode category.");
 let unit:bigint,collateral:bigint,debt:bigint,available:bigint,hf:bigint,emode:bigint;
 try{
   unit=BigInt(direct.oracleBaseUnit);collateral=BigInt(direct.collateralBaseRaw);
   debt=BigInt(direct.debtBaseRaw);available=BigInt(direct.availableBorrowsBaseRaw);
   hf=BigInt(direct.healthFactorRaw);emode=BigInt(direct.emodeCategory);
 }catch{return failed("One or more independent Pool contract fields were invalid.");}
 if([unit,collateral,debt,available,hf,emode].some(x=>x<0n))
   return failed("Pool returned a negative amount.");
 const decimals=decimalsFromUnit(unit);
 if(decimals===null||decimals!==account.oraclePriceDecimals)
   return failed("Oracle unit precision differs from adapter's reported decimals.");
 let compared=0,matched=0;
 for(const [view,value] of [
   [account.collateralBase,collateral],
   [account.debtBase,debt],
   [account.availableBorrowsBase,available],
 ] as const){
   compared++;if(consistent(view,value,decimals))matched++;
 }
 compared++;
 if(BigInt(account.userEModeCategory)===emode)matched++;
 // Debt-bearing accounts require an independent Aave health-factor check.
 if(debt>0n){
   compared++;if(account.healthFactor!==null&&consistent(account.healthFactor,hf,18))matched++;
 }else if(account.healthFactor!==null){
   compared++; // inconsistent empty-debt reporting must fail
 }
 return {
   state:matched===compared?"pass":"fail",
   detail:matched===compared?
    "Pool/provider, oracle precision, collateral, debt, borrow availability, eMode and applicable health factor independently reconciled (≤0.2% amount tolerance). Contract block is not a settlement proof.":
    "At least one Tydro Pool figure or eMode category disagrees with the independent read. Do not trust this account as verified.",
   blockNumber:direct.blockNumber,matchedFields:matched,comparedFields:compared,
 };
}
