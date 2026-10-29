import {test} from "node:test";
import assert from "node:assert/strict";
import {hashMessage,getAddress} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {isAcceptableSignature,isValidSignedChallenge} from "../lib/agent/auth.ts";
const signer=privateKeyToAccount("0x"+"5".repeat(64));
const wallet=getAddress("0x00000000000000000000000000000000000000A1");
const message="Symb-II | read-only one-use review | Ink chain ID: 57073";
const eoaRuntime={
 chainId:async()=>57073,
 code:async()=>"0x",
 contractSignature:async()=>"0xffffffff",
};
const deployedRuntime=(answer="0x1626ba7e")=>({
 chainId:async()=>57073,
 code:async()=>"0x60016000",
 contractSignature:async(address,digest,sig)=>{
   assert.equal(address,wallet);
   assert.equal(digest,hashMessage(message));
   assert.equal(sig,"0x12345678");
   return answer;
 },
});
test("an ordinary EOA signature is validated on Ink before accepting",async()=>{
 const signature=await signer.signMessage({message});
 assert.equal(await isValidSignedChallenge({wallet:signer.address,challenge:message,expectedMessage:message,signature},eoaRuntime),true);
 assert.equal(await isValidSignedChallenge({wallet:wallet,challenge:message,expectedMessage:message,signature},eoaRuntime),false);
});
test("deployed contract wallet uses EIP-1271 exact magic and message hash",async()=>{
 const args={wallet,challenge:message,expectedMessage:message,signature:"0x12345678"};
 assert.equal(await isValidSignedChallenge(args,deployedRuntime()),true);
 assert.equal(await isValidSignedChallenge(args,deployedRuntime("0xffffffff")),false);
 assert.equal(await isValidSignedChallenge({...args,challenge:message+" altered"},deployedRuntime()),false);
});
test("wrong Ink chain and failed or missing contract lookup are always denied",async()=>{
 const args={wallet,challenge:message,expectedMessage:message,signature:"0x12345678"};
 assert.equal(await isValidSignedChallenge(args,{...deployedRuntime(),chainId:async()=>1}),false);
 assert.equal(await isValidSignedChallenge(args,{...deployedRuntime(),code:async()=>undefined}),false);
 assert.equal(await isValidSignedChallenge(args,{...deployedRuntime(),code:async()=>{throw Error("RPC failure");}}),false);
 assert.equal(await isValidSignedChallenge(args,{...deployedRuntime(),contractSignature:async()=>{throw Error("revert");}}),false);
});
test("undeployed smart-wallet signatures are explicitly refused instead of guessed",async()=>{
 const args={wallet,challenge:message,expectedMessage:message,signature:"0x12345678"};
 assert.equal(await isValidSignedChallenge(args,eoaRuntime),false);
});
test("size and encoding guards accept reasonable multisig and EOA payloads only",()=>{
 assert.equal(isAcceptableSignature("0x"+"12".repeat(65)),true);
 assert.equal(isAcceptableSignature("0x"+"12".repeat(300)),true);
 assert.equal(isAcceptableSignature("0x"+"12".repeat(769)),false);
 assert.equal(isAcceptableSignature("0x1"),false);
 assert.equal(isAcceptableSignature("0xzz"),false);
 assert.equal(isAcceptableSignature({}),false);
});
test("deployed contract cannot authenticate with only a recovered EOA key",async()=>{
 const signature=await signer.signMessage({message});
 const r={
  chainId:async()=>57073,
  code:async()=>"0x60016000",
  contractSignature:async()=>"0xffffffff",
 };
 assert.equal(await isValidSignedChallenge({wallet:signer.address,challenge:message,expectedMessage:message,signature},r),false);
});
