import { isAddress, getAddress, verifyMessage, type Hex } from "viem";
export const NONCE_TTL_SECONDS=120;
export function createChallenge(args:{address:string;id:string;issuedAt:string;origin:string}):string {
  if(!isAddress(args.address,{strict:false})||
     !/^[0-9a-f-]{36}$/i.test(args.id))throw Error("Invalid challenge.");
  const url=new URL(args.origin);
  if(url.protocol!=="https:"&&url.hostname!=="localhost")throw Error("Insecure origin.");
  return [
    "Symb-II Ink capital assistant — read-only access",
    "Domain: "+url.host,
    "Wallet: "+getAddress(args.address),
    "Chain ID: 57073",
    "Nonce: "+args.id,
    "Issued At: "+args.issuedAt,
    "Expires In: 120 seconds",
    "Purpose: Verify control of this wallet for one read-only AI summary. No transaction, token approval, session delegation, transfer or trading permission is granted.",
  ].join("\n");
}
export async function isValidSignedChallenge(args:{
  wallet:string;challenge:string;signature:string;expectedMessage:string;
}):Promise<boolean>{
  if(args.challenge!==args.expectedMessage||!isAddress(args.wallet,{strict:false})||
     !/^0x[0-9a-f]{130}$/i.test(args.signature))return false;
  try{
    return await verifyMessage({
      address:getAddress(args.wallet),message:args.expectedMessage,
      signature:args.signature as Hex,
    });
  }catch{return false;}
}
