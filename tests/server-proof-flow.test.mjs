import {test} from "node:test";
import assert from "node:assert/strict";
import {serverOwnershipMessage} from "../lib/verification/server-policy.ts";
import {verifyOneUseWalletProof,isM8ChallengeId} from "../lib/verification/server-flow.ts";
const wallet="0x0000000000000000000000000000000000000001";
const alt="0x0000000000000000000000000000000000000002";
const origin="https://symb-ii.vercel.app";
const challengeId="12345678-1234-4234-8234-123456789012";
const signature="0x"+"aa".repeat(65);
const now=Date.parse("2026-10-29T20:15:00.000Z");
const message=(options={})=>serverOwnershipMessage({
 wallet,id:challengeId,origin,issuedAt:new Date(now-1000).toISOString(),
 ...options,
});
const input=(options={})=>({wallet,challengeId,signature,origin,now,...options});
function store(seed=message(),verify=async()=>true,clock=()=>now){
 const remaining=new Map([["m8-"+challengeId,seed]]);
 let verified=0,consumed=0;
 return {
  deps:{
   consumeNonce:async key=>{consumed++;const value=remaining.get(key)??null;remaining.delete(key);return value;},
   verifySignature:async args=>{verified++;return await verify(args);},
   now:clock,
  },
  stats:()=>({verified,consumed,left:remaining.size}),
 };
}
test("realistic one-use proof accepts only first attempt; subsequent replay never verifies",async()=>{
 const s=store();
 const first=await verifyOneUseWalletProof(input(),s.deps);
 const second=await verifyOneUseWalletProof(input(),s.deps);
 assert.deepEqual(first,{status:"verified",wallet,expiresAt:new Date(now+119000).toISOString()});
 assert.deepEqual(second,{status:"invalid"});
 assert.deepEqual(s.stats(),{verified:1,consumed:2,left:0});
 assert.equal(JSON.stringify(first).includes(signature),false);
});
test("two concurrent attempts never verify more than once",async()=>{
 const s=store();
 const [a,b]=await Promise.all([
  verifyOneUseWalletProof(input(),s.deps),
  verifyOneUseWalletProof(input(),s.deps),
 ]);
 assert.deepEqual([a.status,b.status].sort(),["invalid","verified"]);
 assert.equal(s.stats().verified,1);
});
test("bad signature consumes nonce; a later correct signature cannot replay",async()=>{
 const s=store(message(),async args=>args.signature===signature);
 const bad=await verifyOneUseWalletProof(input({signature:"0x"+"bb".repeat(65)}),s.deps);
 const good=await verifyOneUseWalletProof(input(),s.deps);
 assert.equal(bad.status,"invalid");
 assert.equal(good.status,"invalid");
 assert.equal(s.stats().verified,1);
});
test("expired, wrong-origin and wrong-wallet challenges fail before verification",async()=>{
 for(const change of [
  {now:now+120000},
  {origin:"https://example.org"},
  {wallet:alt},
 ]){
  const s=store();
  const r=await verifyOneUseWalletProof(input(change),s.deps);
  assert.equal(r.status,"invalid");
  assert.equal(s.stats().verified,0);
  assert.equal(s.stats().left,0);
 }
});
test("malformed nonce and signature reject before touching Redis",async()=>{
 for(const mutation of [
  {challengeId:"x".repeat(36)},
  {challengeId:"00000000-0000-0000-0000-000000000000"},
  {signature:""},
  {signature:"0x"+"aa".repeat(769)},
  {wallet:"not-an-address"},
 ]){
  const s=store();
  assert.equal((await verifyOneUseWalletProof(input(mutation),s.deps)).status,"invalid");
  assert.equal(s.stats().consumed,0);
 }
 assert.equal(isM8ChallengeId(challengeId),true);
 assert.equal(isM8ChallengeId("00000000-0000-0000-0000-000000000000"),false);
});
test("Redis failure returns unavailable, never claims verification",async()=>{
 const outcome=await verifyOneUseWalletProof(input(),{
  consumeNonce:async()=>{throw Error("secret-redis-failure");},
  verifySignature:async()=>{throw Error("must not reach signature verifier");},
  now:()=>now,
 });
 assert.deepEqual(outcome,{status:"unavailable"});
});
test("Ink RPC rejection, invalid contract signatures and thrown verifiers fail closed",async()=>{
 for(const fn of [async()=>false,async()=>{throw Error("RPC unavailable");}]){
  const s=store(message(),fn);
  assert.equal((await verifyOneUseWalletProof(input(),s.deps)).status,"invalid");
  assert.equal(s.stats().verified,1);
 }
});
test("signed payload must bind to the exact nonce requested from Redis",async()=>{
 const anotherId="abcdefab-1234-4234-8234-123456789012";
 const s=store(message({id:anotherId}));
 assert.equal((await verifyOneUseWalletProof(input(),s.deps)).status,"invalid");
 assert.equal(s.stats().verified,0);
 assert.equal(s.stats().left,0);
});
test("verification at the last second cannot renew the original challenge lifetime",async()=>{
 const nearExpiry=now+118999;
 const s=store(message(),async()=>true,()=>nearExpiry);
 const result=await verifyOneUseWalletProof(input({now:nearExpiry}),s.deps);
 assert.equal(result.status,"verified");
 assert.equal(result.expiresAt,new Date(now+119000).toISOString());
 assert.equal(Date.parse(result.expiresAt)-nearExpiry,1);
});
test("successful signature that finishes after original challenge expiry is rejected",async()=>{
 const expiredAt=now+119000;
 const s=store(message(),async()=>true,()=>expiredAt);
 const result=await verifyOneUseWalletProof(input(),s.deps);
 assert.equal(result.status,"invalid");
 assert.equal(s.stats().verified,1);
 assert.equal(s.stats().left,0);
});
test("a clock rollback, nonfinite clock, or clock error cannot grant a signed proof",async()=>{
 for(const clock of [
  ()=>now-1,
  ()=>Number.NaN,
  ()=>{throw Error("clock unavailable");},
 ]){
  const s=store(message(),async()=>true,clock);
  assert.deepEqual(await verifyOneUseWalletProof(input(),s.deps),{status:"invalid"});
 }
});
test("canonical challenge is not accepted if stored value was tampered with",async()=>{
 const s=store(message().replace("Chain ID: 57073","Chain ID: 1"));
 assert.equal((await verifyOneUseWalletProof(input(),s.deps)).status,"invalid");
 assert.equal(s.stats().verified,0);
});
