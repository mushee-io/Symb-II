import {parseUnits} from "viem";

/** Reconcile the exact contract debt with the independently queried formatted
 * wallet view. All computations remain integer atomic units, never floats.
 */
export type DebtEvidence = {
  matched:boolean;
  rawDebt:string;
  formattedDebt:string;
  deviation:string;
  tolerance:string;
  reason:string;
};
export function reconcileDebt(args:{
  rawDebt:bigint;
  displayed:string;
  sourceDecimals:number;
  reserveDecimals:number;
  tokenDecimals:number;
  denominator?:bigint;
}):DebtEvidence{
 const {rawDebt,displayed,sourceDecimals,reserveDecimals,tokenDecimals}=args;
 const failed=(reason:string):DebtEvidence=>({
   matched:false,rawDebt:rawDebt.toString(),formattedDebt:displayed,
   deviation:"unavailable",tolerance:"unavailable",reason,
 });
 if(rawDebt<=0n)return failed("There is no positive pinned variable debt.");
 if(![sourceDecimals,reserveDecimals,tokenDecimals].every(d=>Number.isInteger(d)&&d>=0&&d<=36))
   return failed("Unrecognized token decimal precision.");
 if(sourceDecimals!==reserveDecimals||sourceDecimals!==tokenDecimals)
   return failed("Provider, reserve and token decimals disagree.");
 if(!/^\d+(?:\.\d+)?$/.test(displayed))return failed("Formatted account debt is invalid.");
 let shown:bigint;
 try{shown=parseUnits(displayed,sourceDecimals);}
 catch{return failed("Formatted debt cannot be converted to atomic units.");}
 const deviation=shown>=rawDebt?shown-rawDebt:rawDebt-shown;
 // 0.1% tolerance (1/1000) for independently queried interest accrual;
 // 1 atomic unit is allowed to handle rounding at tiny balances.
 const denominator=args.denominator??1000n;
 if(denominator<1000n)return failed("Unacceptably wide reconciliation tolerance.");
 const tolerance=rawDebt/denominator>1n?rawDebt/denominator:1n;
 return {matched:deviation<=tolerance,rawDebt:rawDebt.toString(),
   formattedDebt:displayed,deviation:deviation.toString(),
   tolerance:tolerance.toString(),
   reason:deviation<=tolerance?
     "Exact pinned variable debt reconciles with formatted account view (within 0.1%).":
     "Variable debt differs by more than 0.1% between pinned contract and account view."};
}
export function blockEvidence(args:{
  startNumber:bigint;endNumber:bigint;
  startHash:string|null;recheckHash:string|null;
  startTimestamp:bigint|null;endTimestamp:bigint|null;
  nowSeconds:bigint;
}):{matched:boolean;reason:string}{
 const {startNumber,endNumber,startHash,recheckHash,startTimestamp,endTimestamp,nowSeconds}=args;
 // A truthy string is not sufficient block evidence: require genuine
 // 32-byte EVM header hashes and compare them case-insensitively.
 const fullHash=/^0x[0-9a-f]{64}$/i;
 if(typeof startHash!=="string"||typeof recheckHash!=="string"||
    !fullHash.test(startHash)||!fullHash.test(recheckHash)||
    startHash.toLowerCase()!==recheckHash.toLowerCase())
   return {matched:false,reason:"Pinned start-block hash is missing, malformed or changed."};
 if(startNumber<0n||endNumber<startNumber||endNumber-startNumber>3n)
   return {matched:false,reason:"Invalid or excessive Ink block span during the preflight."};
 if(startTimestamp===null||endTimestamp===null||
    startTimestamp<=0n||endTimestamp<=0n||endTimestamp<startTimestamp)
   return {matched:false,reason:"Pinned block timestamps unavailable or out of order."};
 if(nowSeconds<0n||startTimestamp>nowSeconds+5n||endTimestamp>nowSeconds+5n||
    nowSeconds-startTimestamp>90n||nowSeconds-endTimestamp>90n)
   return {matched:false,reason:"Ink block evidence is too old or timestamp is inconsistent."};
 return {matched:true,reason:"Pinned block hash was stable, timestamps recent and chain advanced ≤3 blocks."};
}
export function exactPartialDebt(rawDebt:bigint,percent:number):bigint|null {
 if(![10,25,50,75].includes(percent)||rawDebt<=0n)return null;
 const amount=rawDebt*BigInt(percent)/100n;
 return amount>0n&&amount<rawDebt?amount:null;
}
