import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Windows-only internal NSIS build refuses publication and code-signing shortcuts",()=>{
 const workflow=read(".github/workflows/desktop-build.yml");
 assert.match(workflow,/runs-on: windows-latest/);
 assert.match(workflow,/npm run pack:win/);
 assert.match(workflow,/CSC_IDENTITY_AUTO_DISCOVERY: 'false'/);
 assert.match(workflow,/verify-windows-candidate\.ps1/);
 assert.match(workflow,/SHA256SUMS\.txt/);
 assert.match(workflow,/windows-candidate\.json/);
 assert.match(workflow,/retention-days: 7/);
 assert.doesNotMatch(workflow,/macos-latest|ubuntu-latest|--publish always|gh release create|publish: always/);
 assert.doesNotMatch(workflow,/CSC_LINK:|CSC_KEY_PASSWORD:/);
});

test("Windows package is explicitly per-user, non-elevated, predictable and ASAR-wrapped",()=>{
 const p=JSON.parse(read("desktop/package.json"));
 assert.equal(p.build.win.requestedExecutionLevel,"asInvoker");
 assert.match(p.build.win.artifactName,/^Symb-II-Setup-/);
 assert.equal(p.build.nsis.perMachine,false);
 assert.equal(p.build.nsis.allowElevation,false);
 assert.equal(p.build.nsis.oneClick,false);
 assert.equal(p.build.asar,true);
 assert.ok(p.build.files.includes("offline.html"));
 assert.ok(p.scripts["pack:win"].includes("--publish never"));
});

test("native Windows host remains sandboxed and cannot open remote downloads",()=>{
 const shell=read("desktop/main.cjs");
 for(const guard of [
   "sandbox:true","contextIsolation:true","nodeIntegration:false","webSecurity:true",
   "webviewTag:false","setPermissionRequestHandler","setPermissionCheckHandler",
   "setWindowOpenHandler","will-navigate","will-redirect","will-download",
   "OFFLINE_PAGE","loadFile(OFFLINE_PAGE)"
 ]){
  assert.ok(shell.includes(guard),"Missing Electron boundary: "+guard);
 }
 for(const danger of ["ipcMain","shell.openExternal","webContents.executeJavaScript",
    "privateKeyToAccount","sendTransaction","writeContract","signTypedData"]){
  assert.ok(!shell.includes(danger),"Unsafe API unexpectedly present: "+danger);
 }
});
test("offline screen is static, cannot expose fake quote or credential form, and retries canonical TLS URL",()=>{
 const html=read("desktop/offline.html");
 assert.match(html,/Content-Security-Policy/);
 assert.match(html,/default-src 'none'/);
 assert.match(html,/https:\/\/symb-ii\.vercel\.app\/workspace\/terminal/);
 assert.match(html,/No offline market quotes/);
 assert.doesNotMatch(html,/<script|<form|localStorage|sessionStorage|<input/i);
});

test("Windows artifact verification pins executable header, signature status and integrity hash",()=>{
 const verifier=read("desktop/verify-windows-candidate.ps1");
 for(const rule of ["Symb-II-Setup-*.exe","app.asar","Get-AuthenticodeSignature",
  "NotSigned","Get-FileHash -Algorithm SHA256","windows-candidate.json",
  "SHA256SUMS.txt","realWindowsDeviceAccepted = $false",
  "executionEnabled = $false","safeToDistributePublicly = $false"]){
  assert.ok(verifier.includes(rule),"Missing release integrity check: "+rule);
 }
});
