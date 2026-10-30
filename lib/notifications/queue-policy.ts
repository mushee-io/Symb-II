import {
 validNotificationConsent,notificationWalletHash,
 type NotificationConsent,type NotificationJob,
} from "./policy.ts";

/**
 * Pure delivery state machine. Provider acceptance is NOT proof that an inbox
 * or device received an alert. Durability/claiming/transport are separate.
 */
export type DeliveryOutcome=
 |{kind:"accepted";receiptRef:string}
 |{kind:"temporary-failure"|"permanent-failure"|"unknown"};
export type DeliveryDecision={kind:"send"|"hold"|"cancel";reason:string};
const LIMIT=5;
const RETRY_MS=[60_000,300_000,900_000,3_600_000];
const HASH=/^[a-f0-9]{64}$/;
const RECEIPT=/^receipt_[a-z0-9_-]{12,96}$/;
const parse=(v:unknown):number=>{
 if(typeof v!=="string")return NaN;
 const ms=Date.parse(v);
 return Number.isFinite(ms)&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&
  new Date(ms).toISOString()===v?ms:NaN;
};
const validNow=(now:number)=>Number.isSafeInteger(now)&&now>=0;
export function decisionForDelivery(
 job:NotificationJob|undefined,consent:NotificationConsent|null,now=Date.now(),
):DeliveryDecision{
 if(!job||!validNow(now)||job.version!==1||!HASH.test(job.id)||
    !HASH.test(job.dedupeKey)||!HASH.test(job.walletHash)||
    !["email","web-push"].includes(job.channel)||
    !["critical","warning"].includes(job.severity)||
    !Number.isInteger(job.attempts)||job.attempts<0||job.attempts>LIMIT)
   return {kind:"cancel",reason:"invalid-job"};
 if(job.state!=="queued")return {kind:"hold",reason:"not-queued"};
 const created=parse(job.createdAt),due=parse(job.nextAttemptAt),expires=parse(job.expiresAt);
 if(!Number.isFinite(created)||!Number.isFinite(due)||!Number.isFinite(expires)||
    created>now+5000||expires<=created||expires>created+86_400_000||
    due<created||job.attempts>=LIMIT)
   return {kind:"cancel",reason:"invalid-or-exhausted-job"};
 if(now>=expires)return {kind:"cancel",reason:"expired"};
 if(!validNotificationConsent(consent,now)||
    consent!.subscriptionId!==job.subscriptionId||
    consent!.recipientRef!==job.recipientRef||
    consent!.channel!==job.channel||
    notificationWalletHash(consent!.wallet)!==job.walletHash||
    parse(consent!.expiresAt)<expires)
   return {kind:"cancel",reason:"revoked-or-mismatched-consent"};
 if(now<due)return {kind:"hold",reason:"retry-not-due"};
 return {kind:"send",reason:"eligible-with-current-consent"};
}
export function settleDeliveryAttempt(
 job:NotificationJob,outcome:DeliveryOutcome,now=Date.now(),
):NotificationJob{
 if(!validNow(now)||decisionJobInvalid(job)||
    job.state!=="queued"||job.attempts>=LIMIT||
    now<parse(job.nextAttemptAt))
  throw Error("Invalid delivery attempt transition.");
 const attempts=job.attempts+1;
 if(now>=parse(job.expiresAt))return {...job,attempts,state:"expired"};
 if(outcome?.kind==="accepted"&&typeof outcome.receiptRef==="string"&&
    RECEIPT.test(outcome.receiptRef))
   return {...job,attempts,state:"accepted"};
 if(outcome?.kind==="permanent-failure"||attempts>=LIMIT)
   return {...job,attempts,state:"dead-letter"};
 // An ambiguous provider response MUST be retried using the same immutable
 // idempotency key; an accepted receipt without a valid ref is ambiguous.
 const next=now+RETRY_MS[Math.min(attempts-1,RETRY_MS.length-1)];
 if(next>=parse(job.expiresAt))return {...job,attempts,state:"expired"};
 return {...job,attempts,state:"queued",nextAttemptAt:new Date(next).toISOString()};
}
function decisionJobInvalid(job:NotificationJob):boolean {
 return !job||job.version!==1||!HASH.test(job.id)||!HASH.test(job.dedupeKey)||
   !HASH.test(job.walletHash)||!Number.isInteger(job.attempts)||
   job.attempts<0||job.attempts>LIMIT||
   !Number.isFinite(parse(job.createdAt))||
   !Number.isFinite(parse(job.nextAttemptAt))||
   !Number.isFinite(parse(job.expiresAt));
}
export function cancelNotificationJob(
 job:NotificationJob,reason:"revoked"|"expired",
):NotificationJob{
 return {...job,state:reason};
}
