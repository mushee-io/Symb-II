import {createHash} from "node:crypto";
import type {WatchEvent} from "../watch/policy.ts";

/**
 * M13 policy only. A consent object is NOT proof of a signature: callers must
 * load it from a private, independently verified and revocable consent store.
 * Monitoring consent in M7 is NOT notification consent.
 */
export type DeliveryChannel="email"|"web-push";
export type NotificationConsent={
  version:1;purpose:"risk-notifications";chainId:57073;
  wallet:string;channel:DeliveryChannel;recipientRef:string;
  subscriptionId:string;oneUseProofId:string;
  authorizedAt:string;recipientVerifiedAt:string;expiresAt:string;
  revokedAt:string|null;
};
export type NotificationJob={
  version:1;state:"queued"|"accepted"|"dead-letter"|"revoked"|"expired";
  id:string;dedupeKey:string;walletHash:string;
  subscriptionId:string;recipientRef:string;channel:DeliveryChannel;
  createdAt:string;expiresAt:string;nextAttemptAt:string;
  attempts:number;severity:"critical"|"warning";
  title:string;body:string;
};
export type IntentDecision=
  |{kind:"enqueue";job:NotificationJob;dedupeTtlSeconds:1800}
  |{kind:"blocked"|"suppressed";reason:string};

const ADDRESS=/^0x[a-f0-9]{40}$/i;
const REF=/^rcpt_[a-z0-9_-]{16,96}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const DAY=86_400_000;
const MAX_CONSENT_AGE=90*DAY;
const MAX_EVENT_AGE=15*60_000;
const MAX_DELIVERY_AGE=24*60*60_000;
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const hash=(v:string)=>createHash("sha256").update(v,"utf8").digest("hex");
const timestamp=(v:unknown):number=>{
  if(typeof v!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v))return NaN;
  const t=Date.parse(v);
  return Number.isFinite(t)&&new Date(t).toISOString()===v?t:NaN;
};
const validNow=(now:number)=>Number.isSafeInteger(now)&&now>=0;
export const notificationWalletHash=(wallet:string):string=>
  ADDRESS.test(wallet)?hash("symb-ii:m13:wallet:"+wallet.toLowerCase()):"";
export const publicDeliveryConfiguration=()=>({
  milestone:"M13",chainId:57073,
  policyImplemented:true,deliveryEnabled:false,notificationsDelivered:false,
  providerConfigured:false,verifiedConsentStore:false,externalDeliveryVerified:false,
  channels:["email","web-push"] as const,
  note:"Delivery policies and provider interfaces only. No recipient registration, outbound email or push, or always-on delivery is active.",
  executionEnabled:false,
});

/** Validation of trusted-record shape; verification must precede persistence. */
export function validNotificationConsent(consent:unknown,now=Date.now()):consent is NotificationConsent{
  if(!validNow(now)||!record(consent)||consent.version!==1||
     consent.purpose!=="risk-notifications"||consent.chainId!==57073||
     typeof consent.wallet!=="string"||!ADDRESS.test(consent.wallet)||
     !["email","web-push"].includes(String(consent.channel))||
     typeof consent.recipientRef!=="string"||!REF.test(consent.recipientRef)||
     typeof consent.subscriptionId!=="string"||!UUID.test(consent.subscriptionId)||
     typeof consent.oneUseProofId!=="string"||!UUID.test(consent.oneUseProofId)||
     consent.revokedAt!==null)return false;
  const authorized=timestamp(consent.authorizedAt);
  const verified=timestamp(consent.recipientVerifiedAt);
  const expires=timestamp(consent.expiresAt);
  return [authorized,verified,expires].every(Number.isFinite)&&
    authorized<=now+5000&&verified<=now+5000&&
    now-authorized>=0&&now-authorized<=MAX_CONSENT_AGE&&
    now-verified>=0&&now-verified<=MAX_CONSENT_AGE&&
    expires>now&&expires<=authorized+MAX_CONSENT_AGE;
}
function cleanEvent(event:unknown,now:number):{
 at:string;details:{source:"Nado"|"Tydro";level:"critical"|"warning";id:string}[];
 severity:"critical"|"warning";
 fingerprint:string;
}|null{
  if(!record(event)||!["initial","alert-change"].includes(String(event.kind))||
     !validNow(now))return null;
  const at=timestamp(event.at);
  if(!Number.isFinite(at)||at>now+5000||now-at<0||now-at>MAX_EVENT_AGE||
     !Array.isArray(event.details)||event.details.length<1||event.details.length>40)return null;
  let critical=0,warning=0;
  const details: {source:"Nado"|"Tydro";level:"critical"|"warning";id:string}[]=[];
  const ids=new Set<string>();
  for(const item of event.details){
    if(!record(item)||!["Nado","Tydro"].includes(String(item.source))||
       !["critical","warning","info"].includes(String(item.level))||
       typeof item.id!=="string"||item.id.length<3||item.id.length>160||
       /[\u0000-\u001f\u007f]/.test(item.id)||ids.has(item.id))return null;
    ids.add(item.id);
    if(item.level==="info")continue;
    const source=item.source as "Nado"|"Tydro";
    const level=item.level as "critical"|"warning";
    if(level==="critical")critical++;else warning++;
    details.push({source,level,id:item.id});
  }
  if(details.length===0||event.critical!==critical||event.warning!==warning)return null;
  details.sort((a,b)=>a.source.localeCompare(b.source)||a.id.localeCompare(b.id));
  const fingerprint=hash(JSON.stringify(details.map(d=>[d.source,d.id,d.level])));
  return {at:event.at as string,details,
    severity:critical>0?"critical":"warning",fingerprint};
}

/** Only risk changes backed by a separate notification consent may enqueue. */
export function planRiskNotification(input:{
  wallet:string;consent:unknown;event:WatchEvent;now?:number;
}):IntentDecision{
  const now=input.now??Date.now();
  if(!validNow(now)||typeof input.wallet!=="string"||!ADDRESS.test(input.wallet))
    return {kind:"blocked",reason:"invalid-wallet-or-clock"};
  if(!validNotificationConsent(input.consent,now))
    return {kind:"blocked",reason:"absent-or-expired-notification-consent"};
  const consent=input.consent;
  if(consent.wallet.toLowerCase()!==input.wallet.toLowerCase())
    return {kind:"blocked",reason:"wrong-wallet"};
  if(input.event?.kind==="recovery")
    return {kind:"suppressed",reason:"recovery-is-not-an-outbound-alert"};
  const event=cleanEvent(input.event,now);
  if(!event)return {kind:"blocked",reason:"invalid-or-stale-risk-event"};
  // No raw address, external email address, endpoint, balance, position, or
  // untrusted event.title/detail text is stored in a delivery job.
  const walletHash=notificationWalletHash(input.wallet);
  const dedupeKey=hash(["m13:cooldown",walletHash,consent.channel,consent.recipientRef,
    event.fingerprint].join("|"));
  const id=hash(["m13:event",dedupeKey,event.at,consent.subscriptionId].join("|"));
  const expiry=Math.min(now+MAX_DELIVERY_AGE,timestamp(consent.expiresAt),
    timestamp(event.at)+MAX_DELIVERY_AGE);
  if(expiry<=now)return {kind:"blocked",reason:"risk-event-expired"};
  const job:NotificationJob={
    version:1,state:"queued",id,dedupeKey,walletHash,
    subscriptionId:consent.subscriptionId,recipientRef:consent.recipientRef,
    channel:consent.channel,createdAt:new Date(now).toISOString(),
    expiresAt:new Date(expiry).toISOString(),nextAttemptAt:new Date(now).toISOString(),
    attempts:0,severity:event.severity,
    title:event.severity==="critical"?"Symb-II: critical risk warning":"Symb-II: risk warning",
    body:"Ink account risk conditions changed. Open Symb-II and verify the current Nado and Tydro records directly.",
  };
  return {kind:"enqueue",job,dedupeTtlSeconds:1800};
}
