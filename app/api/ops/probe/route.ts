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
async function handle(req:NextRequest){
 if(!authorized(req.headers.get("authorization"),process.env.CRON_SECRET))
   return NextResponse.json({error:"Unauthorized"},{status:401,headers});
 // Expensive connectivity checks are never exposed as a public unlimited route.
 try{
   const report=await probeServices();
   // A failed live provider must be observable as a 503 in Vercel Cron,
   // not as a superficially successful 200 response.
   return NextResponse.json(report,{status:report.summary.healthy?200:503,headers});
 }
 catch{return NextResponse.json({error:"A connectivity diagnostic failed."},{status:503,headers});}
}

/** Vercel Cron invokes GET and supplies Authorization: Bearer CRON_SECRET. */
export async function GET(req:NextRequest){
 const response=await handle(req);
 if(response.status!==401){
  const payload=await response.clone().json() as {checkedAt:string;results:{id:string;state:string}[];summary:{healthy:boolean}};
  console.info("M7_OPS_PROBE",JSON.stringify({
   at:payload.checkedAt,
   services:payload.results.map(r=>({id:r.id,state:r.state})),
   healthy:payload.summary.healthy,
   executionEnabled:false,
  }));
 }
 return response;
}
export const POST=handle;
