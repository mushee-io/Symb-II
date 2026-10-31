import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseWatchOnlyAddress} from "../lib/wallet/watch-only.ts";
const address="0x1234567890123456789012345678901234567890";

test("watch-only accepts a public EVM address, returns checksum, rejects secrets and invalid inputs",()=>{
 const result=parseWatchOnlyAddress(address);
 assert.equal(result?.toLowerCase(),address.toLowerCase());
 for(const invalid of [
  undefined,null,"",42,address+" ",address+"\n",
  "0x"+"0".repeat(40),"0x"+"1".repeat(63),
  "not-a-wallet","seed phrase","0xzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
 ])assert.equal(parseWatchOnlyAddress(invalid),null,String(invalid));
});
test("desktop public watch never claims wallet possession, signs, persists or broadcasts",()=>{
 const watch=readFileSync(new URL("../components/terminal-wallet-pairing.tsx",import.meta.url),"utf8");
 const desk=readFileSync(new URL("../components/terminal-account-desk.tsx",import.meta.url),"utf8");
 assert.match(watch,/parseWatchOnlyAddress/);
 assert.match(watch,/Watch public address/);
 assert.match(watch,/onWatchAddress/);
 assert.match(desk,/watchAddress/);
 assert.match(desk,/Watch-only/);
 for(const unsafe of [/localStorage/,/sessionStorage/,/document\.cookie/,/signMessage\(/,/sendTransaction\(/,/writeContract\(/,/signTypedData\(/]){
  assert.doesNotMatch(watch,unsafe);
  assert.doesNotMatch(desk,unsafe);
 }
});
