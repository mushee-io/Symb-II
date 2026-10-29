import {getAddress,isAddress} from "viem";

const NOTE="Read-only ownership self-check only. This is NOT an ERC-20 permit, transaction, delegated authority, order signature, login session or spending approval.";
export const OWNERSHIP_TTL_MS=120_000;
export type OwnershipChallenge={wallet:string;origin:string;nonce:string;issuedAt:string;chainId:57073};
export function ownershipMessage(input:OwnershipChallenge):string{
 if(!isAddress(input.wallet,{strict:false})||input.chainId!==57073||!/^[0-9a-f-]{36}$/i.test(input.nonce))throw Error("Invalid Ink wallet or challenge nonce.");
 const url=new URL(input.origin);
 if((url.protocol!=="https:"&&url.hostname!=="localhost")||url.username||url.password||url.pathname!=="/"||url.search||url.hash)throw Error("Invalid challenge origin.");
 if(!Number.isFinite(Date.parse(input.issuedAt)))throw Error("Invalid time.");
 return [
  "Symb-II / M8 wallet control SELF-TEST",
  "Domain: "+url.host,
  "Wallet: "+getAddress(input.wallet),
  "Chain ID: 57073",
  "Nonce: "+input.nonce,
  "Issued At: "+input.issuedAt,
  "Expiry: 120 seconds",
  NOTE,
 ].join("\n");
}
export function isFreshOwnershipProof(input:OwnershipChallenge,now:number):boolean{
 const ms=Date.parse(input.issuedAt);
 return input.chainId===57073&&isAddress(input.wallet,{strict:false})&&
   Number.isFinite(ms)&&Number.isFinite(now)&&now>=ms-5000&&now-ms<OWNERSHIP_TTL_MS;
}
