import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validWalletConnectProjectId,classifyWalletConnection} from "../lib/wallet/connect-policy.ts";

const id="a3f47ce90b126bd84ea6c3d12b34af09";
const wallet="0x0000000000000000000000000000000000000001";

test("only a real-form public 32-hex project ID enables WalletConnect",()=>{
 assert.equal(validWalletConnectProjectId(id),true);
 assert.equal(validWalletConnectProjectId(id.toUpperCase()),true);
 for(const invalid of [undefined,null,"",123,"YOUR_PROJECT_ID","WC_PROJECT_ID",
  "not configured","0".repeat(32),"a".repeat(31),"a".repeat(33),id+" ",
  " https://cloud.reown.com","0x"+id,{}]){
   assert.equal(validWalletConnectProjectId(invalid),false,String(invalid));
 }
});
test("wallet connection classification fails closed on disconnect, invalid wallet and wrong chain",()=>{
 assert.equal(classifyWalletConnection({isConnected:false,address:wallet,chainId:57073}),"disconnected");
 assert.equal(classifyWalletConnection({isConnected:true,address:undefined,chainId:57073}),"invalid-wallet");
 assert.equal(classifyWalletConnection({isConnected:true,address:"not-wallet",chainId:57073}),"invalid-wallet");
 assert.equal(classifyWalletConnection({isConnected:true,address:wallet,chainId:1}),"wrong-network");
 assert.equal(classifyWalletConnection({isConnected:true,address:wallet,chainId:undefined}),"wrong-network");
 assert.equal(classifyWalletConnection({isConnected:true,address:wallet,chainId:57073}),"read-only");
});
test("public connection setup is optional, Ink-only and cannot silently choose a connector",()=>{
 const config=readFileSync(new URL("../lib/wagmi.ts",import.meta.url),"utf8");
 const ui=readFileSync(new URL("../components/wallet-button.tsx",import.meta.url),"utf8");
 const env=readFileSync(new URL("../.env.example",import.meta.url),"utf8");
 assert.match(config,/validWalletConnectProjectId\(projectId\)/);
 assert.match(config,/from "@walletconnect\/wagmi-connector"/);
 assert.match(config,/walletConnectConfigured&&projectId/);
 assert.match(config,/chains:\[ink\]/);
 assert.match(config,/showQrModal:true/);
 assert.match(ui,/connect\(\{connector\}\)/);
 assert.doesNotMatch(ui,/connectors\[0\]/);
 assert.match(ui,/classifyWalletConnection/);
 assert.match(ui,/walletConnectConfigured/);
 assert.match(env,/NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=/);
 for(const unsafe of [/writeContract\(/,/sendTransaction\(/,/signTypedData\(/]){
  assert.doesNotMatch(ui,unsafe);
  assert.doesNotMatch(config,unsafe);
 }
});
