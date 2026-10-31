import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("AI market explanation requires explicit one-time signed challenge and rejects execution flags",()=>{
 const ui=read("components/terminal-ai-explanation.tsx");
 assert.match(ui,/signMessageAsync\(\{message\}\)/);
 assert.match(ui,/api\/agent\/challenge/);
 assert.match(ui,/api\/agent\/market/);
 assert.match(ui,/answer\.executionEnabled!==false/);
 assert.match(ui,/chainId===ink\.id/);
 for(const unsafe of [/writeContract\(/,/sendTransaction\(/,/signTypedData\(/,/eth_sendTransaction/])
  assert.doesNotMatch(ui,unsafe);
});
test("desktop wallet uses explicit wagmi connection, not a native signing bridge",()=>{
 const ui=read("components/terminal-wallet-pairing.tsx");
 assert.match(ui,/WalletButton/);
 assert.match(ui,/walletConnectConfigured/);
 assert.match(ui,/classifyWalletConnection/);
 assert.match(ui,/WalletConnect \(mobile \/ QR\)/);
 assert.doesNotMatch(ui,/privateKey|window\.ethereum\.request|sendTransaction\(/);
});
test("a wallet switch or market change invalidates previously shown model narratives",()=>{
 const ui=read("components/terminal-ai-explanation.tsx");
 assert.match(ui,/setResult\(null\)/);
 assert.match(ui,/\[productId,side,notional,leverage,address,chainId\]/);
});
