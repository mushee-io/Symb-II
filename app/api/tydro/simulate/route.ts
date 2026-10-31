import {NextRequest,NextResponse} from "next/server";
import {parseTydroSimulationInput,simulateTydroAction} from "@/lib/tydro/four-action-simulation";
import {readBoundedJSON,PayloadTooLargeError} from "@/lib/security/request";
import {acquireLimit} from "@/lib/agent/redis";
import {isPreflightConfigured} from "@/lib/preflight/store";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={"Cache-Control":"private, no-store"};
const fail=(message:string,status:number)=>
 NextResponse.json({error:message,executionEnabled:false},{status,headers});

/**
 * Gated, read-only, costly RPC service. No wallet authentication, no signing,
 * no approve(), no broadcasting. An address alone proves no ownership.
 */
export async function POST(req:NextRequest){
 if(!isPreflightConfigured())
  return fail("Protected Tydro simulations are disabled.",503);
 if(req.headers.get("origin")!==new URL(req.url).origin)
  return fail("Origin mismatch.",403);
 let payload:unknown;
 try{payload=await readBoundedJSON(req,1024);}
 catch(e){
  return fail(e instanceof PayloadTooLargeError?"Request too large.":"Invalid JSON.",
   e instanceof PayloadTooLargeError?413:400);
 }
 const input=parseTydroSimulationInput(payload);
 if(!input)return fail("Invalid Ink wallet, Tydro reserve, action or exact amount.",400);
 try{
  if(!await acquireLimit("tydro-four-actions:"+input.wallet.toLowerCase(),30))
   return fail("Another simulation was requested for this wallet recently.",429);
  const report=await simulateTydroAction(input);
  return NextResponse.json({
   report,note:"Read-only pinned-block contract simulation. No token approval, signature or transaction.",
  },{headers});
 }catch{
  return fail("Protected simulation unavailable. No financial action was made.",503);
 }
}
