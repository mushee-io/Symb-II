import {NextRequest,NextResponse} from "next/server";
import {getAddress,isAddress} from "viem";
import {readBoundedJSON,PayloadTooLargeError} from "@/lib/security/request";
import {consumeNonce} from "@/lib/agent/redis";
import {isAcceptableSignature,isValidSignedChallenge} from "@/lib/agent/auth";
import {isServerProofConfigured} from "@/lib/verification/server-policy";
import {isM8ChallengeId,verifyOneUseWalletProof} from "@/lib/verification/server-flow";

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
   !isM8ChallengeId(b.challengeId)||
   !isAcceptableSignature(b.signature))
  return fail("Invalid wallet, challenge or signature.",400);
 const outcome=await verifyOneUseWalletProof({
  wallet:getAddress(b.wallet),challengeId:b.challengeId,
  signature:b.signature,origin,now:Date.now(),
 },{consumeNonce,verifySignature:isValidSignedChallenge,now:()=>Date.now()});
 if(outcome.status==="unavailable")
  return fail("Security store unavailable; no authentication granted.",503);
 if(outcome.status!=="verified")
  return fail("Challenge invalid, consumed, expired or signature rejected.",401);
 const wallet=outcome.wallet;
 const verifiedAt=new Date().toISOString();
 return NextResponse.json({
  verified:true,wallet,verifiedAt,expiresAt:outcome.expiresAt,
  signerSupport:"EOA or deployed ERC-1271 on Ink (57073)",
  oneUseNonceConsumed:true,
  scope:"ephemeral-read-only-control-check",
  serverSessionIssued:false,permissionGranted:false,executionEnabled:false,
  note:"A server-verified signature self-check is not a login session, spending permission or acceptance of protocol execution.",
 },{headers});
}
