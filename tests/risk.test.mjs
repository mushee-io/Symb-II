import { test } from "node:test";
import assert from "node:assert/strict";
import { tydroRiskState, nadoRiskState } from "../lib/risk/status.ts";

test("Tydro no-debt status requires independently observed zero Pool debt",()=>{
 assert.equal(tydroRiskState(null),"unknown");
 assert.equal(tydroRiskState(null,"25"),"unknown");
 assert.equal(tydroRiskState(null,"NaN"),"unknown");
 assert.equal(tydroRiskState(null,"0"),"no-exposure");
 assert.equal(tydroRiskState(null,"0.000000"),"no-exposure");
 assert.equal(tydroRiskState("2","0"),"unknown");
});
test("Tydro HF categorization still follows protocol threshold with actual debt",()=>{
 for(const [hf,state] of [
  ["0","urgent"],["0.99999","urgent"],["1","caution"],
  ["1.49999","caution"],["1.5","above-warning-level"],["2.7","above-warning-level"],
 ]){
  assert.equal(tydroRiskState(hf,"100"),state);
 }
});
test("Malformed Tydro health and debt inputs are unknown, not safe",()=>{
 for(const value of ["","NaN","Infinity","-1","not-a-number"])
  assert.equal(tydroRiskState(value,"100"),"unknown");
 for(const value of ["","NaN","Infinity","-1","not-a-number"])
  assert.equal(tydroRiskState("3",value),"unknown");
});
test("Nado health uses signed maintenance buffer, not Tydro HF cutoffs",()=>{
 assert.equal(nadoRiskState(null),"unknown");
 assert.equal(nadoRiskState("-0.0001"),"urgent");
 assert.equal(nadoRiskState("0"),"caution");
 assert.equal(nadoRiskState("0.01"),"above-warning-level");
 assert.equal(nadoRiskState("1.0"),"above-warning-level");
 assert.equal(nadoRiskState("NaN"),"unknown");
 assert.equal(nadoRiskState("0",false),"no-exposure");
});
