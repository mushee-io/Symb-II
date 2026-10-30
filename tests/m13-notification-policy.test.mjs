import {test} from "node:test";
import assert from "node:assert/strict";
import {
 validNotificationConsent,notificationWalletHash,
 planRiskNotification,publicDeliveryConfiguration,
} from "../lib/notifications/policy.ts";
import {decisionForDelivery,settleDeliveryAttempt} from "../lib/notifications/queue-policy.ts";
import {enqueueRiskNotification,processRiskNotification} from "../lib/notifications/delivery-ports.ts";

const NOW=Date.parse("2026-10-30T20:00:00.000Z");
const iso=n=>new Date(n).toISOString();
const wallet="0x0000000000000000000000000000000000000001";
const other="0x0000000000000000000000000000000000000002";
const proof="550e8400-e29b-41d4-a716-446655440000";
const subscriptionId="550e8400-e29b-41d4-a716-446655440001";
const recipientRef="rcpt_"+"a".repeat(24);
const consent=(o={})=>({
 version:1,purpose:"risk-notifications",chainId:57073,
 wallet,channel:"email",recipientRef,subscriptionId,oneUseProofId:proof,
 authorizedAt:iso(NOW-3_600_000),recipientVerifiedAt:iso(NOW-1_800_000),
 expiresAt:iso(NOW+30*86_400_000),revokedAt:null,...o,
});
const risk=(o={})=>({
 at:iso(NOW-60_000),kind:"alert-change",critical:1,warning:0,
 details:[{source:"Tydro",level:"critical",id:"tydro:health",
   title:"Liquidation vulnerability",detail:"Do not store this balance."}],...o,
});
const prepared=(c=consent(),e=risk(),w=wallet,now=NOW)=>
 planRiskNotification({wallet:w,consent:c,event:e,now});
function job(){
 const p=prepared();
 assert.equal(p.kind,"enqueue");
 return p.job;
}
function mockStore(initial=consent()){
 let trusted=initial,saved=null,claimed=0,reads=0,insertions=0;
 const dedupe=new Set();
 return {
  get snapshot(){return {saved,claimed,reads,insertions};},
  setConsent(v){trusted=v;},
  async getTrustedConsent(){reads++;return trusted;},
  async enqueueOnce(j){if(dedupe.has(j.dedupeKey))return false;dedupe.add(j.dedupeKey);saved=j;insertions++;return true;},
  async claim(){claimed++;return "lease-token";},
  async settle(_,__,updated){saved=updated;return true;},
 };
}
test("public M13 config explicitly disables outbound sending and trading",()=>{
 const c=publicDeliveryConfiguration();
 for(const field of ["deliveryEnabled","notificationsDelivered","providerConfigured",
  "verifiedConsentStore","externalDeliveryVerified","executionEnabled"])
  assert.equal(c[field],false);
});
test("monitoring consent alone, missing recipient verification and wrong chain are blocked",()=>{
 assert.equal(validNotificationConsent(consent(),NOW),true);
 for(const c of [null,{}, {action:"subscribe",wallet},
  consent({purpose:"monitoring"}),consent({chainId:1}),
  consent({recipientVerifiedAt:null}),consent({recipientRef:"user@example.com"}),
  consent({recipientRef:"https://push.example/endpoint"}),
  consent({subscriptionId:"bad"}),consent({oneUseProofId:"bad"}),
  consent({authorizedAt:iso(NOW-91*86_400_000)}),
  consent({authorizedAt:iso(NOW+60_000)}),
  consent({expiresAt:iso(NOW-1000)}),
  consent({expiresAt:iso(NOW+100*86_400_000)}),
  consent({revokedAt:iso(NOW)})]){
  assert.equal(prepared(c).kind,"blocked");
 }
 assert.equal(prepared(consent({wallet:other})).kind,"blocked");
});
test("only fresh, bounded and consistent warning events enqueue; recovery is suppressed",()=>{
 assert.equal(prepared().kind,"enqueue");
 assert.equal(prepared(consent(),risk({kind:"recovery",critical:0,details:[]})).kind,"suppressed");
 for(const e of [
  risk({at:iso(NOW-20*60_000)}),risk({at:iso(NOW+60_000)}),
  risk({kind:"other"}),risk({critical:0}),
  risk({details:[...risk().details,risk().details[0]]}),
  risk({details:[{...risk().details[0],id:"bad\nheader"}]}),
  risk({details:[{...risk().details[0],level:"info"}],critical:0}),
 ]){
  assert.equal(prepared(consent(),e).kind,"blocked",JSON.stringify(e).slice(0,160));
 }
});
test("queue payloads hold only opaque destination references, never wallet or amounts",()=>{
 const p=prepared();assert.equal(p.kind,"enqueue");
 assert.equal(p.dedupeTtlSeconds,1800);
 assert.match(p.job.id,/^[a-f0-9]{64}$/);
 assert.match(p.job.walletHash,/^[a-f0-9]{64}$/);
 const text=JSON.stringify(p.job);
 for(const forbidden of [wallet,"user@example.com","https://push.example",
  "Do not store this balance.","Liquidation vulnerability"]){
  assert.equal(text.includes(forbidden),false);
 }
});
test("deduplication is stable per warning state and isolated by channel",()=>{
 const first=prepared(),again=prepared(consent(),risk({at:iso(NOW-30_000)}));
 assert.equal(first.job.dedupeKey,again.job.dedupeKey);
 assert.notEqual(first.job.id,again.job.id);
 assert.notEqual(first.job.dedupeKey,prepared(consent({channel:"web-push"})).job.dedupeKey);
 assert.notEqual(notificationWalletHash(wallet),notificationWalletHash(other));
});
test("delivery requires current consent and respects delay, TTL and revocation",()=>{
 const j=job();
 assert.equal(decisionForDelivery(j,consent(),NOW).kind,"send");
 assert.equal(decisionForDelivery(j,null,NOW).kind,"cancel");
 assert.equal(decisionForDelivery(j,consent({wallet:other}),NOW).kind,"cancel");
 assert.equal(decisionForDelivery(j,consent({revokedAt:iso(NOW)}),NOW).kind,"cancel");
 assert.equal(decisionForDelivery(j,consent(),NOW+86_400_000).kind,"cancel");
 const retry=settleDeliveryAttempt(j,{kind:"unknown"},NOW);
 assert.equal(retry.state,"queued");
 assert.equal(retry.nextAttemptAt,iso(NOW+60_000));
 assert.equal(decisionForDelivery(retry,consent(),NOW+1).kind,"hold");
 assert.equal(decisionForDelivery(retry,consent(),NOW+60_000).kind,"send");
});
test("finite retry backoff dead-letters after fifth unsuccessful send",()=>{
 let j=job(),now=NOW;
 for(const [i,delta] of [60_000,300_000,900_000,3_600_000,0].entries()){
  j=settleDeliveryAttempt(j,{kind:"temporary-failure"},now);
  assert.equal(j.attempts,i+1);
  if(i<4){now+=delta;assert.equal(j.state,"queued");assert.equal(j.nextAttemptAt,iso(now));}
  else assert.equal(j.state,"dead-letter");
 }
});
test("provider acceptance is not delivery confirmation and invalid receipts retry",()=>{
 const j=job();
 assert.equal(settleDeliveryAttempt(j,{kind:"accepted",receiptRef:"receipt_"+"a".repeat(16)},NOW).state,"accepted");
 assert.equal(settleDeliveryAttempt(j,{kind:"accepted",receiptRef:"bad"},NOW).state,"queued");
 assert.equal(settleDeliveryAttempt(j,{kind:"permanent-failure"},NOW).state,"dead-letter");
});
test("disabled integration never touches storage, recipient or transport",async()=>{
 const store=mockStore(),transport={send:async()=>{throw Error("unexpected send");}};
 assert.equal(await enqueueRiskNotification({enabled:false,store,wallet,
  subscriptionId,event:risk(),now:NOW}),"disabled");
 assert.equal(await processRiskNotification({enabled:false,store,transport,job:job(),now:NOW}),"disabled");
 assert.equal(store.snapshot.reads,0);assert.equal(store.snapshot.claimed,0);
});
test("queue requires atomic dedupe and a currently valid trusted consent record",async()=>{
 const store=mockStore(),x={enabled:true,store,wallet,subscriptionId,event:risk(),now:NOW};
 assert.equal(await enqueueRiskNotification(x),"queued");
 assert.equal(await enqueueRiskNotification(x),"duplicate");
 assert.equal(store.snapshot.insertions,1);
 store.setConsent(consent({revokedAt:iso(NOW)}));
 assert.equal(await enqueueRiskNotification(x),"blocked");
});
test("worker always rereads consent after claim; revoked users cannot be sent to",async()=>{
 const store=mockStore(consent({revokedAt:iso(NOW)}));
 let count=0;
 const transport={send:async()=>{count++;return {kind:"accepted",receiptRef:"receipt_"+"b".repeat(16)};}};
 assert.equal(await processRiskNotification({enabled:true,store,transport,job:job(),now:NOW}),"cancelled");
 assert.equal(store.snapshot.saved.state,"revoked");
 assert.equal(count,0);
});
test("transport failure keeps original idempotency key and schedules bounded retry",async()=>{
 const store=mockStore();let sent=null;
 const transport={send:async x=>{sent=x;throw Error("provider unavailable");}};
 const j=job();
 assert.equal(await processRiskNotification({enabled:true,store,transport,job:j,now:NOW}),"retry-scheduled");
 assert.equal(sent.idempotencyKey,j.id);
 assert.equal(store.snapshot.saved.attempts,1);
 assert.equal(store.snapshot.saved.nextAttemptAt,iso(NOW+60_000));
});
