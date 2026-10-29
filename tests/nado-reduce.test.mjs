import {test} from "node:test";
import assert from "node:assert/strict";
import {assessReductionSize} from "../lib/preflight/nado-reduce.ts";
const now=Date.parse("2026-10-29T17:30:00Z");
const observation=()=>({
  observedAt:new Date(now-2000).toISOString(),walletSubaccountMatched:true,
  engineMaxSize:"900000000000000000",priceReference:"2500",orderSide:"short",warning:null,
});
const check=(override={})=>assessReductionSize({
 positionSize:"2000000000000000000",positionSide:"long",
 minSize:"100000000000000000",sizeIncrement:"100000000000000000",
 percent:25,observation:observation(),now,...override
});
test("long reduction queries short side and floors to SDK-native increments",()=>{
 const x=check();
 assert.equal(x.checked,true);assert.equal(x.feasibleBySize,true);
 assert.equal(x.floorToIncrement,"500000000000000000");
 assert.equal(x.side,"short");
});
test("short reduction must query long-side engine max, not arbitrary side",()=>{
 assert.equal(check({positionSide:"short"}).feasibleBySize,false);
 const ok=check({positionSide:"short",observation:{...observation(),orderSide:"long"}});
 assert.equal(ok.feasibleBySize,true);
});
test("size reduction never rounds above the user-selected fraction",()=>{
 const x=check({percent:25,positionSize:"2300000000000000000"});
 assert.equal(x.floorToIncrement,"500000000000000000");
 assert.equal(x.feasibleBySize,true);
});
test("no remaining subaccount ownership yields no size-feasibility claim",()=>{
 const x=check({observation:{...observation(),walletSubaccountMatched:false}});
 assert.equal(x.checked,false);assert.equal(x.floorToIncrement,null);
});
test("engine cap, minimum and increment guard against false feasible assertions",()=>{
 assert.equal(check({observation:{...observation(),engineMaxSize:"400000000000000000"}}).feasibleBySize,false);
 assert.equal(check({minSize:"700000000000000000"}).feasibleBySize,false);
 assert.equal(check({sizeIncrement:"10000000000000000000"}).feasibleBySize,false);
 assert.equal(check({sizeIncrement:"0"}).feasibleBySize,false);
});
test("stale/invalid/wrong-side/missing engine results fail closed",()=>{
 assert.equal(check({now:now+100000}).feasibleBySize,false);
 assert.equal(check({observation:{...observation(),orderSide:"long"}}).feasibleBySize,false);
 assert.equal(check({observation:{...observation(),priceReference:"NaN"}}).feasibleBySize,false);
 assert.equal(check({observation:{...observation(),engineMaxSize:null}}).feasibleBySize,false);
 assert.equal(check({percent:100}).feasibleBySize,false);
});
test("tiny hypothetical reduction never rounds to zero order or fabricates execution",()=>{
 const x=check({positionSize:"100000000000000000",percent:10});
 assert.equal(x.feasibleBySize,false);assert.equal(x.floorToIncrement,null);
 assert.equal(Object.hasOwn(x,"calldata"),false);
});
