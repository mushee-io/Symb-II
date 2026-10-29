import {test} from "node:test";
import assert from "node:assert/strict";
import {buildReadOnlyBrief,classifyBriefIntent,INTENTS} from "../lib/agent/brief.ts";
const wallet="0x0000000000000000000000000000000000000001";
const now=Date.parse("2026-10-29T15:00:00Z");
const n={chainId:57073,address:wallet,updatedAt:"2026-10-29T14:59:50Z",positions:[
  {symbol:"ETH-PERP",side:"long",size:"2",marginMode:"cross",subaccount:"main"}],
  subaccounts:["main"],positionCoverageComplete:true,incomplete:false,openOrders:[],indexedOrders:[],warnings:[],
  subaccountHealth:[{subaccount:"main",exists:true,maintenanceHealth:"-0.01"}]};
const t={chainId:57073,address:wallet,updatedAt:"2026-10-29T14:59:50Z",incomplete:false,warnings:[],
  healthFactor:"1.4",collateralBase:"2400",debtBase:"1000",userReserves:[
  {symbol:"WETH",supplied:"1",variableDebt:"0",stableDebt:"0"}]};
const args={wallet,now,nado:{status:"success",data:n},tydro:{status:"success",data:t}};
test("guided intents have five available read-only tasks",()=>assert.equal(INTENTS.length,5));
test("intent parsing refuses transactional instructions",()=>{
  assert.equal(classifyBriefIntent("buy ETH using my margin"),null);
  assert.equal(classifyBriefIntent("show my Nado positions"),"nado");
  assert.equal(classifyBriefIntent("what is my health factor?"),"risk");
  assert.equal(classifyBriefIntent("make a safe transfer"),null);
});
test("overview is sourced and never merges protocol collateral",()=>{
  const r=buildReadOnlyBrief({...args,intent:"overview"});
  assert.equal(r.complete,true);assert.equal(r.canTrade,false);
  assert.equal(r.sources.length,2);
  assert.ok(r.lines.some(s=>s.includes("separate margin/collateral")));
  assert.equal(r.generatedBy,"deterministic-read-only-rules");
});
test("risk brief displays verified critical margin and warning lending",()=>{
  const r=buildReadOnlyBrief({...args,intent:"risk"});
  assert.ok(r.lines.some(s=>s.includes("Nado")&&s.includes("critical")));
  assert.ok(r.lines.some(s=>s.includes("Tydro")&&s.includes("warning")));
});
test("foreign wallet data is withheld and fail-closed",()=>{
  const r=buildReadOnlyBrief({...args,intent:"nado",nado:{status:"success",data:{...n,address:"0x0000000000000000000000000000000000000002"}}});
  assert.equal(r.complete,false);
  assert.ok(r.limitations.some(x=>x.includes("Nado")));
  assert.equal(r.lines.some(x=>x.includes("ETH-PERP")),false);
});
test("stale snapshots cannot be presented as current",()=>{
  const r=buildReadOnlyBrief({...args,intent:"tydro",tydro:{status:"success",data:{...t,updatedAt:"2026-10-29T14:30:00Z"}}});
  assert.equal(r.complete,false);assert.equal(r.lines.some(x=>x.includes("2400")),false);
});
test("read-only next steps never instruct autonomous transaction",()=>{
  const r=buildReadOnlyBrief({...args,intent:"next-steps"});
  assert.equal(r.canTrade,false);
  assert.ok(r.lines.some(x=>x.includes("No trade or borrowing action")));
});
