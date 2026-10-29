import "server-only";
import {redis} from "../agent/redis";
import type { ProposalPacket, ProposalReceipt } from "./policy";

const draftKey=(id:string)=>"symb-ii:proposal:draft:"+id;
const receiptsKey=(wallet:string)=>"symb-ii:proposal:receipts:"+wallet.toLowerCase();
export async function storeProposal(packet:ProposalPacket):Promise<boolean>{
  return await redis(["SET",draftKey(packet.id),JSON.stringify(packet),"EX",120,"NX"])==="OK";
}
export async function consumeProposal(id:string):Promise<ProposalPacket|null>{
  const raw=await redis(["GETDEL",draftKey(id)]);
  if(typeof raw!=="string")return null;
  try{return JSON.parse(raw) as ProposalPacket;}catch{return null;}
}
export async function persistReceipt(receipt:ProposalReceipt):Promise<void>{
  // Receipts retain only the wallet, digest, IDs and timestamp. No signing
  // signature, account positions or balances are persisted.
  const key=receiptsKey(receipt.wallet);
  await redis(["LPUSH",key,JSON.stringify(receipt)]);
  await redis(["LTRIM",key,0,19]);
  await redis(["EXPIRE",key,60*60*24*30]);
}
