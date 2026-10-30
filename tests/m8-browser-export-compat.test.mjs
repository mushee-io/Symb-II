import {test} from "node:test";
import assert from "node:assert/strict";
import {assessWalletVerification} from "../lib/verification/account.ts";
import {assessM8Acceptance} from "../lib/verification/acceptance.ts";
import {validateM8PublicEvidence,verifyM8PublicBlocks} from "../scripts/m8-evidence-policy.mjs";

// This test exercises the actual source that generates the Wallet Verification
// Lab's clipboard report, rather than hand-writing a compatible JSON envelope.
// All account data is deterministic and synthetic; no real wallet is certified.
const now=Date.parse("2026-10-30T19:00:00.000Z");
const observedAt=new Date(now-5000).toISOString();
const wallet="0x0000000000000000000000000000000000000001";
const hash="0x"+"ab".repeat(32);
function browserReport(){
 const walletResult=assessWalletVerification({
  wallet,connectionChainId:57073,now,
  rpc:{status:"success",data:{
   chainId:57073,blockNumber:"123",blockHash:hash,
   blockTimestamp:observedAt,code:"0x",nativeBalanceWei:"0",
   observedAt,
  }},
  nado:{status:"error"},tydro:{status:"error"},
 });
 return {
  ...walletResult,
  m8Acceptance:assessM8Acceptance(walletResult,null,now,null),
  serverOwnershipResponse:{status:"not-tested"},
  clientSideOwnershipSelfTest:{status:"not-tested"},
 };
}
test("browser-generated M8 clipboard JSON is accepted by the offline block-only schema",()=>{
 const report=browserReport();
 const parsed=JSON.parse(JSON.stringify(report));
 assert.equal(validateM8PublicEvidence(parsed,now).valid,true);
 assert.deepEqual(parsed.referenceBlocks.map(r=>r.source),["ink-rpc"]);
 assert.equal(parsed.ownerProved,false);
 assert.equal(parsed.canExecute,false);
 assert.equal(parsed.m8Acceptance.complete,false);
 assert.equal(JSON.stringify(parsed).includes("nativeBalanceWei"),false);
 assert.equal(JSON.stringify(parsed).includes("signatureBytes"),false);
});
test("browser-generated clipboard evidence independently verifies with double block read and chain recheck",async()=>{
 const report=browserReport();let blocks=0,chains=0;
 const result=await verifyM8PublicBlocks(report,{
  getChainId:async()=>{chains++;return 57073;},
  getBlock:async n=>{blocks++;return {
   number:n,hash,timestamp:BigInt(Math.floor((now-4000)/1000)),
  };},
 },now);
 assert.equal(result.valid,true);
 assert.equal(result.checked,1);
 assert.equal(result.scope,"public-blocks-only");
 assert.equal(blocks,2);
 assert.equal(chains,2);
});
test("a same-height Ink reorg on the confirmation read blocks acceptance",async()=>{
 const report=browserReport();
 let blocks=0;
 const r=await verifyM8PublicBlocks(report,{
  getChainId:async()=>57073,
  getBlock:async n=>({number:n,
   hash:++blocks===1?hash:"0x"+"cd".repeat(32),
   timestamp:BigInt(Math.floor((now-4000)/1000)),
  }),
 },now);
 assert.equal(r.valid,false);
 assert.equal(r.checked,0);
 assert.equal(blocks,2);
});
test("a chain ID change between the initial and final independently pinned checks blocks acceptance",async()=>{
 let chains=0;
 const result=await verifyM8PublicBlocks(browserReport(),{
  getChainId:async()=>++chains===1?57073:1,
  getBlock:async n=>({number:n,hash,timestamp:BigInt(Math.floor((now-4000)/1000))}),
 },now);
 assert.equal(result.valid,false);
 assert.equal(chains,2);
});
test("a report that expires while the independent RPC is in flight cannot be marked valid",async()=>{
 let ticks=0;
 const r=await verifyM8PublicBlocks(browserReport(),{
  getChainId:async()=>57073,
  getBlock:async n=>({number:n,hash,timestamp:BigInt(Math.floor((now-4000)/1000))}),
 },()=>++ticks===1?now:now+180001);
 assert.equal(r.valid,false);
});
test("clock rollback and malformed provider block fail closed",async()=>{
 const report=browserReport();
 let ticks=0;
 assert.equal((await verifyM8PublicBlocks(report,{
  getChainId:async()=>57073,
  getBlock:async n=>({number:n,hash,timestamp:BigInt(Math.floor((now-4000)/1000))}),
 },()=>++ticks===1?now:now-1)).valid,false);
 assert.equal((await verifyM8PublicBlocks(report,{
  getChainId:async()=>57073,
  getBlock:async()=>({number:"not-an-integer",hash,timestamp:"invalid"}),
 },now)).valid,false);
});

test("browser export cannot hide altered counters, a different matrix wallet or invented permissions",()=>{
 const original=browserReport();
 for(const changed of [
  {...original,passed:original.passed+1},
  {...original,m8Acceptance:{...original.m8Acceptance,wallet:"0x0000000000000000000000000000000000000002"}},
  {...original,m8Acceptance:{...original.m8Acceptance,checkedAt:new Date(now-1000).toISOString()}},
  {...original,serverOwnershipResponse:{reusableSession:true,permissionGranted:false}},
  {...original,serverOwnershipResponse:{independentlySignedReceipt:true}},
  {...original,clientSideOwnershipSelfTest:{serverAuthenticated:true}},
 ]){
  assert.equal(validateM8PublicEvidence(changed,now).valid,false);
 }
});
test("clock regression between first and second block read fails even if both hashes match",async()=>{
 const report=browserReport();
 let ticks=0;
 const timeline=[now,now+3000,now+2000];
 const r=await verifyM8PublicBlocks(report,{
  getChainId:async()=>57073,
  getBlock:async n=>({number:n,hash,timestamp:BigInt(Math.floor((now-4000)/1000))}),
 },()=>timeline[Math.min(ticks++,timeline.length-1)]);
 assert.equal(r.valid,false);
});
