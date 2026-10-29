import {readBoundedJSON,PayloadTooLargeError} from "@/lib/security/request";
import { NextRequest,NextResponse } from "next/server";
import { getAddress,isAddress } from "viem";
import { generateText } from "ai";
import { getNadoAccount } from "@/lib/nado/queries";
import { getTydroAccount } from "@/lib/tydro/queries";
import { buildReadOnlyBrief } from "@/lib/agent/brief";
import { allowedIntent, buildModelInput, isAIConfigured, validateNarrative, gatewayModel } from "@/lib/agent/generation-policy";
import { isAcceptableSignature,isValidSignedChallenge } from "@/lib/agent/auth";
import { acquireLimit,consumeNonce } from "@/lib/agent/redis";

export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
const headers={"Cache-Control":"private, no-store"};
function reply(error:string,status:number){return NextResponse.json({error},{status,headers});}
export async function POST(req:NextRequest){
  if(!isAIConfigured())return reply("AI model not configured; use guided analysis.",503);
  if(req.headers.get("origin")!==new URL(req.url).origin)return reply("Origin mismatch.",403);
  let data:unknown;
  try{data=await readBoundedJSON(req,4096);}
  catch(err){return reply(err instanceof PayloadTooLargeError?"Payload too large.":"Invalid JSON.",err instanceof PayloadTooLargeError?413:400);}
  if(!data||typeof data!=="object")return reply("Invalid request.",400);
  const b=data as Record<string,unknown>;
  if(typeof b.wallet!=="string"||!isAddress(b.wallet,{strict:false})||
    typeof b.challengeId!=="string"||!/^[0-9a-f-]{36}$/i.test(b.challengeId)||
    typeof b.message!=="string"||b.message.length>800||
    !isAcceptableSignature(b.signature))return reply("Invalid authentication request.",400);
  const intent=allowedIntent(b.question,b.intent);
  if(intent===null)return reply("Only the five guided read-only analysis questions are supported.",400);
  const wallet=getAddress(b.wallet);
  // All signed challenges are single-use. Missing/expired/replayed challenges fail closed.
  let expectedMessage:string|null;
  try{expectedMessage=await consumeNonce(b.challengeId);}catch{return reply("Wallet authentication store unavailable.",503);}
  if(!expectedMessage)return reply("Challenge expired or already used. Start again.",401);
  if(!await isValidSignedChallenge({wallet,challenge:b.message,signature:b.signature,expectedMessage}))
    return reply("Wallet signature verification failed.",401);
  try{
    if(!await acquireLimit("model:"+wallet.toLowerCase(),45))
      return reply("AI summaries are limited to one per 45 seconds per wallet.",429);
  }catch{return reply("AI request limiter unavailable. No unsecured fallback.",503);}
  const [n,t]=await Promise.allSettled([getNadoAccount(wallet),getTydroAccount(wallet)]);
  const now=Date.now();
  const brief=buildReadOnlyBrief({
    intent,wallet,now,
    nado:n.status==="fulfilled"?{status:"success",data:n.value}:{status:"error"},
    tydro:t.status==="fulfilled"?{status:"success",data:t.value}:{status:"error"},
  });
  // Do not send unsupported, mismatched, partial, stale or unverified data to AI.
  if(!brief.complete||brief.sources.length!==2)
    return NextResponse.json({
      kind:"guided-fallback",brief,
      note:"AI was not called because source data is unavailable, incomplete or unverified."
    },{headers});
  const {system,prompt}=buildModelInput(brief);
  const model=gatewayModel();
  if(!model)return reply("Invalid AI Gateway model configuration.",503);
  try{
    const result=await generateText({
      model,
      system,prompt,
      maxOutputTokens:450,
      abortSignal:AbortSignal.timeout(20000),
    });
    const narrative=validateNarrative(result.text);
    if(!narrative)throw Error("Invalid model response");
    return NextResponse.json({
      kind:"ai",narrative,brief,
      model,
      note:"AI-generated explanation of bounded read-only facts. Verify all claims against the sourced summary.",
    },{headers});
  }catch{
    return NextResponse.json({
      kind:"guided-fallback",brief,
      note:"AI Gateway unavailable; deterministic source summary returned instead."
    },{headers});
  }
}
