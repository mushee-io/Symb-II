/**
 * M14 one-use, wallet-authorised delivery revocation policy. No network calls
 * or endpoint are installed by this module. Injected verifier MUST use the
 * independently audited, block-pinned Ink EOA/ERC-1271 signature flow.
 */
const ADDRESS=/^0x[a-f0-9]{40}$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIG=/^0x(?:[0-9a-f]{2}){1,768}$/i;
const time=(v:unknown)=>{
 if(typeof v!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v))return NaN;
 const t=Date.parse(v);
 return Number.isFinite(t)&&new Date(t).toISOString()===v?t:NaN;
};
function hostname(origin:string):string{
 const url=new URL(origin);
 if(url.origin!==origin||url.username||url.password||
    (url.protocol!=="https:"&&!(url.protocol==="http:"&&url.hostname==="localhost")))
  throw Error("Invalid signed action origin.");
 return url.host;
}
export type RevokeIntent={wallet:string;subscriptionId:string;challengeId:string;
 origin:string;issuedAt:string};
export function buildNotificationRevocationMessage(x:RevokeIntent):string{
 if(!ADDRESS.test(x.wallet)||!UUID.test(x.subscriptionId)||!UUID.test(x.challengeId)||
    !Number.isFinite(time(x.issuedAt)))throw Error("Invalid revocation challenge.");
 const host=hostname(x.origin);
 return [
  "Symb-II notification opt-out — revoke only",
  "Domain: "+host,
  "Wallet: "+x.wallet.toLowerCase(),
  "Chain ID: 57073",
  "Action: revoke-notification-subscription",
  "Subscription: "+x.subscriptionId.toLowerCase(),
  "Nonce: "+x.challengeId.toLowerCase(),
  "Issued At: "+x.issuedAt,
  "Expires In: 120 seconds",
  "This signature ONLY revokes this notification subscription. No trade, transfer, borrowing, approvals, session delegation or spending authority.",
 ].join("\n");
}
export function validRevocationMessage(message:unknown,x:RevokeIntent,now:number):boolean{
 if(typeof message!=="string"||message.length>750||
    !Number.isSafeInteger(now)||now<0)return false;
 const issued=time(x.issuedAt);
 if(!Number.isFinite(issued)||issued>now+5000||now<issued||
    now-issued>=120_000)return false;
 try{return message===buildNotificationRevocationMessage(x);}
 catch{return false;}
}
export type RevokeDependencies={
 /** Atomic GETDEL; each challenge is consumed before signature verification. */
 consumeNonce:(id:string)=>Promise<string|null>;
 /** Real Ink block-pinned EOA/ERC-1271 verification, not a mocked flag. */
 verifySignature:(args:{wallet:string;message:string;signature:string})=>Promise<boolean>;
 /** Monotonic server clock sampled AFTER asynchronous wallet verification. */
 now:()=>number;
 /** Atomic tombstone + queued job cancellation + recipient mapping deletion.
  * Must fence concurrent workers before successful resolution. */
 revokeAtomically:(args:{wallet:string;subscriptionId:string})=>Promise<boolean>;
};
export type RevokeResult={status:"revoked"|"invalid"|"unavailable"};
export async function revokeNotificationSubscription(
 input:RevokeIntent&{signature:string;now:number},deps:RevokeDependencies,
):Promise<RevokeResult>{
 if(!ADDRESS.test(input.wallet)||!UUID.test(input.subscriptionId)||
    !UUID.test(input.challengeId)||!SIG.test(input.signature)||
    !Number.isSafeInteger(input.now)||input.now<0)return {status:"invalid"};
 const expected=buildNotificationRevocationMessageSafe(input);
 if(!expected)return {status:"invalid"};
 let consumed:string|null;
 try{consumed=await deps.consumeNonce("m14-notification-revoke:"+input.challengeId);}
 catch{return {status:"unavailable"};}
 if(!consumed||consumed!==expected||
    !validRevocationMessage(consumed,input,input.now))return {status:"invalid"};
 try{
  const verified=await deps.verifySignature({
   wallet:input.wallet,message:consumed,signature:input.signature,
  });
  if(!verified)return {status:"invalid"};
 }catch{return {status:"invalid"};}
 let completed:number;
 try{completed=deps.now();}catch{return {status:"invalid"};}
 const issued=time(input.issuedAt);
 if(!Number.isSafeInteger(completed)||completed<input.now||
    completed>=issued+120_000)return {status:"invalid"};
 try{
  const revoked=await deps.revokeAtomically({
   wallet:input.wallet.toLowerCase(),subscriptionId:input.subscriptionId.toLowerCase(),
  });
  return {status:revoked?"revoked":"unavailable"};
 }catch{return {status:"unavailable"};}
}
function buildNotificationRevocationMessageSafe(x:RevokeIntent):string|null{
 try{return buildNotificationRevocationMessage(x);}
 catch{return null;}
}
/**
 * Future atomic revoke store MUST invalidate these logical record classes.
 * This is a deletion checklist, not a Redis implementation.
 */
export const M14_REVOCATION_PURGE_CLASSES=[
 "notification-consent","recipient-mapping","pending-recipient-proof",
 "queued-jobs","dedupe-reservations","provider-delivery-leases",
] as const;

export function publicRecipientLifecycleConfiguration(){
 return {
  recipientProofPolicyImplemented:true,revocationPolicyImplemented:true,
  recipientVerificationAvailable:false,recipientOwnershipVerified:false,
  signedRevocationEndpointAvailable:false,atomicRevocationVerified:false,
  privacyDeletionVerified:false,
 };
}
