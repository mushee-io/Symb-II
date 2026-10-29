import {getAddress,isAddress} from "viem";
import {hasValidRedisConfiguration} from "../ops/readiness.ts";

export const SERVER_PROOF_TTL_MS=120000;
export function isServerProofConfigured(env:NodeJS.ProcessEnv=process.env):boolean{
 return env.SYMB_II_WALLET_PROOF_ENABLED==="true"&&hasValidRedisConfiguration(env);
}
export function serverOwnershipMessage(args:{
 wallet:string;id:string;issuedAt:string;origin:string;
}):string{
 if(!isAddress(args.wallet,{strict:false})||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(args.id))
  throw Error("Invalid wallet or challenge nonce.");
 const url=new URL(args.origin);
 if((url.protocol!=="https:"&&url.hostname!=="localhost")||
   url.origin!==args.origin||url.username||url.password||url.search||url.hash||
   url.pathname!=="/")throw Error("Invalid verification origin.");
 const timestamp=Date.parse(args.issuedAt);
 if(!Number.isFinite(timestamp)||new Date(timestamp).toISOString()!==args.issuedAt)
  throw Error("Invalid challenge issuance time.");
 return [
  "Symb-II / M8 one-use SERVER wallet control check",
  "Domain: "+url.host,
  "Wallet: "+getAddress(args.wallet),
  "Chain ID: 57073",
  "Nonce: "+args.id,
  "Issued At: "+args.issuedAt,
  "Expires In: 120 seconds",
  "Purpose: One read-only control check. No login session, trade, repayment, transfer, approval, permit or delegated permission is created.",
 ].join("\n");
}
/** Only exact canonical server-issued messages are eligible; stored nonce must
 * be atomically consumed BEFORE signature verification at the route boundary.
 */
export function isValidServerOwnershipMessage(
 message:unknown,wallet:string,origin:string,now=Date.now(),expectedId?:string,
):boolean{
 if(typeof message!=="string"||message.length>800||!isAddress(wallet,{strict:false}))
  return false;
 const lines=message.split("\n");
 if(lines.length!==8)return false;
 const id=lines[4]?.startsWith("Nonce: ")?lines[4].slice(7):"";
 const issuedAt=lines[5]?.startsWith("Issued At: ")?lines[5].slice(11):"";
 if(expectedId!==undefined&&id!==expectedId)return false;
 const time=Date.parse(issuedAt);
 if(!Number.isFinite(time)||time>now+5000||now-time>=SERVER_PROOF_TTL_MS)
  return false;
 try{return message===serverOwnershipMessage({wallet,id,issuedAt,origin});}
 catch{return false;}
}

/** Receipt display expiry derives from the *original issued challenge*, not
 * signature-verification time. Only call this after canonical validation.
 */
export function serverProofExpiry(message:string):string|null{
 const line=message.split("\n")[5];
 if(!line?.startsWith("Issued At: "))return null;
 const issuedAt=line.slice("Issued At: ".length);
 const ms=Date.parse(issuedAt);
 if(!Number.isFinite(ms)||new Date(ms).toISOString()!==issuedAt)return null;
 return new Date(ms+SERVER_PROOF_TTL_MS).toISOString();
}
