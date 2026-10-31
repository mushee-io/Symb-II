import {readFileSync,existsSync} from "node:fs";
import {join} from "node:path";

const root=process.cwd();
const read=path=>readFileSync(join(root,path),"utf8");
const forbidden=[
 /\bwriteContract\s*\(/,
 /\bsendTransaction\s*\(/,
 /\bsignTypedData\s*\(/,
 /\bwalletClient\.sendTransaction\s*\(/,
 /eth_sendTransaction/,
 /eth_signTransaction/,
 /\bsetWindowOpenHandler\s*\([^)]*allow/,
];
const scoped=[
 "app/api/agent/market/route.ts",
 "app/api/tydro/simulate/route.ts",
 "lib/tydro/four-action-simulation.ts",
 "lib/nado/order-limit-policy.ts",
 "lib/execution/agent-policy.ts",
 "components/terminal-ai-explanation.tsx",
 "components/terminal-wallet-pairing.tsx",
 "components/trading-terminal.tsx",
 "desktop/main.cjs",
];
for(const path of scoped){
 if(!existsSync(join(root,path)))throw Error("Security boundary file missing: "+path);
 const source=read(path);
 for(const pattern of forbidden)if(pattern.test(source))throw Error("Forbidden financial operation in "+path+": "+pattern);
}
const desktop=read("desktop/main.cjs");
for(const must of ["sandbox:true","contextIsolation:true","nodeIntegration:false","webviewTag:false","setPermissionRequestHandler","setWindowOpenHandler"]){
 if(!desktop.includes(must))throw Error("Native sandbox invariant missing: "+must);
}
const route=read("app/api/agent/market/route.ts");
for(const must of ["consumeNonce(","isValidSignedChallenge(","acquireLimit(","getNadoCandles(","getNadoPreflightEngineEvidence(","executionEnabled:false"]){
 if(!route.includes(must))throw Error("Protected AI request invariant missing: "+must);
}
if(!read("lib/execution/release-gate.ts").includes("EXECUTION_RELEASE_ENABLED=false"))
 throw Error("Financial execution kill switch is not explicitly disabled");
console.log("PASS: no transaction execution, signing bridge, or unsafe model bypass in scoped desktop agent entrypoints.");
