import {test} from "node:test";
import assert from "node:assert/strict";
import {validateM8PublicEvidence,verifyM8PublicBlocks} from "../scripts/m8-evidence-policy.mjs";

const now=Date.parse("2026-10-29T22:30:00.000Z");
const wallet="0x0000000000000000000000000000000000000001";
const seen=new Date(now-10000).toISOString();
const rpcHash="0x"+"ab".repeat(32),poolHash="0x"+"cd".repeat(32);
const evidence=()=>({
 kind:"manual-public-wallet-inspection",wallet,chainId:57073,checkedAt:seen,
 canExecute:false,ownerProved:false,completeRealWalletValidation:false,
 checks:[
  {id:"connection",state:"pass"},
  {id:"rpc",state:"pass"},
  {id:"tydro-independent-pool",state:"pass"},
 ],
 referenceBlocks:[
  {source:"ink-rpc",chainId:57073,blockNumber:"1000",blockHash:rpcHash,observedAt:seen},
  {source:"tydro-pool",chainId:57073,blockNumber:"998",blockHash:poolHash,observedAt:seen},
 ],
 m8Acceptance:{kind:"m8-read-only-acceptance-matrix",transactionEnabled:false,complete:false},
});
const provider=(data={})=>({
 getChainId:async()=>data.chainId??57073,
 getBlock:async number=>({
  number,hash:number===1000n?rpcHash:poolHash,
  timestamp:BigInt(Math.floor((now-9000)/1000)),
 }),
});
test("valid public report can independently match two Ink block hashes",async()=>{
 const x=await verifyM8PublicBlocks(evidence(),provider(),now);
 assert.equal(x.valid,true);
 assert.equal(x.checked,2);
 assert.equal(x.scope,"public-blocks-only");
 assert.equal(JSON.stringify(x).includes(wallet),false);
});
test("one wallet RPC reference is valid even when Tydro has not been tested",async()=>{
 const x=evidence();
 x.referenceBlocks=x.referenceBlocks.slice(0,1);
 x.checks[2].state="not-tested";
 const result=await verifyM8PublicBlocks(x,provider(),now);
 assert.equal(result.valid,true);
 assert.equal(result.checked,1);
});
test("a 'passing' Tydro Pool without a pinned reference is an invalid report",()=>{
 const x=evidence();x.referenceBlocks.pop();
 assert.equal(validateM8PublicEvidence(x,now).valid,false);
});
test("expired, future, wrong chain or implausible public references fail",()=>{
 for(const changes of [
  {checkedAt:new Date(now-180000).toISOString()},
  {checkedAt:new Date(now+6000).toISOString()},
  {chainId:1},
  {wallet:"not a wallet"},
  {ownerProved:true},
  {canExecute:true},
 ]){
  assert.equal(validateM8PublicEvidence({...evidence(),...changes},now).valid,false);
 }
 const changed=evidence();changed.referenceBlocks[0].blockHash="0x1234";
 assert.equal(validateM8PublicEvidence(changed,now).valid,false);
 changed.referenceBlocks[0].blockHash=rpcHash;
 changed.referenceBlocks[1].source="ink-rpc";
 assert.equal(validateM8PublicEvidence(changed,now).valid,false);
});
test("a public block reference must have the matching check marked pass",()=>{
 const x=evidence();x.checks[0].state="not-tested";x.checks[1].state="fail";
 assert.equal(validateM8PublicEvidence(x,now).valid,false);
});
test("browser-crafted M8 success claims and leaked private keys are rejected",()=>{
 for(const addition of [
  {m8Acceptance:{kind:"m8-read-only-acceptance-matrix",transactionEnabled:true,complete:true}},
  {privateKey:"sensitive-value"},
  {signatureBytes:"0x1234"},
  {nativeBalanceWei:"1000000000000000000"},
  {nested:{debtBaseRaw:"9999"}},
 ]){
  assert.equal(validateM8PublicEvidence({...evidence(),...addition},now).valid,false);
 }
});
test("a different Ink chain ID is never accepted as independent verification",async()=>{
 const x=await verifyM8PublicBlocks(evidence(),provider({chainId:1}),now);
 assert.equal(x.valid,false);
 assert.equal(x.checked,0);
});
test("independent provider disagreement or reorg fails even if browser reported pass",async()=>{
 const wrong={
  getChainId:async()=>57073,
  getBlock:async n=>({number:n,hash:"0x"+"ef".repeat(32),
   timestamp:BigInt(Math.floor((now-5000)/1000))}),
 };
 const result=await verifyM8PublicBlocks(evidence(),wrong,now);
 assert.equal(result.valid,false);
 assert.equal(result.checked,0);
});
test("RPC errors, stale block timestamps and missing block hashes fail closed",async()=>{
 const cases=[
  {getChainId:async()=>57073,getBlock:async()=>{throw Error("public RPC outage");}},
  {getChainId:async()=>57073,getBlock:async n=>({number:n,hash:rpcHash,timestamp:0n})},
  {getChainId:async()=>57073,getBlock:async n=>({number:n,hash:null,timestamp:BigInt(Math.floor(now/1000))})},
 ];
 for(const p of cases){
  const x=await verifyM8PublicBlocks(evidence(),p,now);
  assert.equal(x.valid,false);
  assert.equal(x.scope,"public-blocks-only");
 }
});
test("duplicate check identifiers and missing RPC pass cannot certify a report",()=>{
 const x=evidence();x.checks.push({id:"rpc",state:"pass"});
 assert.equal(validateM8PublicEvidence(x,now).valid,false);
 x.checks.pop();x.checks[1].state="not-tested";
 assert.equal(validateM8PublicEvidence(x,now).valid,false);
});
