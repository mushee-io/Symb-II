import {test} from "node:test";
import assert from "node:assert/strict";
import {summariseProbes} from "../lib/ops/probe-summary.ts";
const checks=(states)=>Object.entries(states).map(([id,state])=>({id,state,detail:"observation"}));
test("healthy public providers allow missing, not-configured Redis without claiming Redis active",()=>{
 const s=summariseProbes(checks({redis:"not-configured","redis-services":"not-configured",rpc:"pass",nado:"pass",tydro:"pass"}));
 assert.equal(s.healthy,true);assert.deepEqual(s.unconfigured,["redis","redis-services"]);
});
test("provider failures fail a protected heartbeat and cannot become HTTP 200",()=>{
 for(const id of ["rpc","nado","tydro","redis","redis-services"]){
   const values={redis:"pass","redis-services":"pass",rpc:"pass",nado:"pass",tydro:"pass"};
   values[id]="fail";assert.equal(summariseProbes(checks(values)).healthy,false);
 }
});
test("required provider omitted or unknown remains unhealthy",()=>{
 assert.equal(summariseProbes(checks({redis:"not-configured","redis-services":"not-configured",rpc:"pass",nado:"pass"})).healthy,false);
 assert.equal(summariseProbes(checks({redis:"pass","redis-services":"pass",rpc:"not-configured",nado:"pass",tydro:"pass"})).healthy,false);
});

test("an omitted Redis diagnostic is not a healthy protected probe",()=>{
 const s=summariseProbes(checks({rpc:"pass",nado:"pass",tydro:"pass"}));
 assert.equal(s.healthy,false);
 assert.ok(s.requiredFailures.includes("redis"));
});

test("a passing Redis nonce drill without the separate receipt/watch drill is unhealthy",()=>{
 const signals=checks({redis:"pass","redis-services":"not-configured",rpc:"pass",nado:"pass",tydro:"pass"});
 const result=summariseProbes(signals);
 assert.equal(result.healthy,false);
 assert.ok(result.requiredFailures.includes("redis-services"));
});
