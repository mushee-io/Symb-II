import {randomUUID} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {getAddress,isAddress} from "viem";
import {readBoundedJSON,PayloadTooLargeError} from "@/lib/security/request";
import {acquireLimit,createNonce} from "@/lib/agent/redis";
import {isServerProofConfigured,serverOwnershipMessage} from "@/lib/verification/server-policy";

export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=15;
const headers={"Cache-Control":"private, no-store"};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});
export async function POST(req:NextRequest){
 if(!isServerProofConfigured())return fail("Server wallet verification is disabled.",503);
 const origin=new URL(req.url).origin;
 if(req.headers.get("origin")!==origin)return fail("Origin mismatch.",403);
 let payload:unknown;
 try{payload=await readBoundedJSON(req,2048);}
 catch(e){return fail(e instanceof PayloadTooLargeError?"Request too large.":"Invalid JSON.",
  e instanceof PayloadTooLargeError?413:400);}
 if(!payload||typeof payload!=="object"||Array.isArray(payload))
  return fail("Invalid request.",400);
 const b=payload as Record<string,unknown>;
 if(typeof b.wallet!=="string"||!isAddress(b.wallet,{strict:false}))
  return fail("Valid Ink wallet required.",400);
 const wallet=getAddress(b.wallet);
 try{
  if(!await acquireLimit("m8-proof:"+wallet.toLowerCase(),5))
   return fail("Too many verification challenges. Try again shortly.",429);
  const id=randomUUID();
  const message=serverOwnershipMessage({wallet,id,issuedAt:new Date().toISOString(),origin});
  await createNonce("m8-"+id,message);
  return NextResponse.json({
   challengeId:id,message,expiresInSeconds:120,
   permissionGranted:false,executionEnabled:false,
  },{headers});
 }catch{return fail("Server challenge store unavailable; no unsafe fallback.",503);}
}
