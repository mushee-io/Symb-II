import {test} from "node:test";
import assert from "node:assert/strict";
import {classifyReleaseDrift} from "../scripts/release-drift-policy.mjs";
const expectedSha="800781b0ab946fac70d8260dded0e1558d88267f";
const liveRelease=expectedSha.slice(0,12);
const nowMs=Date.parse("2026-10-29T21:10:00.000Z");
const base={expectedSha,liveRelease,nowMs,commitTimeMs:nowMs-3600000};
test("latest production release is current regardless of commit age",()=>{
 assert.equal(classifyReleaseDrift(base),"current");
 assert.equal(classifyReleaseDrift({...base,commitTimeMs:nowMs-1000}),"current");
});
test("new main commit has grace period before alerting",()=>{
 const stale="375632573991";
 assert.equal(classifyReleaseDrift({...base,liveRelease:stale,commitTimeMs:nowMs-120000}),"pending");
 assert.equal(classifyReleaseDrift({...base,liveRelease:stale,commitTimeMs:nowMs-1799999}),"pending");
 assert.equal(classifyReleaseDrift({...base,liveRelease:stale,commitTimeMs:nowMs-1800000}),"drift");
});
test("missing or nonsensical revisions cannot clear an existing incident",()=>{
 for(const candidate of [null,"","not-a-sha","0x1234"]){
  assert.equal(classifyReleaseDrift({...base,liveRelease:candidate}),"indeterminate");
 }
 for(const change of [
  {expectedSha:"invalid"},{commitTimeMs:Number.NaN},
  {commitTimeMs:nowMs+60000},{graceMs:-1},
 ]){
  assert.equal(classifyReleaseDrift({...base,...change}),"indeterminate");
 }
});
test("release drift policy requires SHA correspondence, not just similar prefixes",()=>{
 assert.equal(classifyReleaseDrift({...base,liveRelease:"800781b0ab95"}),"drift");
 assert.equal(classifyReleaseDrift({...base,liveRelease:"800781b0ab94"}),"current");
});
