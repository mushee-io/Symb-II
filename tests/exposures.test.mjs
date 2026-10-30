import {test} from "node:test";
import assert from "node:assert/strict";
import {buildExposureInventory} from "../lib/risk/exposures.ts";
import {TYDRO} from "../lib/tydro/contracts.ts";

const now=Date.parse("2026-10-30T20:20:00.000Z");
const current=new Date(now-10000).toISOString();
const wallet="0x0000000000000000000000000000000000000001";
const position=(id,productId,symbol,side,size)=>({
 id,productId,symbol,side,size,subaccount:"default",
 marginMode:"cross",entryPrice:"2500",openedAt:null,updatedAt:null,
});
const health=()=>({subaccount:"default",exists:true,maintenanceHealth:"100",
 initialHealth:"200",maintenanceAssets:"400",maintenanceLiabilities:"100"});
function nado(extra={}){
 return {address:wallet,chainId:57073,updatedAt:current,
  incomplete:false,positionCoverageComplete:true,warnings:[],
  subaccounts:["default"],subaccountHealth:[health()],
  positions:[position("one",4,"ETH-PERP","long","2"),
   position("two",8,"SOL-PERP","short","3")],
  openOrders:[],indexedOrders:[],...extra};
}
const reserve=(address,symbol,supplied,variableDebt,stableDebt="0")=>({
 address,symbol,supplied,variableDebt,stableDebt,
 decimals:6,liquidationThresholdBps:8000,usingAsCollateral:true,
 oraclePriceRaw:"100000000",
});
function tydro(extra={}){
 return {address:wallet,chainId:57073,updatedAt:current,pool:TYDRO.pool,
  incomplete:false,warnings:[],userReserves:[
   reserve("0x0000000000000000000000000000000000000002","WETH","0.01","0"),
   reserve("0x0000000000000000000000000000000000000003","USDC","0","400"),
  ],...extra};
}
const inventory=(n=nado(),t=tydro(),clock=now)=>buildExposureInventory(n,t,clock);

test("complete current per-protocol inventory keeps native assets and no fabricated USD total",()=>{
 const r=inventory();
 assert.equal(r.complete,true);
 assert.equal(r.nadoPositions,2);
 assert.equal(r.tydroSuppliedAssets,1);
 assert.equal(r.tydroBorrowedAssets,1);
 assert.equal(r.rows.length,4);
 assert.equal(r.rows[0].units,"base position");
 assert.equal(r.rows[2].protocol,"Tydro");
 assert.equal(r.rows[3].amount,"400");
 assert.equal(r.rows.some(row=>"usdValue" in row),false);
});
test("mismatched wallet, malformed address or chain withholds all exposure rows",()=>{
 for(const [n,t] of [
  [nado(),tydro({address:"0x0000000000000000000000000000000000000004"})],
  [nado({chainId:1}),tydro()],
  [nado(),tydro({chainId:1})],
  [nado({address:"not-wallet"}),tydro()],
  [nado(),tydro({pool:"0x0000000000000000000000000000000000000004"})],
 ]){
  const r=inventory(n,t);
  assert.equal(r.complete,false);
  assert.equal(r.rows.length,0);
  assert.equal(r.nadoPositions,0);
 }
});
test("partial coverage remains flagged even when reported rows are well-formed",()=>{
 const r=inventory(nado({incomplete:true}),tydro({warnings:["oracle incomplete"]}));
 assert.equal(r.complete,false);
 assert.equal(r.warnings.length,2);
 assert.equal(r.rows.length,4);
 const positionsUnknown=inventory(nado({positionCoverageComplete:false}),tydro());
 assert.equal(positionsUnknown.complete,false);
 assert.ok(positionsUnknown.warnings.some(w=>w.includes("Nado")));
});
test("empty current complete accounts do not invent positions or borrow balances",()=>{
 const r=inventory(nado({positions:[]}),tydro({userReserves:[
  reserve("0x0000000000000000000000000000000000000002","WETH","0","0"),
 ]}));
 assert.equal(r.complete,true);
 assert.equal(r.rows.length,0);
 assert.equal(r.tydroBorrowedAssets,0);
});
test("expired, future or skewed independent snapshots cannot be presented as zero exposure",()=>{
 for(const [na,ta,clock] of [
  [new Date(now-180001).toISOString(),current,now],
  [current,new Date(now-180001).toISOString(),now],
  [new Date(now+6000).toISOString(),current,now],
  [current,new Date(now+6000).toISOString(),now],
  [new Date(now-85000).toISOString(),current,now],
  [current,new Date(now-85000).toISOString(),now],
  [current,current,Number.NaN],
 ]){
  const r=inventory(nado({updatedAt:na}),tydro({updatedAt:ta}),clock);
  assert.equal(r.complete,false);
  assert.equal(r.rows.length,0);
  assert.ok(r.warnings.length>0);
 }
 const close=inventory(nado({updatedAt:new Date(now-55000).toISOString()}),tydro());
 assert.equal(close.complete,true);
});
test("invalid Nado positions, duplicate IDs, unknown subaccounts and invalid prices withhold all rows",()=>{
 const base=nado().positions[0];
 const bad=[
  {...base,size:"NaN"},{...base,size:"-1"},{...base,entryPrice:"0"},
  {...base,symbol:"Product #4"},{...base,side:"close"},
  {...base,marginMode:"isolated"},{...base,subaccount:"another"},
  {...base,productId:-1},
 ];
 for(const p of bad){
  const r=inventory(nado({positions:[p]}),tydro());
  assert.equal(r.complete,false,JSON.stringify(p));
  assert.equal(r.rows.length,0);
 }
 const duplicate=inventory(nado({positions:[base,base]}),tydro());
 assert.equal(duplicate.complete,false);
 assert.equal(duplicate.rows.length,0);
});
test("duplicate or malformed Tydro reserves are withheld, not double counted",()=>{
 const original=tydro().userReserves[0];
 for(const rows of [
  [original,{...original,address:original.address.toUpperCase().replace("0X","0x")}],
  [{...original,supplied:"NaN"}],
  [{...original,variableDebt:"-50"}],
  [{...original,decimals:37}],
  [{...original,address:"not-an-asset"}],
 ]){
  const r=inventory(nado(),tydro({userReserves:rows}));
  assert.equal(r.complete,false);
  assert.equal(r.rows.length,0);
 }
});
test("missing, duplicate or non-existing Nado subaccount health cannot claim complete coverage",()=>{
 for(const healthRows of [
  [],[health(),health()],
  [{...health(),exists:false}],
  [{...health(),subaccount:"unrelated"}],
  [{...health(),maintenanceHealth:"NaN"}],
  [{...health(),maintenanceAssets:"-5"}],
 ]){
  const r=inventory(nado({subaccountHealth:healthRows}),tydro());
  assert.equal(r.complete,false);
  assert.ok(r.warnings.some(w=>w.includes("health")));
 }
});
test("count each Tydro borrowing asset once even when both variable and stable debts are positive",()=>{
 const row=reserve("0x0000000000000000000000000000000000000003","USDC","0","40","20");
 const r=inventory(nado({positions:[]}),tydro({userReserves:[row]}));
 assert.equal(r.tydroBorrowedAssets,1);
 assert.equal(r.rows.filter(row=>row.kind.includes("debt")).length,2);
 assert.equal(r.complete,true);
});
test("more than 60 display rows is clearly marked truncated and never complete",()=>{
 const positions=Array.from({length:61},(_,i)=>position(
  "leg-"+i,i+1,"TICKER-"+i+"-PERP","long","2"
 ));
 const r=inventory(nado({positions}),tydro({userReserves:[]}));
 assert.equal(r.complete,false);
 assert.equal(r.rows.length,60);
 assert.equal(r.nadoPositions,61);
 assert.ok(r.warnings.some(w=>w.includes("truncated")));
});
