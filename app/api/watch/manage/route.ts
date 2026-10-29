import {NextRequest,NextResponse} from "next/server";
import {getAddress,isAddress} from "viem";
import {isValidSignedChallenge} from "@/lib/agent/auth";
import {consumeNonce,acquireLimit} from "@/lib/agent/redis";
import {isWatchAction,isWatchConfigured,validActionMessage} from "@/lib/watch/policy";
import {watchSubscribe,watchUnsubscribe,watchStatus} from "@/lib/watch/store";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=20;
const headers={"Cache-Control":"private, no-store"};
function fail(message:string,status:number){return NextResponse.json({error:message},{status,headers});}
export async function POST(req:NextRequest){
  if(!isWatchConfigured())return fail("Persistent watch is not configured.",503);
  if(req.headers.get("origin")!==new URL(req.url).origin)return fail("Origin mismatch.",403);
  let payload:unknown;
  try{const body=await req.text();if(body.length>4096)return fail("Request too large.",413);payload=JSON.parse(body);}
  catch{return fail("Invalid JSON.",400);}
  if(!payload||typeof payload!=="object")return fail("Invalid request.",400);
  const p=payload as Record<string,unknown>;
  if(typeof p.wallet!=="string"||!isAddress(p.wallet,{strict:false})||
    typeof p.challengeId!=="string"||!/^[0-9a-f-]{36}$/i.test(p.challengeId)||
    typeof p.message!=="string"||p.message.length>1200||
    typeof p.signature!=="string"||!isWatchAction(p.action))
    return fail("Invalid signed watch request.",400);
  const wallet=getAddress(p.wallet);
  let expected:string|null;
  try{expected=await consumeNonce("watch-"+p.challengeId);}
  catch{return fail("Authentication store unavailable.",503);}
  if(!expected)return fail("Expired or already used watch challenge.",401);
  if(!validActionMessage(expected,p.action,wallet,new URL(req.url).origin))
    return fail("Incorrect watch action.",401);
  if(!await isValidSignedChallenge({wallet,challenge:p.message,expectedMessage:expected,signature:p.signature}))
    return fail("Signature does not match this wallet.",401);
  try{
    if(!await acquireLimit("watch-manage:"+wallet.toLowerCase(),3))
      return fail("Watch updates are rate-limited.",429);
    if(p.action==="subscribe"){await watchSubscribe(wallet);return NextResponse.json({subscribed:true},{headers});}
    if(p.action==="unsubscribe"){await watchUnsubscribe(wallet);return NextResponse.json({subscribed:false,events:[]},{headers});}
    return NextResponse.json(await watchStatus(wallet),{headers});
  }catch{return fail("Watch storage unavailable; no change confirmed.",503);}
}
