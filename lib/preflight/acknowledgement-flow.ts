import {
 canAcknowledgePreflight,preflightApprovalMessage,type PreflightReport,
} from "./policy.ts";

/**
 * Explicit read-only preflight review acknowledgement, never an order,
 * token approval, ERC-20 permit, session or transaction authorization.
 *
 * One-use Redis GETDEL happens separately at the request boundary BEFORE this
 * function runs. Verify the original report TTL both before AND AFTER the
 * asynchronous Ink EOA/ERC-1271 signature RPC. A slow success cannot resurrect
 * an expired preflight. Errors and reversed/non-finite server clocks fail closed.
 */
export async function verifyFreshPreflightReview(args:{
 report:PreflightReport;wallet:string;origin:string;signature:string;
},deps:{
 verifySignature:(input:{
  wallet:string;challenge:string;expectedMessage:string;signature:string;
 })=>Promise<boolean>;
 now:()=>number;
}):Promise<boolean>{
 let started:number;
 try{started=deps.now();}catch{return false;}
 if(!canAcknowledgePreflight(args.report,args.wallet,started))return false;
 let message:string;
 try{message=preflightApprovalMessage(args.report,args.origin);}
 catch{return false;}
 try{
  if(!await deps.verifySignature({
   wallet:args.wallet,challenge:message,
   expectedMessage:message,signature:args.signature,
  }))return false;
 }catch{return false;}
 let completed:number;
 try{completed=deps.now();}catch{return false;}
 return Number.isFinite(completed)&&completed>=started&&
  canAcknowledgePreflight(args.report,args.wallet,completed);
}
