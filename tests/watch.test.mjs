import {test} from "node:test";
import assert from "node:assert/strict";
import {watchChallengeMessage,validActionMessage,isWatchConfigured,createWatchEvent,isWatchAction} from "../lib/watch/policy.ts";
const wallet="0x00000000000000000000000000000000000000aB";
const origin="https://symb-ii.vercel.app";
const id="550e8400-e29b-41d4-a716-446655440000";
const make=action=>watchChallengeMessage({address:wallet,action,id,origin,issuedAt:"2026-10-29T14:00:00Z"});

test("a watch signature is scoped to wallet, origin, chain and exact action",()=>{
  const subscribe=make("subscribe");
  assert.ok(validActionMessage(subscribe,"subscribe",wallet,origin));
  assert.equal(validActionMessage(subscribe,"unsubscribe",wallet,origin),false);
  assert.equal(validActionMessage(subscribe,"status","0x0000000000000000000000000000000000000002",origin),false);
  assert.equal(validActionMessage(subscribe,"subscribe",wallet,"https://another-app.example"),false);
  assert.match(subscribe,/not a trade, transfer/);
});
test("watch actions fail closed on unexpected values",()=>{
  assert.equal(isWatchAction("subscribe"),true);
  assert.equal(isWatchAction("delete-everything"),false);
  assert.throws(()=>make("swap"));
});
test("watch configuration needs Redis, explicit enablement and long secret",()=>{
  const valid={SYMB_II_WATCH_ENABLED:"true",UPSTASH_REDIS_REST_URL:"https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN:"token",CRON_SECRET:"a".repeat(24)};
  assert.equal(isWatchConfigured(valid),true);
  assert.equal(isWatchConfigured({...valid,CRON_SECRET:"1234"}),false);
  assert.equal(isWatchConfigured({...valid,SYMB_II_WATCH_ENABLED:"false"}),false);
});
const alert={id:"tydro:health",source:"Tydro",level:"critical",title:"Liquidation vulnerability",detail:"Never save this account detail.",observedAt:"2026-10-29T14:00:00Z"};
test("first snapshot stores minimal titles, not secret or raw positions",()=>{
  const {fingerprint,event}=createWatchEvent([alert],null,"2026-10-29T14:00:00Z");
  assert.equal(event?.kind,"initial");
  assert.equal(event?.critical,1);
  assert.equal(event?.details[0].title,alert.title);
  assert.equal(JSON.stringify(event).includes(alert.detail),false);
  assert.equal(createWatchEvent([alert],fingerprint,"2026-10-29T15:00:00Z").event,null);
});
test("changes and recovery create distinct persistent events",()=>{
  const first=createWatchEvent([alert],null,"2026-10-29T14:00:00Z");
  const recovered=createWatchEvent([],first.fingerprint,"2026-10-29T15:00:00Z");
  assert.equal(recovered.event?.kind,"recovery");
  assert.equal(recovered.event?.critical,0);
  assert.equal(createWatchEvent([],recovered.fingerprint,"2026-10-29T16:00:00Z").event,null);
});
