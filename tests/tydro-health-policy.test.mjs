import {test} from "node:test";
import assert from "node:assert/strict";
import {observeTydroHealth} from "../lib/tydro/health-policy.ts";
const value=(debtBase,healthFactor,incomplete=false,warnings=[])=>observeTydroHealth({debtBase,healthFactor,incomplete,warnings});
test("no-debt only when account evidence is complete AND debt is exactly zero",()=>{
 assert.equal(value("0",null).state,"no-debt");
 assert.equal(value("0.00",null).state,"no-debt");
 for(const debt of ["1","0.000001","NaN",undefined,"-1","99999999999999999999999"])
  assert.notEqual(value(debt,null).state,"no-debt",String(debt));
});
test("missing, invalid, stale/partial health evidence must never be labelled safe",()=>{
 for(const args of [
  ["1",null],["2","NaN"],["0","1.4"],["2","Infinity"],["2","0"],["-1","2"],["2","-4"],
 ]){
  assert.equal(value(args[0],args[1]).state,"unknown",JSON.stringify(args));
 }
 assert.equal(value("0",null,true).state,"unknown");
 assert.equal(value("0",null,false,["oracle missing"]).state,"unknown");
});
test("observed health factor gives a risk label, never an approval",()=>{
 assert.equal(value("2","0.75").state,"critical");
 assert.equal(value("2","1.2").state,"elevated");
 assert.equal(value("2","2").state,"observed");
 assert.match(value("2","2").label,/Observed/);
});
