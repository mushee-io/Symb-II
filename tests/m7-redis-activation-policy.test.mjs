import {test} from "node:test";
import assert from "node:assert/strict";
import {assessM7RedisActivation} from "../scripts/m7-redis-activation-policy.mjs";

const sha="8".repeat(40);
const now=Date.parse("2026-10-30T17:00:00.000Z");
const fixture=()=>({
 expectedSha:sha,
 health:{product:"Symb-II",release:sha.slice(0,12),network:{chainId:57073}},
 readiness:{
  release:sha.slice(0,12),chainId:57073,executionEnabled:false,
  liveCredentialsValidated:false,
  services:[
   {id:"redis",status:"configured",verifiedLive:false},
   {id:"wallet-proof",status:"disabled",verifiedLive:false},
  ],
 },
 verification:{enabled:false,executionEnabled:false,permissionGranted:false,serverSessionIssued:false},
 probeStatus:200,
 probe:{
  checkedAt:new Date(now-3000).toISOString(),executionEnabled:false,
  summary:{healthy:true,requiredFailures:[],unconfigured:[]},
  results:[
   {id:"redis",state:"pass"},
   {id:"rpc",state:"pass"},
   {id:"nado",state:"pass"},
   {id:"tydro",state:"pass"},
  ],
 },
});
test("a real verified Redis drill and exact production release pass a Redis-only gate",()=>{
 const result=assessM7RedisActivation(fixture(),now);
 assert.equal(result.accepted,true);
 assert.equal(result.executionEnabled,false);
 assert.equal(result.walletOwnershipVerified,false);
 assert.equal(result.preflightValidated,false);
 assert.equal(result.modelServiceValidated,false);
 assert.equal(result.realPositionsVerified,false);
 assert.equal(result.checks.length,5);
 assert.equal(JSON.stringify(result).includes("private-token"),false);
});
test("stale production SHA is blocked even with healthy Redis and runtime checks",()=>{
 const f=fixture();f.health.release="0".repeat(12);
 const result=assessM7RedisActivation(f,now);
 assert.equal(result.accepted,false);
 assert.equal(result.checks.find(x=>x.id==="exact-release").status,"blocked");
});
test("Redis credentials on their own are never interpreted as live connectivity",()=>{
 const f=fixture();f.probe.results[0].state="not-configured";
 f.probe.summary.unconfigured=["redis"];
 assert.equal(assessM7RedisActivation(f,now).accepted,false);
});
test("public readiness flag without private credentials is not accepted",()=>{
 const f=fixture();f.readiness.services[0].status="blocked";
 assert.equal(assessM7RedisActivation(f,now).accepted,false);
});
test("Redis probe can never pass solely by HTTP 200 or summary.healthy",()=>{
 const edits=[
  x=>x.probe.results.splice(0,1),
  x=>x.probe.results[0].state="fail",
  x=>x.probe.results.push({id:"redis",state:"pass"}),
  x=>x.probe.results[1].state="not-configured",
  x=>x.probe.summary.healthy=false,
  x=>x.probe.summary.requiredFailures=["redis"],
  x=>x.probeStatus=503,
  x=>x.probe.checkedAt=new Date(now-92000).toISOString(),
  x=>x.probe.checkedAt=new Date(now+8000).toISOString(),
  x=>x.probe.executionEnabled=true,
 ];
 for(const edit of edits){
  const f=fixture();edit(f);
  assert.equal(assessM7RedisActivation(f,now).accepted,false,edit.toString());
 }
});
test("safety flags prevent premature wallet proof activation or trading",()=>{
 for(const edit of [
  f=>{f.verification.enabled=true;},
  f=>{f.verification.permissionGranted=true;},
  f=>{f.verification.serverSessionIssued=true;},
  f=>{f.verification.executionEnabled=true;},
  f=>{f.readiness.executionEnabled=true;},
  f=>{f.readiness.services[1].status="configured";},
  f=>{f.readiness.liveCredentialsValidated=true;},
 ]){
  const f=fixture();edit(f);
  assert.equal(assessM7RedisActivation(f,now).accepted,false,edit.toString());
 }
});
test("missing or malformed protected payload fails closed without throwing",()=>{
 for(const mutation of [
  {probe:null},
  {probe:{results:[{id:"redis",state:"pass"}],summary:{healthy:true}}},
  {health:null},
  {readiness:null},
  {verification:null},
  {expectedSha:"not-a-commit"},
 ]){
  assert.equal(assessM7RedisActivation({...fixture(),...mutation},now).accepted,false);
 }
});
test("malformed or duplicate provider entries cannot disguise bad reports",()=>{
 const f=fixture();
 f.probe.results.push({id:"nado",state:"pass"});
 assert.equal(assessM7RedisActivation(f,now).accepted,false);
});
