import {NextRequest,NextResponse} from "next/server";
import {getAddress,isAddress} from "viem";
import {readBoundedJSON,PayloadTooLargeError} from "@/lib/security/request";
import {consumeNonce} from "@/lib/agent/redis";
import {isAcceptableSignature,isValidSignedChallenge} from "@/lib/agent/auth";
import {isServerProofConfigured,isValidServerOwnershipMessage} from "@/lib/verification/server-policy";

export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=20;
const headers={"Cache-Control":"private, no-store"};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});
export async function POST(req:NextRequest){
 if(!isServerProofConfigured())return fail("Server wallet verification is disabled.",503);
 const origin=new URL(req.url).origin;
 if(req.headers.get("origin")!==origin)return fail("Origin mismatch.",403);
 let payload:unknown;
 try{payload=await readBoundedJSON(req,4096);}
 catch(e){return fail(e instanceof PayloadTooLargeError?"Request too large.":"Invalid JSON.",
   e instanceof PayloadTooLargeError?413:400);}
 if(!payload||typeof payload!=="object"||Array.isArray(payload))
  return fail("Invalid verification request.",400);
 const b=payload as Record<string,unknown>;
 if(typeof b.wallet!=="string"||!isAddress(b.wallet,{strict:false})||
   typeof b.challengeId!=="string"||!/^[0-9a-f-]{36}$/i.test(b.challengeId)||
   !isAcceptableSignature(b.signature))
  return fail("Invalid wallet, challenge or signature.",400);
 const wallet=getAddress(b.wallet);
 let message:string|null;
 try{message=await consumeNonce("m8-"+b.challengeId);}
 catch{return fail("Security store unavailable; no authentication granted.",503);}
 // GETDEL is atomic: wrong signatures, expired challenges, replay and
 // concurrent confirmations cannot reuse this nonce.
 if(!message||!isValidServerOwnershipMessage(message,wallet,origin,Date.now()))
  return fail("Challenge expired, already consumed or mismatched.",401);
 if(!await isValidSignedChallenge({
   wallet,challenge:message,expectedMessage:message,signature:b.signature,
 }))
  return fail("Invalid Ink wallet signature.",401);
 const verifiedAt=new Date().toISOString();
 return NextResponse.json({
  verified:true,wallet,verifiedAt,expiresAt:new Date(Date.now()+120000).toISOString(),
  signerSupport:"EOA or deployed ERC-1271 on Ink (57073)",
  oneUseNonceConsumed:true,
  scope:"ephemeral-read-only-control-check",
  serverSessionIssued:false,permissionGranted:false,executionEnabled:false,
  note:"A server-verified signature self-check is not a login session, spending permission or acceptance of protocol execution.",
 },{headers});
}
