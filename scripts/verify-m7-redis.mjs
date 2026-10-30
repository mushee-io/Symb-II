/**
 * Production-only M7 Redis activation acceptance.
 * Usage after adding private Upstash URL + token to Vercel and redeploying:
 *
 *   git switch main && git pull
 *   CRON_SECRET='<operator-only-private-secret>' npm run verify:m7:redis
 *
 * Supply the secret with a secret manager/environment injection rather than
 * pasting it into a command history. Never commit or print it.
 *
 * The ONLY allowed target is canonical https://symb-ii.vercel.app. We first
 * verify the exact live commit and public disabled-wallet flags before sending
 * the protected bearer token to the canonical origin. Redirects are refused.
 */
import {execFileSync} from "node:child_process";
import {assessM7RedisActivation} from "./m7-redis-activation-policy.mjs";

const origin="https://symb-ii.vercel.app";
const jsonLimit=32768;
async function getJSON(path,secret){
 const opts={
  method:"GET",redirect:"error",cache:"no-store",
  headers:{"Accept":"application/json",...(secret?{"Authorization":"Bearer "+secret}:{})},
  signal:AbortSignal.timeout(65000),
 };
 const response=await fetch(origin+path,opts);
 const type=response.headers.get("content-type")??"";
 if(!type.toLowerCase().includes("application/json"))throw Error("Non-JSON production response.");
 const raw=await response.text();
 if(raw.length>jsonLimit)throw Error("Production response exceeded safe bound.");
 let payload;
 try{payload=JSON.parse(raw);}catch{throw Error("Invalid production JSON response.");}
 return {status:response.status,payload};
}
function currentSha(){
 try{
  const result=execFileSync("git",["rev-parse","HEAD"],{
   encoding:"utf8",timeout:5000,stdio:["ignore","pipe","ignore"],
  }).trim();
  if(!/^[0-9a-f]{40}$/i.test(result))throw Error("Invalid SHA.");
  return result;
 }catch{throw Error("Checked-out Git commit is required.");}
}
async function main(){
 const expectedSha=currentSha();
 const [h,r,v]=await Promise.all([
  getJSON("/api/health"),getJSON("/api/ops/readiness"),
  getJSON("/api/verification/config"),
 ]);
 if(h.status!==200||r.status!==200||v.status!==200||
  h.payload?.release!==expectedSha.slice(0,12)||
  r.payload?.release!==expectedSha.slice(0,12))
  throw Error("Production exact-release or public readiness check failed; protected probe not called.");

 const secret=process.env.CRON_SECRET;
 if(typeof secret!=="string"||secret.length<32)
  throw Error("CRON_SECRET is unavailable/too short in operator environment; protected probe not called.");
 const probe=await getJSON("/api/ops/probe",secret);
 const summary=assessM7RedisActivation({
  expectedSha,health:h.payload,readiness:r.payload,
  verification:v.payload,probe:probe.payload,probeStatus:probe.status,
 });
 // NEVER log the secret or the raw probe body. Report only policy-owned labels.
 console.log(JSON.stringify({
  ...summary,release:expectedSha.slice(0,12),
  checkedAt:new Date().toISOString(),
  note:"M7 Redis readiness is not a wallet signature, AI model, preflight, real position or audit acceptance.",
 },null,2));
 if(!summary.accepted)process.exitCode=1;
}
main().catch(()=>{
 // Don't serialize errors, request objects, env vars or HTTP responses:
 // upstream error messages can accidentally contain credentials.
 console.error("M7 Redis activation is blocked or not live-verified. No features enabled and no credentials printed.");
 process.exitCode=1;
});
