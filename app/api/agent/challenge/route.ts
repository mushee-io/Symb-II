import { randomUUID } from "node:crypto";
import { NextRequest,NextResponse } from "next/server";
import { isAddress,getAddress } from "viem";
import { isAIConfigured } from "@/lib/agent/generation-policy";
import { acquireLimit,createNonce } from "@/lib/agent/redis";
import { createChallenge } from "@/lib/agent/auth";

export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=15;
const headers={"Cache-Control":"no-store"};
export async function POST(req:NextRequest){
  if(!isAIConfigured())return NextResponse.json({error:"AI generation has not been enabled."},{status:503,headers});
  if(req.headers.get("origin")!==new URL(req.url).origin)
    return NextResponse.json({error:"Origin mismatch."},{status:403,headers});
  const length=Number(req.headers.get("content-length")||0);
  if(length>2048)return NextResponse.json({error:"Payload too large."},{status:413,headers});
  let payload:unknown;
  try{payload=await req.json();}catch{return NextResponse.json({error:"Invalid JSON."},{status:400,headers});}
  const input=payload&&typeof payload==="object"&&"wallet" in payload?payload.wallet:null;
  if(typeof input!=="string"||!isAddress(input,{strict:false}))
    return NextResponse.json({error:"Valid Ink wallet required."},{status:400,headers});
  const wallet=getAddress(input);
  try{
    if(!await acquireLimit("challenge:"+wallet.toLowerCase(),8))
      return NextResponse.json({error:"Request too frequent. Try again shortly."},{status:429,headers});
    const id=randomUUID();
    const issuedAt=new Date().toISOString();
    const message=createChallenge({address:wallet,id,issuedAt,origin:new URL(req.url).origin});
    await createNonce(id,message);
    return NextResponse.json({challengeId:id,message,expiresInSeconds:120},{headers});
  }catch{
    return NextResponse.json({error:"Wallet challenge service unavailable. No unsecured fallback."},{status:503,headers});
  }
}
