import {test} from "node:test";
import assert from "node:assert/strict";
import {
 createRecipientChallenge,assessRecipientAttempt,
} from "../lib/notifications/recipient-proof.ts";
import {
 buildNotificationRevocationMessage,validRevocationMessage,
 revokeNotificationSubscription,M14_REVOCATION_PURGE_CLASSES,
} from "../lib/notifications/revocation.ts";

const NOW=Date.parse("2026-10-30T20:00:00.000Z");
const iso=t=>new Date(t).toISOString();
const wallet="0x0000000000000000000000000000000000000001";
const other="0x0000000000000000000000000000000000000002";
const origin="https://symb-ii.vercel.app";
const subscriptionId="550e8400-e29b-41d4-a716-446655440001";
const challengeId="550e8400-e29b-41d4-a716-446655440000";
const recipientRef="rcpt_"+"a".repeat(24);
const input={wallet,channel:"email",recipientRef,subscriptionId,now:NOW};
const revocation={
 wallet,origin,subscriptionId,challengeId,
 issuedAt:iso(NOW-15_000),
};
const signature="0x"+"ab".repeat(65);
const verify=(record,token,overrides={})=>
 assessRecipientAttempt({record,token,...input,...overrides});
function deps(message=buildNotificationRevocationMessage(revocation)){
 let stored=message,consumes=0,verifies=0,revocations=0,time=NOW;
 const d={
  async consumeNonce(id){assert.equal(id,"m14-notification-revoke:"+challengeId);consumes++;const m=stored;stored=null;return m;},
  async verifySignature(){verifies++;return true;},
  now(){return time;},
  async revokeAtomically(){revocations++;return true;},
 };
 return {d,
  setTime:t=>time=t,
  stats:()=>({consumes,verifies,revocations}),
 };
}
test("recipient proof uses 256-bit random token and stores ONLY a bound hash",()=>{
 const a=createRecipientChallenge(input),b=createRecipientChallenge(input);
 assert.match(a.oneTimeToken,/^[a-f0-9]{64}$/);
 assert.notEqual(a.oneTimeToken,b.oneTimeToken);
 assert.notEqual(a.record.tokenHash,b.record.tokenHash);
 assert.equal(JSON.stringify(a.record).includes(a.oneTimeToken),false);
 assert.equal(a.record.wallet,wallet);
 assert.equal(a.record.expiresAt,iso(NOW+600_000));
 assert.equal(a.record.attempts,0);
});
test("valid proof is marked consumed and cannot be reused",()=>{
 const a=createRecipientChallenge(input);
 const result=verify(a.record,a.oneTimeToken,{now:NOW+1000});
 assert.equal(result.state,"verified");
 assert.equal(result.updated.attempts,1);
 assert.equal(result.updated.consumedAt,iso(NOW+1000));
 assert.equal(verify(result.updated,a.oneTimeToken,{now:NOW+2000}).state,"consumed");
});
test("recipient proof is wallet, channel, ref and subscription scoped",()=>{
 const a=createRecipientChallenge(input);
 for(const changed of [
  {wallet:other},{channel:"web-push"},
  {recipientRef:"rcpt_"+"b".repeat(24)},
  {subscriptionId:"550e8400-e29b-41d4-a716-446655440002"},
 ]){
  assert.equal(verify(a.record,a.oneTimeToken,changed).state,"invalid-record");
 }
});
test("recipient token expires at 10 minutes and wrong guesses are capped at 3",()=>{
 const a=createRecipientChallenge(input);
 assert.equal(verify(a.record,a.oneTimeToken,{now:NOW+600_000}).state,"expired");
 let r=a.record;
 for(let i=1;i<=3;i++){
  const answer=verify(r,"0".repeat(64),{now:NOW+i*1000});
  assert.equal(answer.state,i===3?"locked":"invalid");
  r=answer.updated;
  assert.equal(r.attempts,i);
 }
 assert.equal(verify(r,a.oneTimeToken,{now:NOW+4000}).state,"locked");
});
test("random token cannot be replayed across independently minted challenges",()=>{
 const a=createRecipientChallenge(input),b=createRecipientChallenge(input);
 assert.equal(verify(b.record,a.oneTimeToken).state,"invalid");
 assert.equal(verify(a.record,b.oneTimeToken).state,"invalid");
});
test("invalid recipient records and malformed creation reject without leaking",()=>{
 const a=createRecipientChallenge(input);
 for(const c of [
  {...a.record,tokenHash:"bad"},
  {...a.record,expiresAt:iso(NOW+3_600_000)},
  {...a.record,attempts:5},
  {...a.record,chainId:1,recipientRef:"user@example.com"},
 ]){
  assert.equal(verify(c,a.oneTimeToken).state,"invalid-record");
 }
 assert.throws(()=>createRecipientChallenge({...input,recipientRef:"user@example.com"}));
 assert.throws(()=>createRecipientChallenge({...input,wallet:"bad"}));
});
test("revocation message is exactly origin, wallet, subscription and nonce bound",()=>{
 const message=buildNotificationRevocationMessage(revocation);
 assert.ok(validRevocationMessage(message,revocation,NOW));
 assert.match(message,/No trade, transfer/);
 assert.equal(validRevocationMessage(message+"\nAction: trade",revocation,NOW),false);
 assert.equal(validRevocationMessage(message,{...revocation,wallet:other},NOW),false);
 assert.equal(validRevocationMessage(message,{...revocation,origin:"https://other.app"},NOW),false);
 assert.equal(validRevocationMessage(message,{...revocation,subscriptionId:challengeId},NOW),false);
 assert.equal(validRevocationMessage(message,revocation,NOW+120_000),false);
 assert.throws(()=>buildNotificationRevocationMessage({...revocation,origin:"http://untrusted.example"}));
 assert.throws(()=>buildNotificationRevocationMessage({...revocation,origin:"https://symb-ii.vercel.app/redirect"}));
});
test("revocation consumes nonce once and atomically cancels scoped notification records",async()=>{
 const c=deps();
 const input={...revocation,signature,now:NOW};
 const first=await revokeNotificationSubscription(input,c.d);
 assert.equal(first.status,"revoked");
 assert.deepEqual(c.stats(),{consumes:1,verifies:1,revocations:1});
 const replay=await revokeNotificationSubscription(input,c.d);
 assert.equal(replay.status,"invalid");
 assert.deepEqual(c.stats(),{consumes:2,verifies:1,revocations:1});
 assert.ok(M14_REVOCATION_PURGE_CLASSES.includes("queued-jobs"));
 assert.ok(M14_REVOCATION_PURGE_CLASSES.includes("recipient-mapping"));
});
test("signature rejection, missing nonce and altered stored message deny revocation",async()=>{
 const altered=deps(buildNotificationRevocationMessage(revocation)+"\nExtra: 1");
 assert.equal((await revokeNotificationSubscription({...revocation,signature,now:NOW},altered.d)).status,"invalid");
 assert.equal(altered.stats().verifies,0);
 const denied=deps();
 denied.d.verifySignature=async()=>false;
 assert.equal((await revokeNotificationSubscription({...revocation,signature,now:NOW},denied.d)).status,"invalid");
 assert.equal(denied.stats().revocations,0);
 assert.equal((await revokeNotificationSubscription({...revocation,signature:"bad",now:NOW},deps().d)).status,"invalid");
});
test("signature callback completing after 120 seconds cannot grant revocation",async()=>{
 const c=deps();c.setTime(NOW+150_000);
 assert.equal((await revokeNotificationSubscription({...revocation,signature,now:NOW},c.d)).status,"invalid");
 assert.equal(c.stats().revocations,0);
});
test("unavailable nonce store and atomic deletion cannot claim success",async()=>{
 const c=deps();
 c.d.consumeNonce=async()=>{throw Error("redis outage");};
 assert.equal((await revokeNotificationSubscription({...revocation,signature,now:NOW},c.d)).status,"unavailable");
 const f=deps();f.d.revokeAtomically=async()=>false;
 assert.equal((await revokeNotificationSubscription({...revocation,signature,now:NOW},f.d)).status,"unavailable");
});
