/**
 * M9 public release precheck. Never sends secrets, signatures or user wallet IDs.
 * Usage: node scripts/verify-m9-public.mjs <expected-full-main-commit-sha>
 */
import {assessM9PublicQualification} from "./m9-qualification-policy.mjs";
import {validatedProductionUrl} from "./release-policy.mjs";

async function main(){
 const args=process.argv.slice(2);
 if(args.length!==1||!/^[a-f0-9]{40}$/i.test(args[0]))
  throw Error("Provide exactly one expected full 40-character Git commit SHA.");
 const origin=validatedProductionUrl(process.env.SMOKE_URL||"https://symb-ii.vercel.app").origin;
 async function read(path){
  const response=await fetch(origin+path,{
   method:"GET",redirect:"error",cache:"no-store",
   headers:{Accept:"application/json"},signal:AbortSignal.timeout(15000),
  });
  if(!response.ok)throw Error("Required public endpoint unavailable: "+path);
  const type=response.headers.get("content-type")||"";
  if(!/^application\/(?:[\w.+-]*\+)?json(?:\s*;|\s*$)/i.test(type))
   throw Error("Unexpected response content type: "+path);
  const length=Number(response.headers.get("content-length"));
  if(Number.isFinite(length)&&length>256000)throw Error("Oversized endpoint response");
  const data=await response.text();
  if(Buffer.byteLength(data,"utf8")>256000)throw Error("Oversized endpoint response");
  return JSON.parse(data);
 }
 const paths={
  health:"/api/health",readiness:"/api/ops/readiness",
  preflight:"/api/preflight/config",proposals:"/api/proposals/config",
  agent:"/api/agent/config",watch:"/api/watch/config",
  verification:"/api/verification/config",
  notifications:"/api/notifications/config",
  nado:"/api/nado/markets",tydro:"/api/tydro/markets",
 };
 const startedAt=Date.now();
 const entries=await Promise.all(Object.entries(paths).map(async ([key,path])=>[key,await read(path)]));
 const r=Object.fromEntries(entries);
 // Detect deployment replacement during slow market reads, never relying
 // only on the initial SHA observations.
 const [recheckHealth,recheckReadiness]=await Promise.all([
  read("/api/health"),read("/api/ops/readiness"),
 ]);
 const completedAt=Date.now();
 if(completedAt<startedAt||completedAt-startedAt>90000)
  throw Error("Public precheck exceeded 90 seconds or clock moved backwards.");
 const report=assessM9PublicQualification({
  expectedSha:args[0],health:r.health,readiness:r.readiness,
  recheckHealth,recheckReadiness,
  configs:{preflight:r.preflight,proposals:r.proposals,agent:r.agent,
   watch:r.watch,verification:r.verification,
   notifications:r.notifications},nado:r.nado,tydro:r.tydro,
 },completedAt);
 console.log(JSON.stringify({...report,checkedAt:new Date(completedAt).toISOString(),
  scanDurationMs:completedAt-startedAt},null,2));
 if(!report.publicPrecheckPassed)process.exitCode=1;
}
main().catch(()=>{
 console.error("M9 public precheck blocked: invalid origin, freshness, network, deployment revision or response. No release acceptance granted.");
 process.exitCode=1;
});
