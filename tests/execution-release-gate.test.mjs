import {test} from "node:test";
import assert from "node:assert/strict";
import {EXECUTION_RELEASE_ENABLED,describeExecutionRelease} from "../lib/execution/release-gate.ts";
test("no checklist supplied by a caller can unlock financial execution",()=>{
 assert.equal(EXECUTION_RELEASE_ENABLED,false);
 const all={
  externalAuditAccepted:true,criticalFindingsResolved:true,
  realWalletE2EAccepted:true,revocationVerified:true,
  perVenueSimulationAccepted:true,legalComplianceReviewed:true,
 };
 for(const input of [{},all,{...all,externalAuditAccepted:false}]){
  const output=describeExecutionRelease(input);
  assert.equal(output.executionEnabled,false);
  assert.equal(output.releaseState,"blocked");
  assert.equal(output.independentlyAudited,false);
  assert.equal(output.requirements.length,6);
  assert.ok(output.requirements.every(gate=>gate.verifiedLive===false));
 }
});
