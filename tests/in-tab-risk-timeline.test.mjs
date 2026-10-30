import {test} from "node:test";
import assert from "node:assert/strict";
import {
  emptyInTabRiskTimeline,advanceInTabRiskTimeline,clearInTabRiskTimeline,
} from "../lib/risk/in-tab-timeline.ts";

const NOW=Date.parse("2026-10-30T20:00:00.000Z");
const wallet="0x0000000000000000000000000000000000000001";
const another="0x0000000000000000000000000000000000000002";
const stamp=new Date(NOW-10000).toISOString();
function nado(overrides={}){
 return {chainId:57073,address:wallet,updatedAt:stamp,incomplete:false,
  positionCoverageComplete:true,warnings:[],subaccounts:["main"],
  subaccountHealth:[{subaccount:"main",exists:true,maintenanceHealth:"4",
   initialHealth:"4",maintenanceAssets:"5",maintenanceLiabilities:"1"}],
  positions:[],openOrders:[],indexedOrders:[],...overrides};
}
function tydro(overrides={}){
 return {chainId:57073,address:wallet,updatedAt:stamp,incomplete:false,
  warnings:[],debtBase:"10",healthFactor:"2.1",userReserves:[],...overrides};
}
const sources=(t=tydro(),n=nado())=>({
 wallet,nado:{status:"success",data:n},tydro:{status:"success",data:t},
});
const risk=(hf,now=NOW)=>advanceInTabRiskTimeline(undefined,sources(tydro({healthFactor:hf})),now);
test("complete initial risk observation is not declared financially safe",()=>{
 const result=advanceInTabRiskTimeline(undefined,sources(),NOW);
 assert.equal(result.events.length,1);
 assert.equal(result.events[0].kind,"initial");
 assert.equal(result.events[0].warning,0);
 assert.equal(result.events[0].critical,0);
 assert.equal(result.wallet,wallet);
});
test("same alert IDs and severity do not produce false repeated incidents",()=>{
 const data=sources(tydro({healthFactor:"1.2"}));
 const first=advanceInTabRiskTimeline(undefined,data,NOW);
 const second=advanceInTabRiskTimeline(first,data,NOW+30000);
 assert.strictEqual(first,second);
 assert.equal(second.events.length,1);
 assert.equal(second.events[0].warning,1);
});
test("an escalation is recorded; clean data can then record a recovery",()=>{
 const first=risk("1.2");
 const second=advanceInTabRiskTimeline(first,sources(tydro({healthFactor:"0.8"})),NOW+1000);
 assert.equal(second.events[0].kind,"changed");
 assert.equal(second.events[0].critical,1);
 const third=advanceInTabRiskTimeline(second,sources(),NOW+2000);
 assert.equal(third.events[0].kind,"recovery");
 assert.equal(third.events[0].warning,0);
 assert.equal(third.events.length,3);
});
test("loading cannot clear an earlier warning or log a spurious recovery",()=>{
 const prev=risk("1.2");
 const loading=sources();
 loading.tydro={status:"loading"};
 assert.strictEqual(advanceInTabRiskTimeline(prev,loading,NOW+1000),prev);
});
test("missing and stale feeds do not generate false recovery events",()=>{
 const prev=risk("1.2");
 const stale=sources(tydro({updatedAt:new Date(NOW-190000).toISOString(),healthFactor:"2.2"}));
 const next=advanceInTabRiskTimeline(prev,stale,NOW+1000);
 assert.notEqual(next.events[0].kind,"recovery");
 assert.ok(next.events[0].warning>=1);
 const missing={wallet,nado:{status:"success",data:nado()},tydro:{status:"error"}};
 const last=advanceInTabRiskTimeline(next,missing,NOW+2000);
 assert.notEqual(last.events[0].kind,"recovery");
});
test("incomplete providers and corrupted reserve inventory cannot be recovery",()=>{
 const prior=risk("1.1");
 for(const d of [
  sources(tydro({incomplete:true,healthFactor:"2.2"})),
  sources(tydro({userReserves:[{address:"not-an-address"}],healthFactor:"2.2"})),
  sources(tydro({healthFactor:"2.2"}),nado({positionCoverageComplete:false})),
  sources(tydro({healthFactor:"2.2",address:another})),
 ]){
  const r=advanceInTabRiskTimeline(prior,d,NOW+2000);
  assert.notEqual(r.events[0]?.kind,"recovery");
 }
});
test("wallet switching eliminates the old wallet's timeline immediately",()=>{
 const prior=risk("0.5");
 const newInput={...sources(),wallet:another};
 const result=advanceInTabRiskTimeline(prior,newInput,NOW+3000);
 assert.equal(result.wallet,another);
 assert.equal(result.events.length,1);
 assert.equal(result.events[0].warning,2); // both provider wallet mismatches
 assert.ok(!JSON.stringify(result.events).includes(wallet));
});
test("clear only erases current wallet history; same warning does not reappear",()=>{
 const data=sources(tydro({healthFactor:"0.5"}));
 const result=advanceInTabRiskTimeline(undefined,data,NOW);
 const cleared=clearInTabRiskTimeline(result,wallet);
 assert.equal(cleared.events.length,0);
 assert.equal(advanceInTabRiskTimeline(cleared,data,NOW+1000).events.length,0);
 assert.deepEqual(clearInTabRiskTimeline(result,another),emptyInTabRiskTimeline(another));
});
test("bounded 40 events are tab-only and contain no protocol account values",()=>{
 let current=emptyInTabRiskTimeline(wallet);
 for(let i=0;i<48;i++){
  current=advanceInTabRiskTimeline(current,
   sources(tydro({healthFactor:i%2?"2.0":"0.7",debtBase:"1000000000000000000000",
    collateralBase:"9999999999",rawSecret:"sensitive-fixture"})),NOW+i*1000);
 }
 assert.equal(current.events.length,40);
 const text=JSON.stringify(current.events);
 assert.ok(!text.includes("1000000000000000000000"));
 assert.ok(!text.includes("9999999999"));
 assert.ok(!text.includes("sensitive-fixture"));
 assert.ok(!text.includes(wallet));
});
test("invalid wallet and rollback clock reject unverifiable state",()=>{
 const first=risk("0.8");
 assert.strictEqual(advanceInTabRiskTimeline(first,sources(),NOW-1000),first);
 const invalid=advanceInTabRiskTimeline(first,{...sources(),wallet:"wrong"},NOW+1000);
 assert.deepEqual(invalid,emptyInTabRiskTimeline("wrong"));
});
