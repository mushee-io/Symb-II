/**
 * Offline M8 independent block-reference acceptance.
 *
 * Save "Copy evidence report" from the Wallet Verification Lab into a local
 * JSON file and set M8_INDEPENDENT_INK_RPC_URL to a separately operated,
 * operator-selected HTTPS Ink RPC. No wallet signature or key is requested.
 * This validates PUBLIC HASHES ONLY, never private wallet control.
 *
 * M8_INDEPENDENT_INK_RPC_URL=https://your-separate-ink-rpc.example \\
 *   node scripts/verify-m8-evidence.mjs ./wallet-evidence.json
 */
import {createHash} from "node:crypto";
import {readFile,stat} from "node:fs/promises";
import {createPublicClient,http,defineChain} from "viem";
import {verifyM8PublicBlocks} from "./m8-evidence-policy.mjs";

async function main(){
 const files=process.argv.slice(2);
 if(files.length!==1)throw Error("Provide exactly one local, redacted M8 report JSON path.");
 const input=files[0];
 const info=await stat(input);
 if(!info.isFile()||info.size<1||info.size>128000)
  throw Error("Evidence must be a regular JSON file smaller than 128 KB.");
 const text=await readFile(input,"utf8");
 let report;
 try{report=JSON.parse(text);}catch{throw Error("Invalid evidence JSON.");}
 const raw=process.env.M8_INDEPENDENT_INK_RPC_URL;
 if(!raw)throw Error("M8_INDEPENDENT_INK_RPC_URL must be set to a separate, operator-controlled Ink RPC.");
 let endpoint;
 try{endpoint=new URL(raw);}catch{throw Error("Invalid independent RPC URL.");}
 if(endpoint.protocol!=="https:"||endpoint.username||endpoint.password||
    endpoint.search||endpoint.hash||endpoint.port||!endpoint.hostname||
    endpoint.hostname==="rpc-gel.inkonchain.com")
  throw Error("A different HTTPS Ink RPC provider is required (no URL credentials/query parameters).");
 const chain=defineChain({
  id:57073,name:"Ink",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},
  rpcUrls:{default:{http:[endpoint.toString()]}},
 });
 const client=createPublicClient({chain,transport:http(endpoint.toString(),{
  timeout:12000,retryCount:0,
 })});
 const result=await verifyM8PublicBlocks(report,{
  getChainId:()=>client.getChainId(),
  getBlock:blockNumber=>client.getBlock({blockNumber}),
 });
 // The digest lets an operator identify the exact local evidence file without
 // printing the wallet, account values, RPC credentials or signature bytes.
 const digest=createHash("sha256").update(text).digest("hex");
 console.log(JSON.stringify({
  ...result,evidenceSha256:digest,chainId:57073,
  verifiedAt:new Date().toISOString(),
  warning:"Block hash comparison only. Does NOT certify wallet ownership, Nado positions, Tydro debt, execution or audit acceptance.",
 }));
 if(!result.valid)process.exitCode=1;
}
main().catch(()=>{
 console.error("M8 evidence verification unavailable or input/configuration invalid. No acceptance granted.");
 process.exitCode=1;
});
