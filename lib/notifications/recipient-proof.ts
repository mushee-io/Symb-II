import {createHash,randomBytes,timingSafeEqual} from "node:crypto";
import type {DeliveryChannel} from "./policy.ts";

/**
 * M14 private recipient possession challenge policy. A challenge token must
 * be sent through an independently verified, rate-limited channel. No live
 * endpoint or provider is wired. A caller MUST atomically persist each result
 * with compare-and-swap, or replay/attempt limits are not authoritative.
 */
export type RecipientChallenge={
 version:1;purpose:"verify-notification-recipient";
 wallet:string;channel:DeliveryChannel;recipientRef:string;
 subscriptionId:string;tokenHash:string;issuedAt:string;expiresAt:string;
 attempts:number;consumedAt:string|null;invalidatedAt:string|null;
};
type ChallengeInput={
 wallet:string;channel:DeliveryChannel;recipientRef:string;
 subscriptionId:string;now?:number;
};
export type RecipientAttempt={
 state:"verified"|"invalid"|"expired"|"locked"|"consumed"|"invalid-record";
 updated:RecipientChallenge|null;
};
const WALLET=/^0x[a-f0-9]{40}$/i;
const REF=/^rcpt_[a-z0-9_-]{16,96}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX=/^[a-f0-9]{64}$/;
const validNow=(x:number)=>Number.isSafeInteger(x)&&x>=0;
const ms=(x:unknown):number=>{
 if(typeof x!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(x))return NaN;
 const n=Date.parse(x);
 return Number.isFinite(n)&&new Date(n).toISOString()===x?n:NaN;
};
function scope(challenge:Pick<RecipientChallenge,"wallet"|"channel"|"recipientRef"|"subscriptionId">){
 return ["symb-ii:m14:recipient",challenge.wallet.toLowerCase(),challenge.channel,
  challenge.recipientRef,challenge.subscriptionId].join("|");
}
const digest=(token:string,c:RecipientChallenge)=>createHash("sha256")
  .update(scope(c)+"|"+token,"utf8").digest("hex");
export function createRecipientChallenge(input:ChallengeInput):{
 record:RecipientChallenge;oneTimeToken:string;
}{
 const now=input.now??Date.now();
 if(!validNow(now)||!WALLET.test(input.wallet)||
    !["email","web-push"].includes(input.channel)||
    !REF.test(input.recipientRef)||!UUID.test(input.subscriptionId))
    throw Error("Invalid private recipient challenge parameters.");
 const record:RecipientChallenge={
  version:1,purpose:"verify-notification-recipient",
  wallet:input.wallet.toLowerCase(),channel:input.channel,
  recipientRef:input.recipientRef,subscriptionId:input.subscriptionId,
  tokenHash:"",issuedAt:new Date(now).toISOString(),
  expiresAt:new Date(now+10*60_000).toISOString(),
  attempts:0,consumedAt:null,invalidatedAt:null,
 };
 const oneTimeToken=randomBytes(32).toString("hex");
 record.tokenHash=digest(oneTimeToken,record);
 // ONLY record may be persisted. oneTimeToken must be delivered privately
 // by a separately reviewed provider, never logged or placed in an URL.
 return {record,oneTimeToken};
}
function validRecord(c:RecipientChallenge|undefined,now:number):boolean{
 if(!c||!validNow(now)||c.version!==1||
    c.purpose!=="verify-notification-recipient"||
    !WALLET.test(c.wallet)||c.wallet!==c.wallet.toLowerCase()||
    !["email","web-push"].includes(c.channel)||!REF.test(c.recipientRef)||
    !UUID.test(c.subscriptionId)||!HEX.test(c.tokenHash)||
    !Number.isInteger(c.attempts)||c.attempts<0||c.attempts>3||
    (c.consumedAt!==null&&!Number.isFinite(ms(c.consumedAt)))||
    (c.invalidatedAt!==null&&!Number.isFinite(ms(c.invalidatedAt))))return false;
 const issued=ms(c.issuedAt),expires=ms(c.expiresAt);
 return Number.isFinite(issued)&&Number.isFinite(expires)&&
  issued<=now+5000&&expires===issued+600_000;
}
export function assessRecipientAttempt(args:{
 record:RecipientChallenge|undefined;token:unknown;
 wallet:string;channel:DeliveryChannel;recipientRef:string;
 subscriptionId:string;now?:number;
}):RecipientAttempt{
 const now=args.now??Date.now();
 const record=args.record;
 if(!validRecord(record,now)||!WALLET.test(args.wallet)||
    record!.wallet!==args.wallet.toLowerCase()||
    record!.channel!==args.channel||record!.recipientRef!==args.recipientRef||
    record!.subscriptionId!==args.subscriptionId)
   return {state:"invalid-record",updated:null};
 if(record!.invalidatedAt!==null||record!.attempts>=3)
   return {state:"locked",updated:record!};
 if(record!.consumedAt!==null)return {state:"consumed",updated:record!};
 if(now>=ms(record!.expiresAt))return {state:"expired",updated:record!};
 const attempts=record!.attempts+1;
 const provided=typeof args.token==="string"&&HEX.test(args.token)?
  digest(args.token,record!):"";
 let matched=false;
 if(provided){
  matched=timingSafeEqual(Buffer.from(provided,"hex"),Buffer.from(record!.tokenHash,"hex"));
 }
 // CAS persistence of updated.attempts / consumedAt is mandatory; without it
 // this function can NOT establish at-most-once verification under races.
 if(matched)
   return {state:"verified",updated:{...record!,attempts,consumedAt:new Date(now).toISOString()}};
 return {state:attempts>=3?"locked":"invalid",
   updated:{...record!,attempts,
    invalidatedAt:attempts>=3?new Date(now).toISOString():null}};
}
