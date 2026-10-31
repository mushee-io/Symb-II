import {test} from "node:test";
import assert from "node:assert/strict";
import {reviewNadoReduceOnlyLimit} from "../lib/nado/order-limit-policy.ts";
const now=Date.parse("2026-10-31T11:15:00Z");
const wallet="0x3f90f099af21b96b4e58b36f630bc88326417de2";
const engine={
 observedAt:new Date(now-3000).toISOString(),engineChainId:57073,
 engineEndpoint:"0x0000000000000000000000000000000000000009",
 productId:3,productType:"perp",oraclePrice:"100",priceIncrement:"0.1",
 sizeIncrement:"0.01",minSize:"0.01",bid:"99.9",ask:"100.1",warnings:[],
};
const reduction={
 checked:true,requestedPercent:25,currentPositionSize:"1",floorToIncrement:"0.25",
 minimumSize:"0.01",engineMaxReduceOnly:"0.5",side:"short",priceReference:"99.9",
 sizeIncrement:"0.01",feasibleBySize:true,reason:"reference only",warnings:["Reference only."],
};
const args={wallet,sourceWallet:wallet,productId:3,positionSide:"long",
 engine,reduction,limitPrice:"99.9",maxSlippageBps:25,now};
test("Nado indicative price review NEVER authorizes order submission",()=>{
 const r=reviewNadoReduceOnlyLimit(args);
 assert.equal(r.passesIndicativeBounds,true);
 assert.equal(r.canSubmit,false);
 assert.equal(r.executionEnabled,false);
 assert.equal(r.orderPayload,null);
 assert.equal(r.orderSide,"short");
});
test("wrong wallet, product, chain, stale price and spoofed order side are rejected",()=>{
 const bad=[
 {sourceWallet:"0x000000000000000000000000000000000000dEaD"},
 {productId:4},
 {engine:{...engine,engineChainId:1}},
 {engine:{...engine,observedAt:new Date(now-16000).toISOString()}},
 {engine:{...engine,warnings:["incomplete"]}},
 {reduction:{...reduction,side:"long"}},
 {reduction:{...reduction,feasibleBySize:false}},
 ];
 for(const patch of bad){
  const r=reviewNadoReduceOnlyLimit({...args,...patch});
  assert.equal(r.passesIndicativeBounds,false,JSON.stringify(patch));
  assert.equal(r.canSubmit,false);
 }
});
test("rejects excess slippage, off-tick pricing, too-large size and crossed books",()=>{
 const bad=[
 {limitPrice:"98.0"},
 {limitPrice:"99.95"},
 {maxSlippageBps:101},
 {reduction:{...reduction,floorToIncrement:"0.6"}},
 {engine:{...engine,bid:"101",ask:"100"}},
 {engine:{...engine,bid:"90",ask:"110"}},
 ];
 for(const patch of bad){
  const r=reviewNadoReduceOnlyLimit({...args,...patch});
  assert.equal(r.passesIndicativeBounds,false,JSON.stringify(patch));
 }
});
test("short position requires opposing buy side within ask-bound slippage",()=>{
 const buy={...args,positionSide:"short",reduction:{...reduction,side:"long"},
  limitPrice:"100.1"};
 assert.equal(reviewNadoReduceOnlyLimit(buy).passesIndicativeBounds,true);
 assert.equal(reviewNadoReduceOnlyLimit({...buy,limitPrice:"101.0"}).passesIndicativeBounds,false);
});
