import {randomUUID} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {getAddress,isAddress} from "viem";
import {acquireLimit,createNonce} from "@/lib/agent/redis";
import {isWatchAction,isWatchConfigured,watchChallengeMessage} from "@/lib/watch/policy";

export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=15;
const headers={"Cache-Control":"no-store"};
export async function POST(req:NextRequest){
  if(!isWatchConfigured())return NextResponse.json({error:"Persistent watch is not configured."},{status:503,headers});
  if(req.headers.get("origin")!==new URL(req.url).origin)
    return NextResponse.json({error:"Origin mismatch."},{status:403,headers});
  let payload:unknown;
  try {
    const body=await req.text();
    if(body.length>2048)return NextResponse.json({error:"Request too large."},{status:413,headers});
    payload=JSON.parse(body);
  }catch{return NextResponse.json({error:"Invalid JSON."},{status:400,headers});}
  if(!payload||typeof payload!=="object")return NextResponse.json({error:"Invalid request."},{status:400,headers});
  const p=payload as Record<string,unknown>;
  if(typeof p.wallet!=="string"||!isAddress(p.wallet,{strict:false})||!isWatchAction(p.action))
    return NextResponse.json({error:"Valid Ink address and watch action required."},{status:400,headers});
  const wallet=getAddress(p.wallet);const action=p.action;
  try {
    if(!await acquireLimit("watch-challenge:"+wallet.toLowerCase(),5))
      return NextResponse.json({error:"Too many challenges. Try again shortly."},{status:429,headers});
    const id=randomUUID();const issuedAt=new Date().toISOString();
    const message=watchChallengeMessage({address:wallet,action,id,origin:new URL(req.url).origin,issuedAt});
    await createNonce("watch-"+id,message);
    return NextResponse.json({challengeId:id,message,expiresInSeconds:120},{headers});
  }catch{
    return NextResponse.json({error:"Watch auth service unavailable."},{status:503,headers});
  }
}
