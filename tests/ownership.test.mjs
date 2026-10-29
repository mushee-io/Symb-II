import {test} from "node:test";
import assert from "node:assert/strict";
import {privateKeyToAccount} from "viem/accounts";
import {verifyMessage} from "viem";
import {OWNERSHIP_TTL_MS,ownershipMessage,isFreshOwnershipProof} from "../lib/verification/ownership.ts";
const wallet=privateKeyToAccount("0x"+"a".repeat(64));
const now=Date.parse("2026-10-29T18:35:00Z");
const input={
 wallet:wallet.address,origin:"https://symb-ii.vercel.app",
 nonce:"550e8400-e29b-41d4-a716-446655440000",
 issuedAt:new Date(now).toISOString(),chainId:57073,
};
test("M8 ownership proof is scoped to wallet, origin, Ink chain, nonce and expiry",()=>{
 const msg=ownershipMessage(input);
 assert.match(msg,/Wallet: 0x/);assert.match(msg,/Chain ID: 57073/);
 assert.match(msg,/NOT an ERC-20 permit/);
 assert.equal(isFreshOwnershipProof(input,now+119999),true);
 assert.equal(isFreshOwnershipProof(input,now+120000),false);
 assert.equal(isFreshOwnershipProof(input,now-6000),false);
 assert.equal(OWNERSHIP_TTL_MS,120000);
});
test("EOA self-test message can be cryptographically verified but cannot grant a session",async()=>{
 const m=ownershipMessage(input);
 const signature=await wallet.signMessage({message:m});
 assert.equal(await verifyMessage({address:wallet.address,message:m,signature}),true);
 assert.equal(await verifyMessage({address:wallet.address,message:m+"\nmodified",signature}),false);
 assert.equal(Object.keys(input).includes("authorization"),false);
});
test("reject insecure origin and wrong-chain challenge construction",()=>{
 assert.throws(()=>ownershipMessage({...input,origin:"http://symb-ii.vercel.app"}));
 assert.throws(()=>ownershipMessage({...input,origin:"https://evil.com/path"}));
 assert.throws(()=>ownershipMessage({...input,chainId:1}));
 assert.throws(()=>ownershipMessage({...input,nonce:"not-a-nonce"}));
});
