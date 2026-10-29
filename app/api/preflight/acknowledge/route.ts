import {randomUUID} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {getAddress,isAddress} from "viem";
import {readBoundedJSON,PayloadTooLargeError} from "@/lib/security/request";
import {isAcceptableSignature,isValidSignedChallenge} from "@/lib/agent/auth";
import {canAcknowledgePreflight,preflightApprovalMessage} from "@/lib/preflight/policy";
import {consumePreflight,isPreflightConfigured,recordPreflightAcknowledgement} from "@/lib/preflight/store";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=15;
const headers={"Cache-Control":"private, no-store"};
function fail(error:string,status:number){return NextResponse.json({error},{status,headers});}
export async function POST(req:NextRequest){
 if(!isPreflightConfigured())return fail("Preflight acknowledgement is disabled.",503);
 if(req.headers.get("origin")!==new URL(req.url).origin)return fail("Origin mismatch.",403);
 let data:unknown;
 try{data=await readBoundedJSON(req,2048);}
 catch(e){return fail(e instanceof PayloadTooLargeError?"Request too large.":"Invalid JSON.",e instanceof PayloadTooLargeError?413:400);}
 if(!data||typeof data!=="object"||Array.isArray(data))return fail("Invalid acknowledgement.",400);
 const b=data as Record<string,unknown>;
 if(typeof b.wallet!=="string"||!isAddress(b.wallet,{strict:false})||
  typeof b.reviewId!=="string"||!/^[0-9a-f-]{36}$/i.test(b.reviewId)||
  !isAcceptableSignature(b.signature))
  return fail("Invalid wallet signature request.",400);
 const wallet=getAddress(b.wallet);
 let report;
 try{report=await consumePreflight(b.reviewId);}
 catch{return fail("Security store unavailable.",503);}
 if(!report||!canAcknowledgePreflight(report,wallet,Date.now()))
  return fail("Preflight is expired, already consumed or not eligible.",401);
 const message=preflightApprovalMessage(report,new URL(req.url).origin);
 if(!await isValidSignedChallenge({wallet,challenge:message,expectedMessage:message,signature:b.signature}))
  return fail("Invalid signature for this exact preflight.",401);
 const record={id:randomUUID(),digest:report.digest,createdAt:new Date().toISOString(),kind:report.kind};
 try{await recordPreflightAcknowledgement(wallet,record);}
 catch{return fail("Review record could not be saved; no acknowledgement confirmed.",503);}
 return NextResponse.json({record,permissionGranted:false,executionEnabled:false,
  note:"Preflight reviewed only. This acknowledgement does not permit any transaction."},{headers});
}
