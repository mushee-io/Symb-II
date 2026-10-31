import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("signed installer workflow requires manual invocation and protected release environment",()=>{
 const file=read(".github/workflows/desktop-signed-candidate.yml");
 assert.match(file,/workflow_dispatch:/);
 assert.doesNotMatch(file,/\bpush:\s*\n/);
 assert.match(file,/desktop-release/g);
 assert.match(file,/SYMB_II_DESKTOP_SIGNING_APPROVED/);
 assert.match(file,/CSC_LINK/);
 assert.match(file,/CSC_KEY_PASSWORD/);
 assert.match(file,/SYMB_II_WINDOWS_PFX_BASE64/);
 assert.match(file,/SYMB_II_MAC_DEVELOPER_ID_P12_BASE64/);
 assert.match(file,/APPLE_TEAM_ID/);
 assert.match(file,/notarytool submit/);
 assert.match(file,/stapler validate/);
 assert.match(file,/Get-AuthenticodeSignature/);
 assert.match(file,/retention-days: 7/);
 assert.doesNotMatch(file,/gh release create|publish: always|--publish always/);
});
test("unsigned dev workflow cannot silently sign or publish installers",()=>{
 const file=read(".github/workflows/desktop-build.yml");
 assert.match(file,/CSC_IDENTITY_AUTO_DISCOVERY: 'false'/);
 assert.match(file,/--publish never|pack:win/);
 assert.doesNotMatch(file,/signing_approved|DESKTOP_SIGNING_APPROVED/);
});
test("static release barrier is included in the primary CI before typecheck",()=>{
 const file=read(".github/workflows/ci.yml");
 assert.match(file,/node --check scripts\/verify-financial-boundary.mjs/);
 assert.match(file,/node scripts\/verify-financial-boundary.mjs/);
 const protection=file.indexOf("node scripts/verify-financial-boundary.mjs");
 const typecheck=file.indexOf("npm run typecheck");
 assert.ok(protection>0&&protection<typecheck);
});
