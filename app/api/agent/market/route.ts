import {NextRequest,NextResponse} from "next/server";
import {generateText} from "ai";
import {getAddress,isAddress} from "viem";
import {readBoundedJSON,PayloadTooLargeError} from "@/lib/security/request";
import {isAIConfigured,gatewayModel} from "@/lib/agent/generation-policy";
import {parseMarketReviewInput,prepareMarketResearch,buildMarketModelInput,validateMarketNarrative} from "@/lib/agent/market-policy";
import {isAcceptableSignature,isValidSignedChallenge} from "@/lib/agent/auth";
import {acquireLimit,consumeNonce} from "@/lib/agent/redis";
import {getNadoCandles,getNadoPreflightEngineEvidence} from "@/lib/nado/queries";

export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
const headers={"Cache-Control":"private, no-store"};
function deny(message:string,status:number){return NextResponse.json({error:message},{status,headers});}

export async function POST(req:NextRequest){
 if(!isAIConfigured())return deny("Protected AI Gateway and wallet challenge services are not enabled.",503);
 if(req.headers.get("origin")!==new URL(req.url).origin)return deny("Origin mismatch.",403);
 let body:unknown;
 try{body=await readBoundedJSON(req,4096);}
 catch(error){return deny(error instanceof PayloadTooLargeError?"Request too large.":"Invalid JSON.",
  error instanceof PayloadTooLargeError?413:400);}
 if(!body||typeof body!=="object"||Array.isArray(body))return deny("Invalid request.",400);
 const b=body as Record<string,unknown>;
 if(!Object.keys(b).every(k=>["wallet","challengeId","message","signature","productId","side","notional","leverage"].includes(k)))
  return deny("Unknown request fields.",400);
 const marketInput=parseMarketReviewInput({
  productId:b.productId,side:b.side,notional:b.notional,leverage:b.leverage,
 });
 if(!marketInput||typeof b.wallet!=="string"||!isAddress(b.wallet,{strict:false})||
   typeof b.challengeId!=="string"||!/^[0-9a-f-]{36}$/i.test(b.challengeId)||
   typeof b.message!=="string"||b.message.length>800||
   !isAcceptableSignature(b.signature))return deny("Invalid signed market research request.",400);
 const wallet=getAddress(b.wallet);
 let expected:string|null;
 try{expected=await consumeNonce(b.challengeId);}catch{return deny("Security challenge store unavailable.",503);}
 if(!expected)return deny("Challenge expired or already used.",401);
 if(!await isValidSignedChallenge({wallet,challenge:b.message,signature:b.signature,expectedMessage:expected}))
  return deny("Wallet signature failed independent Ink verification.",401);
 try{
  // Shared model budget with all other account explanations: no bypass by switching endpoints.
  if(!await acquireLimit("model:"+wallet.toLowerCase(),45))
   return deny("AI analysis is limited to one request per 45 seconds per wallet.",429);
 }catch{return deny("Rate-limit store unavailable. No unsecured fallback.",503);}
 const [c,e]=await Promise.allSettled([
  getNadoCandles(marketInput.productId,"15m"),
  getNadoPreflightEngineEvidence(marketInput.productId),
 ]);
 const evidence=prepareMarketResearch({
  request:marketInput,
  candles:c.status==="fulfilled"?c.value:null,
  engine:e.status==="fulfilled"?e.value:null,
 });
 if(evidence.status!=="observed")
  return NextResponse.json({
   kind:"evidence-incomplete",evidence,
   note:"No model call was made: required live Nado observations were missing, stale or inconsistent.",
   executionEnabled:false,
  },{headers});
 const model=gatewayModel();
 const input=buildMarketModelInput(evidence);
 if(!model||!input)return deny("Market evidence or model policy rejected.",503);
 try{
  const result=await generateText({
    model,system:input.system,prompt:input.prompt,
    maxOutputTokens:350,
    abortSignal:AbortSignal.timeout(20000),
  });
  const narrative=validateMarketNarrative(result.text);
  if(!narrative)throw Error("Unsafe or invalid narrative");
  return NextResponse.json({
   kind:"ai-market",narrative,evidence,model,
   note:"AI explanation of verified market observations only. Not a trade recommendation or execution approval.",
   executionEnabled:false,
  },{headers});
 }catch{
  return NextResponse.json({
   kind:"evidence-only",evidence,
   note:"The protected model was unavailable or rejected its output. Verified numerical market evidence is provided instead.",
   executionEnabled:false,
  },{headers});
 }
}
