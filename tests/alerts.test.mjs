import {test} from "node:test";
import assert from "node:assert/strict";
import {evaluateRiskAlerts} from "../lib/risk/alerts.ts";
const now=Date.parse("2026-10-29T15:00:00Z");
const wallet="0x0000000000000000000000000000000000000001";
function nado(overrides={}){return {chainId:57073,address:wallet,updatedAt:"2026-10-29T14:59:30Z",
  incomplete:false,positionCoverageComplete:true,subaccounts:["main"],subaccountHealth:[
    {subaccount:"main",exists:true,maintenanceHealth:"4",initialHealth:"4",maintenanceAssets:"6",maintenanceLiabilities:"2"}],
  warnings:[],positions:[],openOrders:[],indexedOrders:[],...overrides};}
function tydro(overrides={}){return {chainId:57073,address:wallet,updatedAt:"2026-10-29T14:59:30Z",incomplete:false,warnings:[],healthFactor:"2.3",userReserves:[],...overrides};}
const input=(n=nado(),t=tydro())=>({wallet,nado:{status:"success",data:n},tydro:{status:"success",data:t}});
test("healthy complete feeds yield no alerts",()=>assert.deepEqual(evaluateRiskAlerts(input(),now),[]));
test("Tydro thresholds distinguish liquidation from caution",()=>{
  let alerts=evaluateRiskAlerts(input(nado(),tydro({healthFactor:"0.95"})),now);
  assert.equal(alerts.length,1);assert.equal(alerts[0].level,"critical");
  alerts=evaluateRiskAlerts(input(nado(),tydro({healthFactor:"1.49"})),now);
  assert.equal(alerts[0].level,"warning");
  assert.deepEqual(evaluateRiskAlerts(input(nado(),tydro({healthFactor:null})),now),[]);
});
test("negative or zero Nado maintenance readings alert but keep separate units",()=>{
  let alerts=evaluateRiskAlerts(input(nado({subaccountHealth:[{subaccount:"main",exists:true,maintenanceHealth:"-0.1"}]})),now);
  assert.equal(alerts[0].source,"Nado");assert.equal(alerts[0].level,"critical");
  alerts=evaluateRiskAlerts(input(nado({subaccountHealth:[{subaccount:"main",exists:true,maintenanceHealth:"0"}]})),now);
  assert.equal(alerts[0].level,"warning");
});
test("stale feed produces unknown-data warning, never safe",()=>{
  const alerts=evaluateRiskAlerts(input(nado({updatedAt:"2026-10-29T14:40:00Z"}),tydro({healthFactor:"0.2"})),now);
  assert.ok(alerts.some(a=>a.id==="nado:stale"));
  assert.ok(alerts.some(a=>a.id==="tydro:health"&&a.level==="critical"));
});
test("missing data and bad account identity fail closed",()=>{
  const noData=evaluateRiskAlerts({wallet,nado:{status:"error"},tydro:{status:"loading"}},now);
  assert.equal(noData.length,1);assert.equal(noData[0].id,"nado:unavailable");
  const mismatch=evaluateRiskAlerts(input(nado({address:"0x0000000000000000000000000000000000000002"})),now);
  assert.ok(mismatch.some(a=>a.id==="nado:mismatch"));
});
test("truncated and missing account health cannot claim complete coverage",()=>{
  const alerts=evaluateRiskAlerts(input(nado({incomplete:true,positionCoverageComplete:false,subaccounts:["main","extra"]})),now);
  assert.ok(alerts.some(a=>a.id==="nado:partial"));
  assert.ok(alerts.some(a=>a.id==="nado:missing-health"));
});
test("malformed maintenance health and lending HF produce warnings",()=>{
  const alerts=evaluateRiskAlerts(input(nado({subaccountHealth:[{subaccount:"main",exists:true,maintenanceHealth:"NaN"}]}),tydro({healthFactor:"Infinity"})),now);
  assert.ok(alerts.some(a=>a.id==="nado:unknown:main"));assert.ok(alerts.some(a=>a.id==="tydro:unknown-health"));
});
test("wallet address mismatch from user returns no exposure",()=>{
  assert.deepEqual(evaluateRiskAlerts({...input(),wallet:"garbage"},now),[]);
});
