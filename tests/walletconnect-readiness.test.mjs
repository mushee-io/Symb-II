import {test} from "node:test";
import assert from "node:assert/strict";
import {describeReadiness} from "../lib/ops/readiness.ts";

test("WalletConnect is blocked without a real public Project ID but execution is still off",()=>{
 const report=describeReadiness({});
 const gate=report.services.find(x=>x.id==="walletconnect");
 assert.ok(gate);
 assert.equal(gate.status,"blocked");
 assert.equal(gate.verifiedLive,false);
 assert.equal(report.executionEnabled,false);
 assert.ok(gate.issues.join(" ").includes("missing or invalid"));
});
test("valid public WalletConnect identifier permits only configured / untested status",()=>{
 const id="d1".repeat(16);
 const report=describeReadiness({NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:id});
 const gate=report.services.find(x=>x.id==="walletconnect");
 assert.equal(gate?.status,"configured");
 assert.equal(gate?.verifiedLive,false);
 assert.equal(report.executionEnabled,false);
 assert.equal(JSON.stringify(report).includes(id),false);
});
