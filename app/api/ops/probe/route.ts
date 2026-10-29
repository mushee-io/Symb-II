import {NextRequest,NextResponse} from "next/server";
import {timingSafeEqual} from "node:crypto";
import {probeServices} from "@/lib/ops/probe";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
const headers={"Cache-Control":"private, no-store"};
function authorized(input:string|null,secret:string|undefined){
 if(!secret||secret.length<32||!input)return false;
 const supplied=Buffer.from(input);const expected=Buffer.from("Bearer "+secret);
 return supplied.length===expected.length&&timingSafeEqual(supplied,expected);
}
export async function POST(req:NextRequest){
 if(!authorized(req.headers.get("authorization"),process.env.CRON_SECRET))
   return NextResponse.json({error:"Unauthorized"},{status:401,headers});
 // Expensive connectivity checks are never exposed as a public unlimited route.
 try{return NextResponse.json(await probeServices(),{headers});}
 catch{return NextResponse.json({error:"A connectivity diagnostic failed."},{status:503,headers});}
}
