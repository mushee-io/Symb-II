import {
  createPublicClient,getAddress,hashMessage,http,isAddress,
  parseAbi,verifyMessage,type Address,type Hex,
} from "viem";
import {ink} from "../ink.ts";

export const NONCE_TTL_SECONDS=120;
const ERC1271_MAGIC="0x1626ba7e";
const erc1271Abi=parseAbi([
 "function isValidSignature(bytes32 hash,bytes signature) view returns (bytes4)",
]);

/** All signed actions are short-lived, read-only and tied to a specific Ink
 * wallet. ERC-1271 validation consults the deployed contract itself.
 * Undeployed/6492/8010 wallets are deliberately NOT supported here.
 */
export type InkSignatureRuntime={
 chainId:()=>Promise<number>;
 code:(wallet:Address)=>Promise<Hex|undefined>;
 contractSignature:(wallet:Address,hash:Hex,signature:Hex)=>Promise<Hex>;
};
const client=createPublicClient({
 chain:ink,
 transport:http(process.env.INK_RPC_URL||ink.rpcUrls.default.http[0],{timeout:10000,retryCount:0}),
});
const runtime:InkSignatureRuntime={
 chainId:()=>client.getChainId(),
 code:address=>client.getCode({address}),
 contractSignature:(address,hash,signature)=>client.readContract({
   address,abi:erc1271Abi,functionName:"isValidSignature",args:[hash,signature],
 }),
};
export function isAcceptableSignature(value:unknown):value is Hex{
 // Maximum of 768 bytes accommodates multisig contract payloads while
 // limiting abuse; 65-byte EOA signatures are validated separately.
 return typeof value==="string"&&/^0x(?:[0-9a-fA-F]{2}){1,768}$/.test(value);
}
export function createChallenge(args:{address:string;id:string;issuedAt:string;origin:string}):string{
 if(!isAddress(args.address,{strict:false})||!/^[0-9a-f-]{36}$/i.test(args.id))
   throw Error("Invalid challenge.");
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
},verifier:InkSignatureRuntime=runtime):Promise<boolean>{
 if(args.challenge!==args.expectedMessage||!isAddress(args.wallet,{strict:false})||
    !isAcceptableSignature(args.signature))return false;
 try{
   // Never accept a utility-recovered EOA signer without first checking Ink:
   // the address might actually be a contract with different authorized owners.
   if(await verifier.chainId()!==57073)return false;
   const wallet=getAddress(args.wallet);
   const code=await verifier.code(wallet);
   if(code===undefined)return false; // RPC ambiguity must not grant access.
   if(code!=="0x"){
     const magic=await verifier.contractSignature(
       wallet,hashMessage(args.expectedMessage),args.signature);
     return magic.toLowerCase()===ERC1271_MAGIC;
   }
   if(!/^0x[0-9a-fA-F]{130}$/.test(args.signature))return false;
   return await verifyMessage({
     address:wallet,message:args.expectedMessage,signature:args.signature,
   });
 }catch{return false;} // unavailable/reverting RPC or invalid contract => no auth
}
