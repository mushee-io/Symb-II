import {test} from "node:test";
import assert from "node:assert/strict";
import {AI_DEFAULT_MODEL,gatewayModel,isAIConfigured} from "../lib/agent/generation-policy.ts";
test("Gateway model must have validated provider/model syntax",()=>{
 assert.equal(gatewayModel({}),AI_DEFAULT_MODEL);
 assert.equal(gatewayModel({SYMB_II_AI_MODEL:"openai/gpt-5.6-luna"}),"openai/gpt-5.6-luna");
 assert.equal(gatewayModel({SYMB_II_AI_MODEL:"../../some-target"}),null);
 assert.equal(gatewayModel({SYMB_II_AI_MODEL:"no-prefix"}),null);
});
test("AI cannot activate without authenticated model, security store and explicit feature flag",()=>{
 const env={SYMB_II_AI_ENABLED:"true",AI_GATEWAY_API_KEY:"fake",UPSTASH_REDIS_REST_URL:"https://unit.upstash.io",UPSTASH_REDIS_REST_TOKEN:"fake"};
 assert.equal(isAIConfigured({...env,SYMB_II_AI_MODEL:"broken"}),false);
 assert.equal(isAIConfigured({...env,SYMB_II_AI_ENABLED:"false"}),false);
 assert.equal(isAIConfigured({...env,UPSTASH_REDIS_REST_URL:"https://malicious.example"}),false);
 assert.equal(isAIConfigured(env),true);
});
