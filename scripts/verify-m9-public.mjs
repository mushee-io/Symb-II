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
  const length=Number(response.headers.get("content-length"));
  if(Number.isFinite(length)&&length>256000)throw Error("Oversized endpoint response");
  const text=await response.text();
  if(text.length>256000)throw Error("Oversized endpoint response");
  return JSON.parse(text);
 }
 const paths={
  health:"/api/health",readiness:"/api/ops/readiness",
  preflight:"/api/preflight/config",proposals:"/api/proposals/config",
  agent:"/api/agent/config",watch:"/api/watch/config",
  verification:"/api/verification/config",
  nado:"/api/nado/markets",tydro:"/api/tydro/markets",
 };
 const entries=await Promise.all(Object.entries(paths).map(async ([key,path])=>[key,await read(path)]));
 const r=Object.fromEntries(entries);
 const report=assessM9PublicQualification({
  expectedSha:args[0],health:r.health,readiness:r.readiness,
  configs:{preflight:r.preflight,proposals:r.proposals,agent:r.agent,
   watch:r.watch,verification:r.verification},nado:r.nado,tydro:r.tydro,
 });
 console.log(JSON.stringify({...report,checkedAt:new Date().toISOString()},null,2));
 if(!report.publicPrecheckPassed)process.exitCode=1;
}
main().catch(()=>{
 console.error("M9 public precheck blocked: invalid input, origin, network or production response. No release acceptance granted.");
 process.exitCode=1;
});
