import {test} from "node:test";
import assert from "node:assert/strict";
import {privateKeyToAccount} from "viem/accounts";
import {createChallenge,isValidSignedChallenge} from "../lib/agent/auth.ts";
import {allowedIntent,isAIConfigured,buildModelInput,validateNarrative} from "../lib/agent/generation-policy.ts";

const signer=privateKeyToAccount("0x"+"1".repeat(64));
const nonce="550e8400-e29b-41d4-a716-446655440000";
const message=createChallenge({address:signer.address,id:nonce,issuedAt:"2026-10-29T15:00:00Z",origin:"https://symb-ii.vercel.app"});

test("read-only wallet message binds domain, chain and purpose",()=>{
  assert.match(message,/Chain ID: 57073/);assert.match(message,/Domain: symb-ii.vercel.app/);
  assert.match(message,/No transaction, token approval/);
});
test("EOA wallet signature proves one request message; altered message or wallet fails",async()=>{
  const signature=await signer.signMessage({message});
  assert.equal(await isValidSignedChallenge({wallet:signer.address,challenge:message,expectedMessage:message,signature}),true);
  assert.equal(await isValidSignedChallenge({wallet:signer.address,challenge:message+" changed",expectedMessage:message,signature}),false);
  assert.equal(await isValidSignedChallenge({wallet:"0x0000000000000000000000000000000000000002",challenge:message,expectedMessage:message,signature}),false);
});
test("AI configured only with all required server-side switches and credentials",()=>{
  const env={SYMB_II_AI_ENABLED:"true",AI_GATEWAY_API_KEY:"x",UPSTASH_REDIS_REST_URL:"https://sample.upstash.io/",UPSTASH_REDIS_REST_TOKEN:"y"};
  assert.equal(isAIConfigured(env),true);
  assert.equal(isAIConfigured({...env,AI_GATEWAY_API_KEY:""}),false);
  assert.equal(isAIConfigured({...env,SYMB_II_AI_ENABLED:"false"}),false);
});
test("transaction prompts and client intent overrides are refused",()=>{
  assert.equal(allowedIntent("buy ETH now","overview"),null);
  assert.equal(allowedIntent("What are my risk warnings?","overview"),null);
  assert.equal(allowedIntent("What are my risk warnings?","risk"),"risk");
  assert.equal(allowedIntent("Explain my Tydro debt","tydro"),"tydro");
  assert.equal(allowedIntent("a".repeat(301),"overview"),null);
});
test("model sees bounded verified facts with no wallet signing tools",()=>{
  const briefing={intent:"risk",title:"Risk",lines:["Tydro health 1.4"],limitations:[],sources:["Tydro Pool"],generatedBy:"deterministic-read-only-rules",canTrade:false,complete:true};
  const input=buildModelInput(briefing);
  assert.match(input.system,/never/i);
  assert.match(input.prompt,/"canTrade":false/);
  assert.match(input.prompt,/"toolsAvailable":\[\]/);
  assert.equal(validateNarrative("  Hello world, a read-only explanation. "), "Hello world, a read-only explanation.");
  assert.equal(validateNarrative(""),null);
  assert.equal(validateNarrative("z".repeat(2000)),null);
});
