import {test} from "node:test";
import assert from "node:assert/strict";
import {crosscheckNadoPositions} from "../lib/verification/nado-positions.ts";
const now=Date.parse("2026-10-29T20:00:00Z");
const updatedAt=new Date(now-1000).toISOString();
const position={id:"id-1",subaccount:"main",productId:3,symbol:"ETH-PERP",side:"long",
 marginMode:"cross",size:"2000000000000000000",entryPrice:"2400",openedAt:null,updatedAt:null};
const account=()=>({
 source:"Nado engine + indexer",address:"0x0000000000000000000000000000000000000001",chainId:57073,updatedAt,
 subaccounts:["main"],positions:[position],subaccountHealth:[{subaccount:"main",exists:true,
 maintenanceHealth:"100",initialHealth:"100",maintenanceAssets:"200",maintenanceLiabilities:"100"}],
 openOrders:[],indexedOrders:[],warnings:[],incomplete:false,positionCoverageComplete:true
});
const market=()=>({source:"Nado indexer",chainId:57073,updatedAt,markets:[
 {productId:3,symbol:"ETH-PERP",type:"perp",base:"ETH",quote:"USD",lastPrice:2500,change24h:1,volume24h:100}
]});
test("independent market read must resolve every active perp product",()=>{
 const v=crosscheckNadoPositions(account(),market(),now);
 assert.equal(v.state,"pass");assert.equal(v.comparedPositions,1);
 assert.equal(JSON.stringify(v).includes("2000000000000000000"),false);
});
test("missing, duplicate, spot or bad ticker cannot validate an open position",()=>{
 assert.equal(crosscheckNadoPositions(account(),{...market(),markets:[]},now).state,"fail");
 assert.equal(crosscheckNadoPositions(account(),{...market(),markets:[market().markets[0],market().markets[0]]},now).state,"fail");
 assert.equal(crosscheckNadoPositions(account(),{...market(),markets:[{...market().markets[0],type:"spot"}]},now).state,"fail");
 assert.equal(crosscheckNadoPositions(account(),{...market(),markets:[{...market().markets[0],lastPrice:0}]},now).state,"fail");
});
test("invalid subaccount health, missing owner inventory and duplicate positions fail closed",()=>{
 assert.equal(crosscheckNadoPositions({...account(),subaccountHealth:[]},market(),now).state,"fail");
 assert.equal(crosscheckNadoPositions({...account(),subaccounts:["other"]},market(),now).state,"fail");
 assert.equal(crosscheckNadoPositions({...account(),positions:[position,position]},market(),now).state,"fail");
 assert.equal(crosscheckNadoPositions({...account(),positions:[{...position,size:"-1"}]},market(),now).state,"fail");
});
test("empty or partial wallet inventory is not mistaken for a fully validated trade",()=>{
 assert.equal(crosscheckNadoPositions({...account(),positions:[]},market(),now).state,"not-tested");
 assert.equal(crosscheckNadoPositions({...account(),incomplete:true},market(),now).state,"not-tested");
 assert.equal(crosscheckNadoPositions(account(),undefined,now).state,"not-tested");
});
test("wrong-chain and stale read-only snapshots fail",()=>{
 assert.equal(crosscheckNadoPositions(account(),{...market(),chainId:1},now).state,"fail");
 assert.equal(crosscheckNadoPositions(account(),market(),now+600000).state,"fail");
});

test("a shared product ID is insufficient when engine and ticker symbols disagree",()=>{
 const misleading={...market(),markets:[{...market().markets[0],symbol:"BTC-PERP"}]};
 assert.equal(crosscheckNadoPositions(account(),misleading,now).state,"fail");
 assert.equal(crosscheckNadoPositions({...account(),positions:[
  {...position,symbol:"Product #3"}
 ]},market(),now).state,"fail");
 assert.equal(crosscheckNadoPositions({...account(),positions:[
  {...position,symbol:"ETH-PERP-FAKE"}
 ]},market(),now).state,"fail");
 // Normalisation permits harmless differences in ASCII letter casing.
 const normalised={...account(),positions:[{...position,symbol:" eth-perp "}]};
 assert.equal(crosscheckNadoPositions(normalised,market(),now).state,"pass");
});
test("active Nado positions require a positive finite entry price",()=>{
 for(const entryPrice of ["0","-1","Infinity","NaN","not a price","","1e99999"]){
  const forged={...account(),positions:[{...position,entryPrice}]};
  assert.equal(crosscheckNadoPositions(forged,market(),now).state,"fail",entryPrice);
 }
 assert.equal(crosscheckNadoPositions({...account(),positions:[
  {...position,entryPrice:"2.4e3"}
 ]},market(),now).state,"pass");
});
test("subaccount health exists=true is not adequate without finite assets, liabilities and health",()=>{
 for(const key of ["maintenanceHealth","initialHealth","maintenanceAssets","maintenanceLiabilities"]){
  for(const bad of ["NaN","Infinity","not a number",""]){
   const health={...account().subaccountHealth[0],[key]:bad};
   assert.equal(crosscheckNadoPositions({...account(),subaccountHealth:[health]},market(),now).state,"fail",key+" "+bad);
  }
 }
 for(const key of ["maintenanceAssets","maintenanceLiabilities"]){
  const health={...account().subaccountHealth[0],[key]:"-1"};
  assert.equal(crosscheckNadoPositions({...account(),subaccountHealth:[health]},market(),now).state,"fail",key);
 }
 // Underwater portfolios can legitimately have negative maintenance health.
 const underwater={...account().subaccountHealth[0],
  maintenanceHealth:"-50",initialHealth:"-90"};
 assert.equal(crosscheckNadoPositions({...account(),subaccountHealth:[underwater]},market(),now).state,"pass");
});
test("a fabricated healthy record for an unrelated subaccount cannot validate a position",()=>{
 const healthy={...account().subaccountHealth[0],subaccount:"other"};
 assert.equal(crosscheckNadoPositions({...account(),subaccountHealth:[healthy]},market(),now).state,"fail");
});
