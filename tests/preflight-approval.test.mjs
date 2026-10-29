import {test} from "node:test";
import assert from "node:assert/strict";
import {diagnoseApproval,describeApprovalSimulation,gasBudgetWei} from "../lib/preflight/approval.ts";
test("sufficient exact allowance never requests more approval",()=>{
 const d=diagnoseApproval(100n,150n);
 assert.equal(d.kind,"sufficient");
 assert.equal(d.remaining,50n);
 assert.equal(describeApprovalSimulation({diagnosis:d,directSimulationPassed:null,zeroResetSimulationPassed:null,gasUnits:null}).status,"not-required");
});
test("missing allowance reports the exact atomic difference without creating an approval",()=>{
 const d=diagnoseApproval(100n,25n);
 assert.equal(d.kind,"missing");assert.equal(d.missing,75n);
 const r=describeApprovalSimulation({diagnosis:d,directSimulationPassed:true,zeroResetSimulationPassed:null,gasUnits:45000n});
 assert.equal(r.status,"single-call-simulated");assert.equal(r.gasUnits,45000n);
});
test("non-standard zero-reset token cannot be treated as atomically approved",()=>{
 const d=diagnoseApproval(100n,20n);
 const r=describeApprovalSimulation({diagnosis:d,directSimulationPassed:false,zeroResetSimulationPassed:true,gasUnits:null});
 assert.equal(r.status,"zero-reset-possible");assert.equal(r.gasUnits,null);
});
test("failed or missing approvals fail closed",()=>{
 const missing=diagnoseApproval(100n,null);
 assert.equal(missing.kind,"unknown");
 assert.equal(describeApprovalSimulation({diagnosis:missing,directSimulationPassed:null,zeroResetSimulationPassed:null,gasUnits:null}).status,"unavailable");
 assert.equal(describeApprovalSimulation({diagnosis:diagnoseApproval(100n,1n),directSimulationPassed:false,zeroResetSimulationPassed:false,gasUnits:null}).status,"blocked");
 assert.equal(diagnoseApproval(0n,12n).kind,"invalid");
});
test("fee screening uses 1.5x EIP-1559 maxFeePerGas but rejects missing inputs",()=>{
 assert.equal(gasBudgetWei(100000n,1000000000n),150000000000000n);
 assert.equal(gasBudgetWei(0n,5n),null);
 assert.equal(gasBudgetWei(100n,null),null);
});
