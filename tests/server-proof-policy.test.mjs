import {test} from "node:test";
import assert from "node:assert/strict";
import {serverOwnershipMessage,isValidServerOwnershipMessage,
 isServerProofConfigured} from "../lib/verification/server-policy.ts";
const now=Date.parse("2026-10-29T20:00:00Z");
const wallet="0x0000000000000000000000000000000000000001";
const alt="0x0000000000000000000000000000000000000002";
const origin="https://symb-ii.vercel.app";
const args={wallet,id:"12345678-1234-4234-8234-123456789012",issuedAt:new Date(now-3000).toISOString(),origin};
test("M8 server challenge is exact, short-lived and domain/wallet bound",()=>{
 const message=serverOwnershipMessage(args);
 assert.equal(isValidServerOwnershipMessage(message,wallet,origin,now),true);
 assert.equal(isValidServerOwnershipMessage(message,alt,origin,now),false);
 assert.equal(isValidServerOwnershipMessage(message,wallet,"https://example.com",now),false);
 assert.equal(isValidServerOwnershipMessage(message,wallet,origin,now+120000),false);
 assert.equal(isValidServerOwnershipMessage(message.replace("Chain ID: 57073","Chain ID: 1"),wallet,origin,now),false);
 assert.equal(isValidServerOwnershipMessage(message+"\nPermit: everything",wallet,origin,now),false);
 assert.equal(isValidServerOwnershipMessage(message.replace("No login session","Login session"),wallet,origin,now),false);
});
test("server challenge cannot use an insecure or credential-bearing origin",()=>{
 for(const bad of ["http://attacker.com","https://u:p@site.com","https://site.com/path",
  "https://site.com/?x=1"]){
  assert.throws(()=>serverOwnershipMessage({...args,origin:bad}));
 }
});
test("server challenge readiness has no Redis-free fallback",()=>{
 const good={UPSTASH_REDIS_REST_URL:"https://symb-fake.upstash.io/",
  UPSTASH_REDIS_REST_TOKEN:"private",SYMB_II_WALLET_PROOF_ENABLED:"true"};
 assert.equal(isServerProofConfigured(good),true);
 assert.equal(isServerProofConfigured({...good,SYMB_II_WALLET_PROOF_ENABLED:"false"}),false);
 assert.equal(isServerProofConfigured({...good,UPSTASH_REDIS_REST_TOKEN:""}),false);
});
