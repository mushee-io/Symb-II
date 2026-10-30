import type {WatchEvent} from "../watch/policy.ts";
import {
 planRiskNotification,type NotificationConsent,type NotificationJob,
} from "./policy.ts";
import {
 decisionForDelivery,settleDeliveryAttempt,cancelNotificationJob,
 type DeliveryOutcome,
} from "./queue-policy.ts";

/**
 * Server-only integration contracts. No production store, email provider or
 * web-push adapter is instantiated by this module. An authorised future
 * integration must implement true atomicity, user verification and deletion.
 */
export interface NotificationQueueStore {
 /** Trusted records from separate verified, signed notification consent. */
 getTrustedConsent(subscriptionId:string):Promise<NotificationConsent|null>;
 /** Atomic job + dedupe insertion (NX with TTL); no split SET / LPUSH. */
 enqueueOnce(job:NotificationJob,dedupeTtlSeconds:number):Promise<boolean>;
 /** Lease token permits one worker at a time; non-atomic locks are unsafe. */
 claim(jobId:string,leaseSeconds:number):Promise<string|null>;
 /** CAS release by lease token; never overwrite a newer worker result. */
 settle(jobId:string,leaseToken:string,updated:NotificationJob):Promise<boolean>;
}
export interface NotificationTransport {
 /** Resolve recipientRef privately. Must honor idempotencyKey for retries. */
 send(data:{
  channel:NotificationJob["channel"];recipientRef:string;
  idempotencyKey:string;title:string;body:string;
 }):Promise<DeliveryOutcome>;
}
export type QueueResult="disabled"|"queued"|"suppressed"|"blocked"|"duplicate";
export type RunResult="disabled"|"already-claimed"|"deferred"|"cancelled"|"provider-accepted"|"retry-scheduled"|"dead-letter"|"unconfirmed";

/** The enabled argument must be backed by a reviewed server-side feature
 * gate. No live app route currently invokes this with true.
 */
export async function enqueueRiskNotification(args:{
 enabled:boolean;store:NotificationQueueStore;wallet:string;
 subscriptionId:string;event:WatchEvent;now?:number;
}):Promise<QueueResult>{
 if(args.enabled!==true)return "disabled";
 const consent=await args.store.getTrustedConsent(args.subscriptionId);
 const intent=planRiskNotification({wallet:args.wallet,consent,event:args.event,now:args.now});
 if(intent.kind==="suppressed")return "suppressed";
 if(intent.kind!=="enqueue")return "blocked";
 // A future store must atomically reserve dedupe and insert the immutable
 // delivery job; otherwise a crash could suppress an unsaved event.
 return await args.store.enqueueOnce(intent.job,intent.dedupeTtlSeconds)?"queued":"duplicate";
}
export async function processRiskNotification(args:{
 enabled:boolean;store:NotificationQueueStore;transport:NotificationTransport;
 job:NotificationJob;now?:number;
}):Promise<RunResult>{
 if(args.enabled!==true)return "disabled";
 const lease=await args.store.claim(args.job.id,45);
 if(!lease)return "already-claimed";
 const now=args.now??Date.now();
 // Consent is reloaded AFTER the atomic claim and immediately before
 // attempting the provider call. A production integration must additionally
 // provide strong revoke/send coordination and authorised destination lookup.
 let consent:NotificationConsent|null;
 try{consent=await args.store.getTrustedConsent(args.job.subscriptionId);}
 catch{
  // Do not send on a failed consent read. Keep job for lease-expiry retry.
  return "deferred";
 }
 const decision=decisionForDelivery(args.job,consent,now);
 if(decision.kind==="hold")return "deferred";
 if(decision.kind==="cancel"){
  const reason=decision.reason==="expired"?"expired":"revoked";
  const cancelled=cancelNotificationJob(args.job,reason);
  return await args.store.settle(args.job.id,lease,cancelled)?"cancelled":"unconfirmed";
 }
 let outcome:DeliveryOutcome;
 try{
  outcome=await args.transport.send({
   channel:args.job.channel,recipientRef:args.job.recipientRef,
   idempotencyKey:args.job.id,title:args.job.title,body:args.job.body,
  });
 }catch{
  // Unknown response may already have reached provider; retry only with
  // original idempotency key, never mint a new job on transport failure.
  outcome={kind:"unknown"};
 }
 const updated=settleDeliveryAttempt(args.job,outcome,now);
 if(!await args.store.settle(args.job.id,lease,updated))return "unconfirmed";
 return updated.state==="accepted"?"provider-accepted":
  updated.state==="queued"?"retry-scheduled":
  updated.state==="dead-letter"?"dead-letter":"cancelled";
}
