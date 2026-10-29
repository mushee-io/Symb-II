import {test} from "node:test";
import assert from "node:assert/strict";
import {privateKeyToAccount} from "viem/accounts";
import {isValidSignedChallenge as verifySignedChallenge} from "../lib/agent/auth.ts";
import {
  isProposalsConfigured,parseReviewRequest,packetFromScenario,
  reviewSignatureMessage,packetValidForAcknowledgement,PROPOSAL_TTL_MS,
} from "../lib/proposals/policy.ts";
// Unit tests use a deterministic Ink EOA-state fixture. No public RPC is needed.
const authRuntime={
 chainId:async()=>57073,
 block:async number=>({number:number??123456n,hash:"0x"+"ab".repeat(32)}),
 code:async(_wallet,number)=>{assert.equal(number,123456n);return "0x";},
 contractSignature:async()=>"0xffffffff",
};
const isValidSignedChallenge=(args)=>verifySignedChallenge(args,authRuntime);
const signer=privateKeyToAccount("0x"+"2".repeat(64));
const another=privateKeyToAccount("0x"+"3".repeat(64));
const now=Date.parse("2026-10-29T16:30:00Z");
const id="550e8400-e29b-41d4-a716-446655440000";
const request={wallet:signer.address,action:"nado-reduction-review",positionKey:"main:4:leg-1",shockPct:-20,reductionPct:50};
const result={ok:true,protocol:"Nado",kind:"position-reduction",symbol:"ETH-PERP",quote:"USDT0",
 shockPct:-20,reductionPct:50,originalPositionSensitivity:"-1000.00000000",
 remainingPositionSensitivity:"-500.00000000",originalSize:"2",remainingSize:"1",
 snapshotAt:new Date(now-1000).toISOString(),assumptions:["Only the reviewed ticker is shocked."]};
const packet=()=>packetFromScenario({request,result,id,now});
test("proposal intent parser only accepts explicit, bounded read-only scope",()=>{
 assert.deepEqual(parseReviewRequest(request),request);
 assert.equal(parseReviewRequest({...request,action:"execute"}),null);
 assert.equal(parseReviewRequest({...request,shockPct:100}),null);
 assert.equal(parseReviewRequest({...request,repaymentPct:50}),null);
 assert.equal(parseReviewRequest({...request,positionKey:"evil\napprove-all"}),null);
 assert.deepEqual(parseReviewRequest({wallet:signer.address,action:"tydro-debt-review",repaymentPct:25}),{
   wallet:signer.address,action:"tydro-debt-review",repaymentPct:25,
 });
 assert.equal(parseReviewRequest({wallet:signer.address,action:"tydro-debt-review",repaymentPct:100}),null);
});
test("packets have server-pinned values, expiry and no execution target",()=>{
 const p=packet();assert.ok(p);
 assert.equal(p.action,"nado-reduction-review");
 assert.equal(p.protocol,"Nado");
 assert.equal(p.chainId,57073);
 assert.equal(p.executable,false);
 assert.equal(p.calldata,null);
 assert.equal(p.targetContract,null);
 assert.equal(p.expiresAt,new Date(now+PROPOSAL_TTL_MS).toISOString());
 assert.equal(packetValidForAcknowledgement(p,signer.address,now+50_000),true);
 assert.equal(packetValidForAcknowledgement(p,signer.address,now+PROPOSAL_TTL_MS),false);
});
test("digest binds entire exact packet including wallet, age, amounts and assumptions",()=>{
 const p=packet();
 assert.equal(packetValidForAcknowledgement({...p,wallet:another.address},signer.address,now),false);
 assert.equal(packetValidForAcknowledgement({...p,scenario:{...p.scenario,after:"500"}},signer.address,now),false);
 assert.equal(packetValidForAcknowledgement({...p,executable:true},signer.address,now),false);
 assert.equal(packetValidForAcknowledgement({...p,chainId:1},signer.address,now),false);
 assert.equal(packetValidForAcknowledgement(p,another.address,now),false);
});
test("wallet signature is tied to proposal digest, origin and non-execution disclaimer",async()=>{
 const p=packet(),message=reviewSignatureMessage(p,"https://symb-ii.vercel.app");
 assert.match(message,/REVIEW ACKNOWLEDGEMENT ONLY/);
 assert.match(message,/NOT consent to trade/);
 assert.match(message,/Ink Chain ID: 57073/);
 const sig=await signer.signMessage({message});
 assert.equal(await isValidSignedChallenge({
   wallet:signer.address,challenge:message,expectedMessage:message,signature:sig
 }),true);
 assert.equal(await isValidSignedChallenge({
   wallet:signer.address,challenge:message,expectedMessage:message.replace(p.digest,"0x"+"0".repeat(64)),signature:sig
 }),false);
 const other=reviewSignatureMessage(p,"https://unrelated.example");
 assert.equal(await isValidSignedChallenge({
   wallet:signer.address,challenge:other,expectedMessage:other,signature:sig
 }),false);
});
test("cross-protocol results or stale data cannot be packaged as current",()=>{
 const t={ok:true,protocol:"Tydro",kind:"proportional-debt-reduction",repaymentPct:25,
   currentHealthFactor:"1.1",estimatedHealthFactor:"1.466667",currentRisk:"caution",estimatedRisk:"caution",
   snapshotAt:new Date(now-1000).toISOString(),assumptions:[]};
 assert.equal(packetFromScenario({request,result:t,id,now}),null);
 assert.equal(packetFromScenario({request,result:{...result,snapshotAt:new Date(now-400000).toISOString()},id,now}),null);
 const tyReq={wallet:signer.address,action:"tydro-debt-review",repaymentPct:25};
 const packetT=packetFromScenario({request:tyReq,result:t,id,now});
 assert.ok(packetT);
 assert.equal(packetT.protocol,"Tydro");
 assert.equal(packetT.scenario.units,"Tydro health-factor multiple");
});
test("server receipt feature defaults to disabled unless explicit opt-in and store",()=>{
 const env={SYMB_II_PROPOSALS_ENABLED:"true",UPSTASH_REDIS_REST_URL:"https://example.upstash.io",UPSTASH_REDIS_REST_TOKEN:"abc"};
 assert.equal(isProposalsConfigured(env),true);
 assert.equal(isProposalsConfigured({...env,SYMB_II_PROPOSALS_ENABLED:"false"}),false);
 assert.equal(isProposalsConfigured({...env,UPSTASH_REDIS_REST_TOKEN:""}),false);
});
