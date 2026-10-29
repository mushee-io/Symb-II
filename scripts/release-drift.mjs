import {execFileSync} from "node:child_process";
import {classifyReleaseDrift} from "./release-drift-policy.mjs";
import {validatedProductionUrl} from "./release-policy.mjs";

// GitHub Actions checkout's HEAD is the actual default-branch release target.
// The default production URL is fixed; no Vercel credentials or build API.
const configuredOrigin=process.env.SMOKE_URL||"https://symb-ii.vercel.app";
const origin=configuredOrigin.endsWith("/")?configuredOrigin.slice(0,-1):configuredOrigin;
validatedProductionUrl(origin);
const expectedSha=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const rawDate=execFileSync("git",["show","-s","--format=%ct","HEAD"],{encoding:"utf8"}).trim();
const commitTimeMs=Number(rawDate)*1000;
let liveRelease=null;
let available=false;
try{
 const response=await fetch(origin+"/api/health",{
  headers:{"Accept":"application/json"},cache:"no-store",
  signal:AbortSignal.timeout(15000),
 });
 if(response.ok){
  const result=await response.json();
  if(result.product==="Symb-II"&&result.network?.chainId===57073){
   liveRelease=result.release;
   available=true;
  }
 }
}catch{
 // Public outage monitoring handles unavailable endpoints separately.
}
const state=available?classifyReleaseDrift({
 expectedSha,liveRelease,commitTimeMs,nowMs:Date.now(),
}):"indeterminate";
console.log(JSON.stringify({
 state,expectedCommit:expectedSha.slice(0,12),
 liveCommit:typeof liveRelease==="string"?liveRelease.slice(0,12):null,
 checkedAt:new Date().toISOString(),
 note:"Public release revision comparison only; this is not wallet or Redis acceptance.",
}));
