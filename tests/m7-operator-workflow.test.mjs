import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const wf=readFileSync(".github/workflows/m7-operator-redis-acceptance.yml","utf8");
const verify=readFileSync("scripts/verify-m7-redis.mjs","utf8");

test("M7 private acceptance runs only manually from main in the protected environment",()=>{
 assert.match(wf,/on:\s*\n\s*workflow_dispatch:/);
 assert.match(wf,/if: github\.ref == 'refs\/heads\/main'/);
 assert.match(wf,/environment: production-ops/);
 assert.match(wf,/permissions:\s*\n\s*contents: read/);
 assert.ok(!/\bpush:|\bpull_request:|\bschedule:/.test(wf),
   "Untrusted commits and cron must not access private acceptance credentials.");
});
test("operator secret is environment-injected, never hard-coded or accepted as input",()=>{
 assert.ok(wf.includes("secrets.SYMB_II_CRON_SECRET"));
 assert.ok(wf.includes("persist-credentials: false"));
 assert.ok(wf.includes("npm run verify:m7:redis"));
 assert.ok(!wf.includes("secrets.CRON_SECRET |"));
 assert.ok(!wf.includes("echo $CRON_SECRET"));
 assert.ok(!wf.includes("curl -H"));
});
test("protected verifier checks exact production SHA before using secret",()=>{
 assert.ok(verify.includes("h.payload?.release!==expectedSha.slice(0,12)"));
 assert.ok(verify.includes("r.payload?.release!==expectedSha.slice(0,12)"));
 assert.ok(verify.includes("redirect:\"error\""));
 assert.ok(verify.includes("assessM7RedisActivation("));
 assert.ok(verify.includes("verified wallet")===false);
});
