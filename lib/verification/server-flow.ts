import {getAddress,isAddress} from "viem";
import {isValidServerOwnershipMessage,serverProofExpiry} from "./server-policy.ts";

/**
 * Pure M8 one-use signature challenge decision layer.
 * The production adapter supplies Redis GETDEL and the pinned Ink RPC verifier.
 * Never accepts a signature as a session token or creates permissions.
 */
export type OneUseVerificationInput={
 wallet:string;challengeId:string;signature:string;origin:string;now:number;
};
export type OneUseVerificationDependencies={
 consumeNonce:(id:string)=>Promise<string|null>;
 verifySignature:(args:{
  wallet:string;challenge:string;expectedMessage:string;signature:string;
 })=>Promise<boolean>;
 // The server clock MUST be sampled again after the asynchronous Ink RPC
 // signature check. An issued nonce expiring mid-verification cannot succeed.
 now:()=>number;
};
export type OneUseVerificationResult=
 | {status:"verified";wallet:string;expiresAt:string}
 | {status:"invalid"}
 | {status:"unavailable"};
export const isM8ChallengeId=(value:unknown):value is string=>
 typeof value==="string"&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const boundedSignature=(value:unknown):value is string=>
 typeof value==="string"&&/^0x(?:[0-9a-fA-F]{2}){1,768}$/.test(value);

export async function verifyOneUseWalletProof(
 input:OneUseVerificationInput,
 deps:OneUseVerificationDependencies,
):Promise<OneUseVerificationResult>{
 if(!isAddress(input.wallet,{strict:false})||
   !isM8ChallengeId(input.challengeId)||
   !boundedSignature(input.signature)||
   !Number.isFinite(input.now))
  return {status:"invalid"};
 const wallet=getAddress(input.wallet);
 let storedMessage:string|null;
 try{
  // Atomic GETDEL is required: never GET then DEL or mark a nonce used
  // after signature verification. One nonce yields at most one attempt.
  storedMessage=await deps.consumeNonce("m8-"+input.challengeId);
 }catch{return {status:"unavailable"};}
 if(!storedMessage||
  !isValidServerOwnershipMessage(storedMessage,wallet,input.origin,input.now,input.challengeId))
  return {status:"invalid"};
 const expiresAt=serverProofExpiry(storedMessage);
 if(!expiresAt||Date.parse(expiresAt)<=input.now)return {status:"invalid"};
 try{
  const valid=await deps.verifySignature({
   wallet,challenge:storedMessage,expectedMessage:storedMessage,
   signature:input.signature,
  });
  if(!valid)return {status:"invalid"};
 }catch{return {status:"invalid"};}
 // Reading the time only before network I/O can extend a 120-second proof:
 // an ERC-1271 RPC could respond after its challenge has expired. Fail
 // closed if the wall clock is unavailable, reversed or past expiry.
 let completedAt:number;
 try{completedAt=deps.now();}
 catch{return {status:"invalid"};}
 if(!Number.isFinite(completedAt)||completedAt<input.now||
    completedAt>=Date.parse(expiresAt))return {status:"invalid"};
 return {status:"verified",wallet,expiresAt};
}
