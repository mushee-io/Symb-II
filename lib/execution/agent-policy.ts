import {getAddress,isAddress} from "viem";

/**
 * Restrictive, draft-only policy for future AI agents. No local flag, signed
 * note or caller-supplied grant can authorize a real transaction.
 * All budgets must use EXACT atomic units of a single venue instrument.
 */
export type AgentAction="nado-reduce"|"tydro-repay";
export type AgentScope={
 wallet:string;chainId:57073;action:AgentAction;instrument:string;
 maxPerActionAtomic:string;maxDailyAtomic:string;expiresAt:number;
 revokedAt:number|null;humanApprovalRequired:true;
};
export type AgentDraftRequest={
 wallet:string;chainId:number;action:AgentAction;instrument:string;
 amountAtomic:string;spentTodayAtomic:string;
};
export type AgentDraftAssessment={
 canPrepareDraft:boolean;canExecute:false;executionEnabled:false;
 requiresFreshHumanApproval:true;reasons:string[];
};
const decimal=/^(?:0|[1-9]\d{0,77})$/;
const UINT256_MAX=(1n<<256n)-1n;
function integer(value:unknown,positive:boolean):bigint|null{
 if(typeof value!=="string"||!decimal.test(value))return null;
 try{
  const n=BigInt(value);
  return n<=UINT256_MAX&&(!positive||n>0n)?n:null;
 }catch{return null;}
}
export function assessAgentDraft(
 scope:unknown,request:unknown,now=Date.now(),
):AgentDraftAssessment{
 const reasons:string[]=[];
 const finish=():AgentDraftAssessment=>({
  canPrepareDraft:reasons.length===0,canExecute:false,executionEnabled:false,
  requiresFreshHumanApproval:true,reasons,
 });
 if(!scope||typeof scope!=="object"||Array.isArray(scope)||
    !request||typeof request!=="object"||Array.isArray(request)){
  reasons.push("Structured scope and action request are required.");
  return finish();
 }
 const s=scope as Record<string,unknown>,r=request as Record<string,unknown>;
 const supported=(action:unknown)=>action==="nado-reduce"||action==="tydro-repay";
 if(typeof s.wallet!=="string"||typeof r.wallet!=="string"||
    !isAddress(s.wallet,{strict:false})||!isAddress(r.wallet,{strict:false})||
    (isAddress(s.wallet,{strict:false})&&isAddress(r.wallet,{strict:false})&&
     getAddress(s.wallet)!==getAddress(r.wallet)))
  reasons.push("Wallet does not match a valid, explicit grant scope.");
 if(s.chainId!==57073||r.chainId!==57073)
  reasons.push("Only Ink chain 57073 is supported.");
 if(!supported(s.action)||r.action!==s.action)
  reasons.push("Requested action exceeds the scoped action.");
 if(typeof s.instrument!=="string"||s.instrument.length<1||s.instrument.length>130||
    typeof r.instrument!=="string"||r.instrument!==s.instrument)
  reasons.push("The exact venue instrument must match.");
 if(s.humanApprovalRequired!==true)
  reasons.push("Fresh human approval must always be required.");
 if(!Number.isFinite(now)||typeof s.expiresAt!=="number"||
    !Number.isSafeInteger(s.expiresAt)||s.expiresAt<=now||
    s.expiresAt>now+86400000)
  reasons.push("Grant expires too late or has expired.");
 if(s.revokedAt!==null)
  reasons.push("Grant is revoked or missing an explicit revocation field.");
 const maxSingle=integer(s.maxPerActionAtomic,true),maxDay=integer(s.maxDailyAtomic,true);
 const requested=integer(r.amountAtomic,true),spent=integer(r.spentTodayAtomic,false);
 if(maxSingle===null||maxDay===null||requested===null||spent===null)
  reasons.push("Atomic budgets and the spent counter must be exact unsigned integers.");
 else if(requested>maxSingle||requested>maxDay||spent+requested>maxDay)
  reasons.push("Per-action or daily budget would be exceeded.");
 return finish();
}
