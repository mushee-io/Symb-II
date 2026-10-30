import {test} from "node:test";
import assert from "node:assert/strict";
import {assessM9PublicQualification} from "../scripts/m9-qualification-policy.mjs";
const sha="cea12281adae5fc1b6537467d2f6f0134fbaa958";
const serviceIds=["redis","ai","watch","proposals","preflight","wallet-proof","cron","rpc"];
const serviceRows=()=>serviceIds.map(id=>({id,status:"disabled",verifiedLive:false}));
const fixture=()=>({
 expectedSha:sha,
 health:{product:"Symb-II",release:sha.slice(0,12),network:{chainId:57073}},
 recheckHealth:{product:"Symb-II",release:sha.slice(0,12),network:{chainId:57073}},
 readiness:{release:sha.slice(0,12),network:"Ink",chainId:57073,
  liveCredentialsValidated:false,executionEnabled:false,services:serviceRows()},
 recheckReadiness:{release:sha.slice(0,12),network:"Ink",chainId:57073,
  liveCredentialsValidated:false,executionEnabled:false,services:serviceRows()},
 configs:{
  preflight:{supportsExecution:false},proposals:{supportsExecution:false,supportsBroadcast:false},
  agent:{chainId:57073,tradingEnabled:false},
  watch:{executionEnabled:false,notificationsDelivered:false},
  verification:{chainId:57073,executionEnabled:false,permissionGranted:false,
   serverSessionIssued:false,redisOneUseNonce:true},
  notifications:{
   milestone:"M13",chainId:57073,release:sha.slice(0,12),
   policyImplemented:true,deliveryEnabled:false,notificationsDelivered:false,
   providerConfigured:false,verifiedConsentStore:false,externalDeliveryVerified:false,
   executionEnabled:false,channels:["email","web-push"],
   recipientProofPolicyImplemented:true,revocationPolicyImplemented:true,
   recipientVerificationAvailable:false,recipientOwnershipVerified:false,
   signedRevocationEndpointAvailable:false,atomicRevocationVerified:false,
   privacyDeletionVerified:false,
  },
 },
 nado:{chainId:57073,source:"Nado indexer",updatedAt:new Date().toISOString(),
  markets:[{productId:2,lastPrice:5,type:"perp",symbol:"BTC-PERP",base:"BTC",
   quote:"USDT0",volume24h:100,change24h:2}]},
 tydro:{chainId:57073,source:"Tydro (Aave V3 Ink) contracts",
  updatedAt:new Date().toISOString(),
  pool:"0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA",
  incomplete:false,warnings:[],reserves:[{
   address:"0x"+"ab".repeat(20),symbol:"WETH",decimals:18,supplied:"10.25",
   borrowed:"3.25",supplyAprPct:1.2,borrowAprPct:2.5,ltvPct:72,
   liquidationThresholdPct:83,collateralEligible:true,borrowEnabled:true,
   active:true,frozen:false}]},
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
  x=>x.recheckHealth.release="e".repeat(12),
  x=>x.recheckReadiness.release=null,
  x=>x.recheckReadiness.chainId=1,
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
  x=>x.recheckReadiness.executionEnabled=true,
  x=>x.configs.preflight.supportsExecution=true,
  x=>x.configs.proposals.supportsBroadcast=true,
  x=>x.configs.agent.tradingEnabled=true,
  x=>x.configs.watch.notificationsDelivered=true,
  x=>x.configs.verification.serverSessionIssued=true,
  x=>x.configs.verification.redisOneUseNonce=false,
  x=>x.configs.notifications.deliveryEnabled=true,
  x=>x.configs.notifications.notificationsDelivered=true,
  x=>x.configs.notifications.providerConfigured=true,
  x=>x.configs.notifications.verifiedConsentStore=true,
  x=>x.configs.notifications.externalDeliveryVerified=true,
  x=>x.configs.notifications.executionEnabled=true,
  x=>x.configs.notifications.recipientVerificationAvailable=true,
  x=>x.configs.notifications.recipientOwnershipVerified=true,
  x=>x.configs.notifications.signedRevocationEndpointAvailable=true,
  x=>x.configs.notifications.atomicRevocationVerified=true,
  x=>x.configs.notifications.privacyDeletionVerified=true,
  x=>x.configs.notifications.release="f".repeat(12),
  x=>x.configs.notifications.channels=["email"],
  x=>x.configs.notifications.chainId=1,
  x=>x.configs.notifications.policyImplemented=false,
  x=>x.configs.notifications.revocationPolicyImplemented=false,
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

test("all eight M9 readiness services are unique and explicitly unverified",()=>{
 for(const change of [
  x=>x.readiness.services.pop(),
  x=>x.readiness.services[1].id="redis",
  x=>x.readiness.services[0].verifiedLive=true,
  x=>x.recheckReadiness.services[0].verifiedLive=true,
  x=>x.readiness.services[0].status="live",
 ]){
  const x=fixture();change(x);
  assert.equal(assessM9PublicQualification(x).publicPrecheckPassed,false);
 }
});
test("Nado/Tydro observations expire even when prices appear plausible",()=>{
 for(const change of [
  x=>x.nado.updatedAt=new Date(Date.now()-185000).toISOString(),
  x=>x.tydro.updatedAt=new Date(Date.now()+60000).toISOString(),
  x=>x.nado.updatedAt="invalid",
  x=>x.tydro.updatedAt=null,
 ]){
  const x=fixture();change(x);
  assert.equal(state(x,"public-nado-tydro-snapshots"),"blocked");
 }
});
test("Nado market detail and Tydro reserve risk bounds cannot be omitted or forged",()=>{
 for(const change of [
  x=>x.nado.markets[0].volume24h=-1,
  x=>x.nado.markets[0].symbol="",
  x=>x.nado.markets[0].change24h="2",
  x=>x.tydro.source="wrong",
  x=>x.tydro.reserves[0].borrowed="-3",
  x=>x.tydro.reserves[0].supplyAprPct=Infinity,
  x=>x.tydro.reserves[0].ltvPct=101,
  x=>x.tydro.reserves[0].active=false,
  x=>x.tydro.reserves[0].frozen="false",
 ]){
  const x=fixture();change(x);
  assert.equal(state(x,"public-nado-tydro-snapshots"),"blocked");
 }
});

test("missing or contradictory M13/M14 evidence blocks public acceptance",()=>{
 for(const change of [
  x=>delete x.configs.notifications,
  x=>x.configs.notifications=null,
  x=>x.configs.notifications.recipientProofPolicyImplemented=false,
  x=>x.configs.notifications.milestone="M14",
  x=>x.configs.notifications.channels=["email","email"],
  x=>x.configs.notifications.release=null,
 ]){
  const x=fixture();change(x);
  assert.equal(state(x,"non-executable-route-contracts"),"blocked");
  assert.equal(assessM9PublicQualification(x).publicPrecheckPassed,false);
 }
});
