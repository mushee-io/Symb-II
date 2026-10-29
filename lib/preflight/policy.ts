import {getAddress,isAddress,keccak256,stringToHex} from "viem";

export type PreflightRequest =
  | {kind:"tydro-variable-repay";wallet:string;asset:string;percent:10|25|50|75}
  | {kind:"nado-position-reduce";wallet:string;positionKey:string;percent:10|25|50|75};

export type Gate={name:string;state:"pass"|"fail"|"unknown";detail:string};
export type PreflightReport={
  version:1;network:"Ink";chainId:57073;kind:PreflightRequest["kind"];
  wallet:string;asset:string|null;createdAt:string;blockNumber:string|null;
  reviewOnly:true;executionEnabled:false;transactionPayload:null;
  amount:{value:string;symbol:string;decimals:number}|null;
  target:{protocol:"Tydro"|"Nado";name:string;address:string|null};
  gas:{estimatedUnits:string|null;maxEstimatedNativeFee:string|null;nativeBalance:string|null;
    feeModel?:"eip1559"|"unavailable";maxFeePerGasGwei?:string|null;
    approvalEstimatedGasUnits?:string|null;approvalFeeScreeningEth?:string|null};
  snapshotEvidence?:{
    number:string;hash:string|null;verified:boolean;
    variableDebtAtomic:string;accountDebtDeviationAtomic:string;
    tokenDecimals:number|null;explanation:string;
  };
  approvalDiagnostics?:{status:"not-required"|"unavailable"|"single-call-simulated"|"zero-reset-possible"|"blocked";
    description:string;tokenAddress:string;spender:string;
    required:string|null;existing:string|null;shortfall:string|null};
  allowance:{required:string|null;current:string|null;sufficient:boolean|null};
  gates:Gate[];readyForHumanReview:boolean;digest:string;
};
export function parsePreflightRequest(value:unknown):PreflightRequest|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const r=value as Record<string,unknown>;
 if(typeof r.wallet!=="string"||!isAddress(r.wallet,{strict:false})||
    ![10,25,50,75].includes(r.percent as number))return null;
 const wallet=getAddress(r.wallet);const percent=r.percent as 10|25|50|75;
 if(r.kind==="tydro-variable-repay"&&Object.keys(r).every(k=>["kind","wallet","asset","percent"].includes(k))&&typeof r.asset==="string"&&
    isAddress(r.asset,{strict:false})&&r.positionKey===undefined)
    return {kind:r.kind,wallet,asset:getAddress(r.asset),percent};
 if(r.kind==="nado-position-reduce"&&Object.keys(r).every(k=>["kind","wallet","positionKey","percent"].includes(k))&&typeof r.positionKey==="string"&&
    r.positionKey.length>0&&r.positionKey.length<=180&&
    /^[\w.:()-]+$/.test(r.positionKey)&&r.asset===undefined)
    return {kind:r.kind,wallet,positionKey:r.positionKey,percent};
 return null;
}
export function finalizePreflight(input:Omit<PreflightReport,"readyForHumanReview"|"digest">):PreflightReport{
 const readyForHumanReview=input.gates.length>0&&input.gates.every(x=>x.state==="pass")&&
    input.kind==="tydro-variable-repay"&&input.amount!==null&&
    input.gas.estimatedUnits!==null&&input.allowance.sufficient===true;
 const base={...input,readyForHumanReview};
 // Authoritative, sorted server-defined field order. Digest is not an
 // EIP-712 transaction or an authorization to spend tokens.
 return {...base,digest:keccak256(stringToHex(JSON.stringify(base)))};
}
export function validatePreflightDigest(report:PreflightReport):boolean{
 if(report.executionEnabled!==false||report.transactionPayload!==null||
    report.reviewOnly!==true||report.chainId!==57073)return false;
 const {digest,readyForHumanReview,...base}=report;
 const expected=finalizePreflight(base);
 return expected.digest===digest&&expected.readyForHumanReview===readyForHumanReview;
}
export function canAcknowledgePreflight(report:PreflightReport,wallet:string,now:number):boolean{
 if(!isAddress(wallet,{strict:false})||report.wallet.toLowerCase()!==wallet.toLowerCase()||
    !validatePreflightDigest(report)||!report.readyForHumanReview||
    !Number.isFinite(now))return false;
 const ts=Date.parse(report.createdAt);
 return Number.isFinite(ts)&&now>=ts-5000&&now-ts<90_000;
}
export function preflightApprovalMessage(report:PreflightReport,origin:string):string{
 const url=new URL(origin);
 if(url.protocol!=="https:"&&url.hostname!=="localhost")throw Error("Insecure origin");
 return [
  "Symb-II | PREFLIGHT ACKNOWLEDGEMENT ONLY",
  "Domain: "+url.host,
  "Wallet: "+report.wallet,
  "Ink Chain ID: 57073",
  "Kind: "+report.kind,
  "Target: "+report.target.address,
  "Asset: "+report.asset,
  "Amount: "+report.amount?.value+" "+report.amount?.symbol,
  "Preflight Digest: "+report.digest,
  "Checked At: "+report.createdAt,
  "I acknowledge reviewing these preflight checks, not approving a transaction.",
  "This message is NOT an ERC20 approval, permit, order signature, transaction, spending authorization or trading delegation.",
 ].join("\n");
}
