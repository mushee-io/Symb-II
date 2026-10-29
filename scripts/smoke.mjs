/**
 * M7 public production smoke. Never sends auth secrets or wallet signatures.
 * Usage: SMOKE_URL=https://symb-ii.vercel.app npm run smoke
 */
const root=(process.env.SMOKE_URL||"https://symb-ii.vercel.app").replace(/\/$/,"");
import {releaseMatches,validatedProductionUrl} from "./release-policy.mjs";
const parsed=validatedProductionUrl(root);
// URL was checked before requesting production data; no secrets are sent.
async function read(path){
 const response=await fetch(root+path,{
  headers:{"Accept":"application/json"},signal:AbortSignal.timeout(25000),cache:"no-store",
 });
 if(!response.ok)throw Error(path+" status "+response.status);
 return response.json();
}
const checks=[
 ["health",async()=>{
   const v=await read("/api/health");
   if(v.product!=="Symb-II"||v.network?.chainId!==57073)throw Error("Incorrect Ink deployment");
   if(!releaseMatches(v.release,process.env.EXPECTED_COMMIT_SHA))
     throw Error("Production revision differs from the triggering successful Build");
   return "Ink 57073 · release "+(v.release||"unknown");
 }],
 ["readiness",async()=>{
   const v=await read("/api/ops/readiness");
   if(v.chainId!==57073||v.executionEnabled!==false||!Array.isArray(v.services))
     throw Error("Unsafe readiness state");
   if(JSON.stringify(v).includes("UPSTASH_REDIS_REST_TOKEN="))
     throw Error("Configuration appears to expose a credential");
   return v.services.length+" configuration gates";
 }],
 ["preflight config",async()=>{
   const v=await read("/api/preflight/config");
   if(v.supportsExecution!==false)throw Error("Preflight unexpectedly enables execution");
   return v.enabled?"read-only preflight configured (requires private validation)":"preflight safely disabled";
 }],
 ["proposal config",async()=>{
   const v=await read("/api/proposals/config");
   if(v.supportsExecution!==false||v.supportsBroadcast!==false)
     throw Error("Proposal API unexpectedly allows trading");
   return v.enabled?"signed receipts configured":"signed receipts safely disabled";
 }],
 ["agent config",async()=>{
   const v=await read("/api/agent/config");
   if(v.tradingEnabled!==false||v.chainId!==57073)throw Error("Unsafe agent configuration");
   return v.modelEnabled?"model config present (untested)":"guided-only agent";
 }],
 ["watch config",async()=>{
   const v=await read("/api/watch/config");
   if(v.executionEnabled!==false||v.notificationsDelivered!==false)
     throw Error("Unexpected watch permissions or delivery");
   return v.enabled?"watch configured (not real-time)":"watch safely disabled";
 }],
 ["Nado public markets",async()=>{
   const v=await read("/api/nado/markets");
   if(v.chainId!==57073||v.source!=="Nado indexer"||!Array.isArray(v.markets)||!v.markets.length)
     throw Error("No verified Ink Nado markets");
   const ids=new Set();
   for(const m of v.markets){
    if(!Number.isSafeInteger(m.productId)||ids.has(m.productId)||
       !Number.isFinite(m.lastPrice)||m.lastPrice<=0)
      throw Error("Invalid or duplicate Nado product");
    ids.add(m.productId);
   }
   if(!v.markets.some(m=>m.type==="perp"))throw Error("No Nado perpetual product");
   return v.markets.length+" public markets observed";
 }],
 ["Tydro public reserves",async()=>{
   const v=await read("/api/tydro/markets");
   if(v.chainId!==57073||v.pool?.toLowerCase()!=="0x2816cf15f6d2a220e789aa011d5ee4eb6c47feba"||
      v.incomplete||v.warnings?.length||!Array.isArray(v.reserves)||!v.reserves.length)
     throw Error("No verified Ink Tydro reserves");
   const ids=new Set();
   for(const r of v.reserves){
     const token=r.address?.toLowerCase();
     if(!/^0x[a-f0-9]{40}$/.test(token??"")||ids.has(token)||
        !Number.isInteger(r.decimals)||r.decimals<0||r.decimals>36)
       throw Error("Invalid or duplicate Tydro token");
     ids.add(token);
   }
   return v.reserves.length+" public reserves observed";
 }],
];
let failed=0;
for(const [name,fn] of checks){
 try{console.log("PASS",name,"—",await fn());}
 catch(e){failed++;console.error("FAIL",name,"—",e instanceof Error?e.message:"unknown error");}
}
console.log("Smoke:",checks.length-failed,"/",checks.length,"checks passed");
if(failed)process.exitCode=1;
