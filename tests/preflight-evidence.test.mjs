import {test} from "node:test";
import assert from "node:assert/strict";
import {reconcileDebt,blockEvidence,exactPartialDebt} from "../lib/preflight/evidence.ts";

test("converts exact token debt, no floating point rounding",()=>{
 const r=reconcileDebt({rawDebt:1234567890123456789n,displayed:"1.234567890123456789",sourceDecimals:18,reserveDecimals:18,tokenDecimals:18});
 assert.equal(r.matched,true);assert.equal(r.deviation,"0");
 assert.equal(exactPartialDebt(1234567890123456789n,25),308641972530864197n);
});
test("tiny debt rounding never yields an invalid zero repayment",()=>{
 assert.equal(exactPartialDebt(2n,25),null);
 assert.equal(exactPartialDebt(10n,50),5n);
 assert.equal(exactPartialDebt(100n,99),null);
});
test("mismatching token decimals or account balance blocks preflight",()=>{
 const base={rawDebt:100_000_000n,displayed:"100",sourceDecimals:6,reserveDecimals:6,tokenDecimals:6};
 assert.equal(reconcileDebt(base).matched,true);
 assert.equal(reconcileDebt({...base,tokenDecimals:18}).matched,false);
 assert.equal(reconcileDebt({...base,displayed:"99.8"}).matched,false);
 assert.equal(reconcileDebt({...base,displayed:"99.95"}).matched,true);
 assert.equal(reconcileDebt({...base,displayed:"NaN"}).matched,false);
});
test("stable pinned block proof checks hash, time and bounded span",()=>{
 const good={startNumber:100n,endNumber:102n,startHash:"0xabc",recheckHash:"0xabc",startTimestamp:500n,endTimestamp:504n,nowSeconds:510n};
 assert.equal(blockEvidence(good).matched,true);
 assert.equal(blockEvidence({...good,recheckHash:"0xdef"}).matched,false);
 assert.equal(blockEvidence({...good,endNumber:104n}).matched,false);
 assert.equal(blockEvidence({...good,nowSeconds:700n}).matched,false);
 assert.equal(blockEvidence({...good,startTimestamp:null}).matched,false);
});
