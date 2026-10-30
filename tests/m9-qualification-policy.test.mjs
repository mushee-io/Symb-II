import {test} from "node:test";
import assert from "node:assert/strict";
import {assessM9PublicQualification} from "../scripts/m9-qualification-policy.mjs";
const sha="29925c0e43907bc6647a17bab680ac4e091469e8";
const fixture=()=>({
 expectedSha:sha,
 health:{product:"Symb-II",release:sha.slice(0,12),network:{chainId:57073}},
 readiness:{release:sha.slice(0,12),network:"Ink",chainId:57073,
  liveCredentialsValidated:false,executionEnabled:false,
  services:[{id:"redis",status:"disabled"}]},
 configs:{
  preflight:{supportsExecution:false},proposals:{supportsExecution:false,supportsBroadcast:false},
  agent:{chainId:57073,tradingEnabled:false},
  watch:{executionEnabled:false,notificationsDelivered:false},
  verification:{chainId:57073,executionEnabled:false,permissionGranted:false,
   serverSessionIssued:false,redisOneUseNonce:true},
 },
 nado:{chainId:57073,source:"Nado indexer",markets:[{productId:2,lastPrice:5,type:"perp"}]},
 tydro:{chainId:57073,pool:"0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA",
  incomplete:false,warnings:[],reserves:[{address:"0x"+"ab".repeat(20),decimals:18}]},
});
const state=(x,id)=>assessM9PublicQualification(x).gates.find(g=>g.id===id).state;
test("valid public responses pass only a public precheck, not release acceptance",()=>{
 const a=assessM9PublicQualification(fixture());
 assert.equal(a.publicPrecheckPassed,true);
 assert.equal(a.executionEnabled,false);
 assert.equal(a.releaseQualified,false);
 assert.equal(a.readyForPublicBeta,false);
 assert.equal(a.gates.length,12);
 assert.equal(state(fixture(),"private-redis-one-use-drill"),"blocked");
});
test("a configured Redis status never proves live nonce replay safety",()=>{
 const x=fixture();x.readiness.services[0].status="configured";
 assert.equal(state(x,"private-redis-one-use-drill"),"not-tested");
 assert.equal(assessM9PublicQualification(x).releaseQualified,false);
});
test("production revision must match BOTH independent public response surfaces",()=>{
 for(const change of [
  x=>x.health.release="f".repeat(12),
  x=>x.readiness.release=null,
  x=>x.readiness.chainId=1,
  x=>x.health.network.chainId=1,
  x=>x.expectedSha="not-full-sha",
 ]){
  const x=fixture();change(x);
  assert.equal(state(x,"exact-production-revision"),"blocked");
  assert.equal(assessM9PublicQualification(x).publicPrecheckPassed,false);
 }
});
test("execution or notification permission claims block the public precheck",()=>{
 for(const change of [
  x=>x.readiness.executionEnabled=true,
  x=>x.readiness.liveCredentialsValidated=true,
  x=>x.configs.preflight.supportsExecution=true,
  x=>x.configs.proposals.supportsBroadcast=true,
  x=>x.configs.agent.tradingEnabled=true,
  x=>x.configs.watch.notificationsDelivered=true,
  x=>x.configs.verification.serverSessionIssued=true,
  x=>x.configs.verification.redisOneUseNonce=false,
 ]){
  const x=fixture();change(x);
  assert.equal(state(x,"non-executable-route-contracts"),"blocked");
 }
});
test("wrong protocol, incomplete market feed, duplicates or invalid balances fail closed",()=>{
 for(const change of [
  x=>x.nado.source="untrusted",
  x=>x.nado.markets[0].lastPrice=NaN,
  x=>x.nado.markets.push({...x.nado.markets[0]}),
  x=>x.nado.markets[0].type="spot",
  x=>x.tydro.pool="0x"+"ff".repeat(20),
  x=>x.tydro.incomplete=true,
  x=>x.tydro.warnings=["missing reserve"],
  x=>x.tydro.reserves[0].decimals=99,
  x=>x.tydro.reserves.push({...x.tydro.reserves[0]}),
 ]){
  const x=fixture();change(x);
  assert.equal(state(x,"public-nado-tydro-snapshots"),"blocked");
 }
});
test("missing or malformed observations do not throw and never qualify",()=>{
 for(const x of [undefined,null,{}, {expectedSha:sha}, {...fixture(),readiness:{}},
   {...fixture(),configs:undefined}, {...fixture(),nado:{}}]){
  const report=assessM9PublicQualification(x);
  assert.equal(report.releaseQualified,false);
  assert.equal(report.readyForPublicBeta,false);
  assert.equal(report.publicPrecheckPassed,false);
 }
});
test("untrusted malformed JSON cannot throw or become a provider pass",()=>{
 for(const change of [
  x=>x.tydro.pool={toLowerCase:123},
  x=>x.readiness.services=[null,{id:"redis",status:"configured"}],
  x=>x.nado.markets=[null],
  x=>x.tydro.reserves=[null],
 ]){
  const x=fixture();change(x);
  assert.doesNotThrow(()=>assessM9PublicQualification(x));
  assert.equal(assessM9PublicQualification(x).releaseQualified,false);
 }
});
