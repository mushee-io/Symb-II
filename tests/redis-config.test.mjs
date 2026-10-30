import {test} from "node:test";
import assert from "node:assert/strict";
import {validatedUpstashOrigin,hasValidRedisConfiguration} from "../lib/ops/redis-config.ts";
import {describeReadiness} from "../lib/ops/readiness.ts";

test("canonical TLS-only Upstash REST endpoints can be used without exposing credentials",()=>{
 assert.equal(validatedUpstashOrigin("https://symb.redis-123.upstash.io/"),"https://symb.redis-123.upstash.io");
 assert.equal(validatedUpstashOrigin("https://region1.upstash.io"),"https://region1.upstash.io");
 assert.equal(hasValidRedisConfiguration({
  UPSTASH_REDIS_REST_URL:"https://symb.redis-123.upstash.io/",
  UPSTASH_REDIS_REST_TOKEN:"token-is-private",
 }),true);
});
test("URL validation rejects non-TLS, user info, query tokens, fragments, ports, paths and lookalikes",()=>{
 for(const value of [
  "http://app.upstash.io/",
  "https://not-upstash.io/",
  "https://upstash.io/",
  "https://.upstash.io/",
  "https://evil.upstash.io.evil.com/",
  "https://user:pass@symb.upstash.io/",
  "https://symb.upstash.io:8443/",
  "https://symb.upstash.io/redis",
  "https://symb.upstash.io/?token=example",
  "https://symb.upstash.io/#header",
  " https://symb.upstash.io/",
  "https://symb.upstash.io/ ",
  "not-a-url",
  "",
  null,
 ]){
  assert.equal(validatedUpstashOrigin(value),null,String(value));
  const r=describeReadiness({
   UPSTASH_REDIS_REST_URL:value??"",
   UPSTASH_REDIS_REST_TOKEN:"secret-example",
  });
  assert.equal(r.services.find(x=>x.id==="redis").status,"blocked",String(value));
 }
});
test("missing or whitespace-only token cannot enable any Redis-backed feature",()=>{
 for(const token of [undefined,"", "  "]) {
  const env={
   UPSTASH_REDIS_REST_URL:"https://symb.upstash.io/",
   UPSTASH_REDIS_REST_TOKEN:token,
   SYMB_II_WALLET_PROOF_ENABLED:"true",
  };
  assert.equal(hasValidRedisConfiguration(env),false);
  const readiness=describeReadiness(env);
  assert.equal(readiness.services.find(x=>x.id==="redis").status,"blocked");
  assert.equal(readiness.services.find(x=>x.id==="wallet-proof").status,"blocked");
 }
});
