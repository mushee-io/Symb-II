import {NextRequest,NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {isAddress,getAddress} from "viem";
import {isAcceptableSignature,isValidSignedChallenge} from "@/lib/agent/auth";
import {readBoundedJSON,PayloadTooLargeError} from "@/lib/security/request";
import {isProposalsConfigured,packetValidForAcknowledgement,reviewSignatureMessage,type ProposalReceipt} from "@/lib/proposals/policy";
import {consumeProposal,persistReceipt} from "@/lib/proposals/store";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=15;
const headers={"Cache-Control":"private, no-store"};
function fail(error:string,status:number){return NextResponse.json({error},{status,headers});}
export async function POST(req:NextRequest){
  if(!isProposalsConfigured())return fail("Signed review receipts are disabled.",503);
  if(req.headers.get("origin")!==new URL(req.url).origin)return fail("Origin mismatch.",403);
  let body:unknown;
  try{body=await readBoundedJSON(req,4096);}
  catch(e){return fail(e instanceof PayloadTooLargeError?"Request too large.":"Invalid JSON.",e instanceof PayloadTooLargeError?413:400);}
  if(!body||typeof body!=="object"||Array.isArray(body))return fail("Malformed review receipt.",400);
  const b=body as Record<string,unknown>;
  if(typeof b.wallet!=="string"||!isAddress(b.wallet,{strict:false})||
     typeof b.id!=="string"||!/^[0-9a-f-]{36}$/i.test(b.id)||
     !isAcceptableSignature(b.signature))
    return fail("Invalid acknowledgement data.",400);
  const wallet=getAddress(b.wallet);
  let packet;
  try{packet=await consumeProposal(b.id);}
  catch{return fail("Review store unavailable.",503);}
  // Atomic GETDEL enforces one-shot semantics, including failed signature attempts.
  if(!packet||!packetValidForAcknowledgement(packet,wallet,Date.now()))
    return fail("Draft was consumed, expired or does not match this wallet.",401);
  const message=reviewSignatureMessage(packet,new URL(req.url).origin);
  if(!await isValidSignedChallenge({wallet,challenge:message,expectedMessage:message,signature:b.signature}))
    return fail("Wallet signature does not match the original review.",401);
  const receipt:ProposalReceipt={
    id:randomUUID(),proposalId:packet.id,wallet,digest:packet.digest,
    action:packet.action,protocol:packet.protocol,
    acknowledgedAt:new Date().toISOString(),status:"review-acknowledged-only",executable:false,
  };
  try{await persistReceipt(receipt);}
  catch{return fail("Receipt storage failed; no acknowledgement was confirmed.",503);}
  return NextResponse.json({receipt,notice:"Review acknowledged only. No transaction was prepared, signed or broadcast."},{headers});
}
