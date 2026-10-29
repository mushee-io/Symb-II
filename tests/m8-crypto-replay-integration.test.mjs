import {test} from "node:test";
import assert from "node:assert/strict";
import {hashMessage,getAddress} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {serverOwnershipMessage} from "../lib/verification/server-policy.ts";
import {verifyOneUseWalletProof} from "../lib/verification/server-flow.ts";
import {isValidSignedChallenge} from "../lib/agent/auth.ts";

/**
 * Uses deterministic TEST-ONLY EOA signing and an atomic in-memory Redis-like
 * GETDEL adapter. Contract wallet and RPC responses are mocked. Never claim
 * that these tests exercised the production Upstash store or real Ink.
 */
const now=Date.parse("2026-10-29T22:45:00.000Z");
const origin="https://symb-ii.vercel.app";
const id="11111111-1111-4111-8111-111111111111";
const signingWallet=privateKeyToAccount("0x"+"6".repeat(64));
const deployedWallet=getAddress("0x00000000000000000000000000000000000000A1");
const block=24680n,blockHash="0x"+"ab".repeat(32);
const issuedAt=new Date(now-15000).toISOString();
const issue=(wallet=signingWallet.address,domain=origin)=>serverOwnershipMessage({
 wallet,id,issuedAt,origin:domain,
});
const eoaRuntime={
 chainId:async()=>57073,
 block:async number=>({number:number??block,hash:blockHash}),
 code:async(_wallet,number)=>{assert.equal(number,block);return "0x";},
 contractSignature:async()=>{throw Error("EOA must not invoke ERC-1271");},
};
const contractRuntime={
 ...eoaRuntime,
 code:async(_wallet,number)=>{assert.equal(number,block);return "0x60016000";},
 contractSignature:async(address,digest,signature,number)=>{
  assert.equal(address,deployedWallet);
  assert.equal(number,block);
  assert.equal(digest,hashMessage(issue(deployedWallet)));
  assert.equal(signature,"0x12345678");
  return "0x1626ba7e";
 },
};
const setup=(wallet,message,runtime,clock=()=>now)=>{
 const persisted=new Map([["m8-"+id,message]]);
 const events={consumed:0,verified:0};
 const deps={
  consumeNonce:async key=>{
   events.consumed++;
   const value=persisted.get(key)??null;
   persisted.delete(key);
   return value;
  },
  verifySignature:async args=>{
   events.verified++;
   return isValidSignedChallenge(args,runtime);
  },
  now:clock,
 };
 return {deps,events,persisted};
};
const input=(wallet,signature,changes={})=>({
 wallet,challengeId:id,signature,origin,now,...changes,
});
test("full proof flow verifies a real cryptographically signed EOA, consuming its nonce exactly once",async()=>{
 const message=issue();
 const signature=await signingWallet.signMessage({message});
 const s=setup(signingWallet.address,message,eoaRuntime);
 const first=await verifyOneUseWalletProof(input(signingWallet.address,signature),s.deps);
 const second=await verifyOneUseWalletProof(input(signingWallet.address,signature),s.deps);
 assert.deepEqual(first,{status:"verified",wallet:signingWallet.address,
  expiresAt:new Date(Date.parse(issuedAt)+120000).toISOString()});
 assert.equal(second.status,"invalid");
 assert.deepEqual(s.events,{consumed:2,verified:1});
 assert.equal(s.persisted.size,0);
 assert.equal(JSON.stringify(first).includes(signature),false);
});
test("cryptographically valid EOA signature for another wallet consumes but never passes",async()=>{
 const message=issue();
 const signature=await signingWallet.signMessage({message});
 const target=getAddress("0x00000000000000000000000000000000000000B1");
 const s=setup(signingWallet.address,message,eoaRuntime);
 const bad=await verifyOneUseWalletProof(input(target,signature),s.deps);
 assert.equal(bad.status,"invalid");
 assert.equal(s.events.verified,0);
 assert.equal(s.persisted.size,0);
});
test("altered EOA signature fails and permanently consumes its originally issued challenge",async()=>{
 const message=issue();
 const signature=await signingWallet.signMessage({message});
 const otherSigner=privateKeyToAccount("0x"+"7".repeat(64));
 const wrongSignature=await otherSigner.signMessage({message});
 const s=setup(signingWallet.address,message,eoaRuntime);
 assert.equal((await verifyOneUseWalletProof(input(signingWallet.address,wrongSignature),s.deps)).status,"invalid");
 assert.equal((await verifyOneUseWalletProof(input(signingWallet.address,signature),s.deps)).status,"invalid");
 assert.equal(s.events.verified,1);
});
test("two concurrent legitimate EOA submissions return no more than one proof",async()=>{
 const message=issue(),signature=await signingWallet.signMessage({message});
 const s=setup(signingWallet.address,message,eoaRuntime);
 const answers=await Promise.all([
  verifyOneUseWalletProof(input(signingWallet.address,signature),s.deps),
  verifyOneUseWalletProof(input(signingWallet.address,signature),s.deps),
 ]);
 assert.deepEqual(answers.map(x=>x.status).sort(),["invalid","verified"]);
 assert.equal(s.events.verified,1);
});
test("contract-wallet flow verifies hash and exact ERC-1271 magic at a single pinned Ink block",async()=>{
 const message=issue(deployedWallet);
 const s=setup(deployedWallet,message,contractRuntime);
 const result=await verifyOneUseWalletProof(input(deployedWallet,"0x12345678"),s.deps);
 assert.equal(result.status,"verified");
 assert.equal(s.events.verified,1);
});
test("mismatched origin or a contract magic failure denies verification",async()=>{
 const message=issue(deployedWallet);
 const originCase=setup(deployedWallet,message,contractRuntime);
 assert.equal((await verifyOneUseWalletProof(
  input(deployedWallet,"0x12345678",{origin:"https://other.example"}),
  originCase.deps)).status,"invalid");
 assert.equal(originCase.events.verified,0);
 const wrongMagic=setup(deployedWallet,message,{
  ...contractRuntime,contractSignature:async()=> "0xffffffff",
 });
 assert.equal((await verifyOneUseWalletProof(
  input(deployedWallet,"0x12345678"),wrongMagic.deps)).status,"invalid");
});
test("slow but valid EOA signature never extends an expired challenge",async()=>{
 const message=issue(),signature=await signingWallet.signMessage({message});
 const expiry=Date.parse(issuedAt)+120000;
 const s=setup(signingWallet.address,message,eoaRuntime,()=>expiry);
 assert.deepEqual(await verifyOneUseWalletProof(
  input(signingWallet.address,signature),s.deps),{status:"invalid"});
 assert.equal(s.events.verified,1);
 assert.equal(s.persisted.size,0);
});
