import { test } from "node:test";
import assert from "node:assert/strict";
import { buildExposureInventory } from "../lib/risk/exposures.ts";

function nado(extra={}){return {address:"0x0000000000000000000000000000000000000001",chainId:57073,incomplete:false,warnings:[],positions:[
  {id:"one",productId:4,symbol:"ETH-PERP",side:"long",size:"2",subaccount:"default"},
  {id:"two",productId:8,symbol:"SOL-PERP",side:"short",size:"3",subaccount:"default"}
],...extra};}
function tydro(extra={}){return {address:"0x0000000000000000000000000000000000000001",chainId:57073,incomplete:false,warnings:[],userReserves:[
  {address:"0x0000000000000000000000000000000000000002",symbol:"WETH",supplied:"0.01",variableDebt:"0",stableDebt:"0"},
  {address:"0x0000000000000000000000000000000000000003",symbol:"USDC",supplied:"0",variableDebt:"400",stableDebt:"0"}
],...extra};}

test("inventory preserves protocol identity and native token units",()=>{
  const r=buildExposureInventory(nado(),tydro());
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
test("mismatched wallet or chain never merges account records",()=>{
  const r=buildExposureInventory(nado(),tydro({address:"0x0000000000000000000000000000000000000004"}));
  assert.equal(r.complete,false);
  assert.equal(r.rows.length,0);
  const c=buildExposureInventory(nado({chainId:1}),tydro());
  assert.equal(c.rows.length,0);
});
test("partial source is reported and cannot claim completeness",()=>{
  const r=buildExposureInventory(nado({incomplete:true}),tydro({warnings:["oracle incomplete"]}));
  assert.equal(r.complete,false);
  assert.equal(r.warnings.length,2);
});
test("zero and missing balances do not invent positions",()=>{
  const r=buildExposureInventory(nado({positions:[]}),tydro({userReserves:[{address:"0x0",symbol:"WETH",supplied:"0",variableDebt:"0",stableDebt:"0"}]}));
  assert.equal(r.rows.length,0);
});
