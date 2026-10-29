import {test} from "node:test";
import assert from "node:assert/strict";
import {assessM8Acceptance} from "../lib/verification/acceptance.ts";
const wallet="0x0000000000000000000000000000000000000001";
const now=Date.parse("2026-10-29T19:30:00Z");
function sample(states={}){
 const ids=["connection","rpc","code","nado","tydro",
  "nado-open-position","nado-position-market",
  "tydro-variable-debt","tydro-independent-pool"];
 return {kind:"manual-public-wallet-inspection",wallet,chainId:57073,
  checkedAt:new Date(now).toISOString(),
  checks:ids.map(id=>({id,state:states[id]??"pass",name:id,detail:"verified public read"})),
  passed:0,failed:0,notTested:0,
  canExecute:false,ownerProved:false,completeRealWalletValidation:false,notes:[]};
}
test("public observations can pass, but can never certify M8 or enable transactions",()=>{
 const r=assessM8Acceptance(sample(),null,now);
 assert.equal(r.gates.find(x=>x.id==="public-data").state,"pass");
 assert.equal(r.gates.find(x=>x.id==="active-perp").state,"pass");
 assert.equal(r.gates.find(x=>x.id==="active-borrow").state,"pass");
 assert.equal(r.gates.find(x=>x.id==="protected-preflight").state,"not-tested");
 assert.equal(r.complete,false);
 assert.equal(r.transactionEnabled,false);
});
test("missing position, missing independent debt check and broken RPC don't pass",()=>{
 const r=assessM8Acceptance(sample({rpc:"fail","nado-open-position":"not-tested",
  "tydro-independent-pool":"not-tested"}),null,now);
 assert.equal(r.gates.find(x=>x.id==="public-data").state,"fail");
 assert.equal(r.gates.find(x=>x.id==="active-perp").state,"not-tested");
 assert.equal(r.gates.find(x=>x.id==="active-borrow").state,"not-tested");
});
test("local wallet ownership needs matching wallet, allowed verification method and nonexpired proof",()=>{
 const valid={wallet,expiresAt:new Date(now+120000).toISOString(),method:"EOA local Ink RPC verification"};
 assert.equal(assessM8Acceptance(sample(),valid,now).gates.find(x=>x.id==="local-wallet-signature").state,"pass");
 for(const invalid of [
  {...valid,wallet:"0x0000000000000000000000000000000000000002"},
  {...valid,expiresAt:new Date(now-1).toISOString()},
  {...valid,expiresAt:new Date(now+300000).toISOString()},
  {...valid,method:"unverified"},
 ]){
  assert.equal(assessM8Acceptance(sample(),invalid,now).gates.find(x=>x.id==="local-wallet-signature").state,"not-tested");
 }
});
test("reports never include secret signatures, token balances or execution approval",()=>{
 const r=assessM8Acceptance(sample(),null,now);
 const exported=JSON.stringify(r);
 assert.equal(exported.includes("nativeBalanceWei"),false);
 assert.equal(exported.includes("signatureBytes"),false);
 assert.equal(exported.includes('"transactionEnabled":false'),true);
});
