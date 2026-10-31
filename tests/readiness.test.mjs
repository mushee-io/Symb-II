import {test} from "node:test";
import assert from "node:assert/strict";
import {describeReadiness} from "../lib/ops/readiness.ts";

const configured={
 UPSTASH_REDIS_REST_URL:"https://m7-fake.upstash.io/",
 UPSTASH_REDIS_REST_TOKEN:"private-token",
 CRON_SECRET:"12345678901234567890123456789012",
 AI_GATEWAY_API_KEY:"private-model-key",
 NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:"a3f47ce90b126bd84ea6c3d12b34af09",
 SYMB_II_AI_ENABLED:"true",
 SYMB_II_WATCH_ENABLED:"true",
 SYMB_II_PROPOSALS_ENABLED:"true",
 SYMB_II_PREFLIGHT_ENABLED:"true",
 SYMB_II_WALLET_PROOF_ENABLED:"true",
};
test("every feature is off without configured private infrastructure",()=>{
 const r=describeReadiness({});
 assert.equal(r.executionEnabled,false);
 assert.equal(r.allServicesConfigured,false);
 for(const id of ["ai","watch","proposals","preflight","wallet-proof"]){
   assert.equal(r.services.find(s=>s.id===id).status,"disabled");
 }
 assert.equal(r.services.find(s=>s.id==="redis").status,"blocked");
});
test("configured flags do NOT claim live authentication or validation",()=>{
 const r=describeReadiness(configured);
 assert.equal(r.allServicesConfigured,true);
 assert.equal(r.liveCredentialsValidated,false);
 assert.equal(r.services.every(s=>s.verifiedLive===false),true);
});
test("bad Redis endpoint cannot pass or be included in public response",()=>{
 const malicious={...configured,UPSTASH_REDIS_REST_URL:"http://example.com/private?token=abc"};
 const r=describeReadiness(malicious);
 assert.equal(r.allServicesConfigured,false);
 assert.equal(r.services.find(s=>s.id==="redis").status,"blocked");
 assert.equal(r.services.find(s=>s.id==="ai").status,"blocked");
 assert.equal(JSON.stringify(r).includes("token=abc"),false);
 assert.equal(JSON.stringify(r).includes(configured.AI_GATEWAY_API_KEY),false);
});
test("weak cron secret blocks monitoring even when other services are configured",()=>{
 const r=describeReadiness({...configured,CRON_SECRET:"short"});
 assert.equal(r.services.find(x=>x.id==="watch").status,"blocked");
 assert.equal(r.services.find(x=>x.id==="cron").status,"blocked");
});
test("disabled feature cannot become enabled just from configured credentials",()=>{
 const r=describeReadiness({...configured,SYMB_II_PREFLIGHT_ENABLED:"false"});
 assert.equal(r.services.find(x=>x.id==="preflight").status,"disabled");
 assert.equal(r.executionEnabled,false);
});

test("Vercel deployment OIDC is a configured-but-untested auth possibility, never live proof",()=>{
 const e={VERCEL:"1",UPSTASH_REDIS_REST_URL:"https://m7-fake.upstash.io/",
 UPSTASH_REDIS_REST_TOKEN:"private-token",SYMB_II_AI_ENABLED:"true"};
 const r=describeReadiness(e);
 assert.equal(r.services.find(x=>x.id==="ai").status,"configured");
 assert.equal(r.liveCredentialsValidated,false);
 assert.equal(r.executionEnabled,false);
});

test("server wallet proofs require explicit opt-in plus Redis, never imply execution",()=>{
 const disabled=describeReadiness({...configured,SYMB_II_WALLET_PROOF_ENABLED:"false"});
 assert.equal(disabled.services.find(x=>x.id==="wallet-proof").status,"disabled");
 const blocked=describeReadiness({...configured,UPSTASH_REDIS_REST_TOKEN:""});
 assert.equal(blocked.services.find(x=>x.id==="wallet-proof").status,"blocked");
 const active=describeReadiness(configured);
 assert.equal(active.services.find(x=>x.id==="wallet-proof").status,"configured");
 assert.equal(active.liveCredentialsValidated,false);
 assert.equal(active.executionEnabled,false);
});
