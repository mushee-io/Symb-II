import {randomUUID} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {parsePreflightRequest} from "@/lib/preflight/policy";
import {preflightTydro} from "@/lib/preflight/tydro";
import {preflightNado} from "@/lib/preflight/nado";
import {isPreflightConfigured,storePreflight} from "@/lib/preflight/store";
import {readBoundedJSON,PayloadTooLargeError} from "@/lib/security/request";
import {acquireLimit} from "@/lib/agent/redis";

export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
const headers={"Cache-Control":"private, no-store"};
function error(message:string,status:number){return NextResponse.json({error:message},{status,headers});}
export async function POST(req:NextRequest){
 if(!isPreflightConfigured())return error("On-chain preflight is not activated. Read-only Rescue Lab remains available.",503);
 if(req.headers.get("origin")!==new URL(req.url).origin)return error("Origin mismatch.",403);
 let value:unknown;
 try{value=await readBoundedJSON(req,1024);}
 catch(e){return error(e instanceof PayloadTooLargeError?"Request too large.":"Invalid JSON.",e instanceof PayloadTooLargeError?413:400);}
 const input=parsePreflightRequest(value);
 if(!input)return error("Unsupported transaction type or invalid Ink wallet.",400);
 try{
  // Redis-backed quota fails closed. This limits repeat heavy RPC requests.
  if(!await acquireLimit("preflight-check:"+input.wallet.toLowerCase(),25))
   return error("A preflight for this wallet was requested recently. Try again shortly.",429);
  const report=input.kind==="tydro-variable-repay"?await preflightTydro(input):await preflightNado(input);
  let id:string|null=null;
  if(report.readyForHumanReview){
    const candidate=randomUUID();
    if(!await storePreflight(candidate,report))
      return error("Review receipt store unavailable.",503);
    id=candidate;
  }
  return NextResponse.json({report,reviewId:id,
    note:"Checks are snapshots, not fee quotes or transaction approvals. No token approval or transaction was submitted."},{headers});
 }catch{
  return error("Verified protocol/RPC reads failed; no execution route or approval is available.",503);
 }
}
