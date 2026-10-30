/**
 * M8 offline evidence schema + independently fetched public Ink block proofs.
 * Only checks public block references; it does NOT authenticate the browser,
 * attest account positions/debt, sign a receipt, or authorize execution.
 * An independent RPC must be provided by the operator at the CLI boundary.
 */
export const INK_CHAIN_ID=57073;
const hex32=/^0x[0-9a-f]{64}$/i;
const address=/^0x[0-9a-f]{40}$/i;
const digits=/^(0|[1-9][0-9]*)$/;
const allowedSources=new Set(["ink-rpc","tydro-pool"]);

const isRecord=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const validDate=(value,now)=>{
 if(typeof value!=="string")return false;
 const ms=Date.parse(value);
 return Number.isFinite(ms)&&new Date(ms).toISOString()===value&&
  ms<=now+5000&&now-ms>=0&&now-ms<180000;
};
const invalid=reason=>({valid:false,reason,blocks:[]});

export function validateM8PublicEvidence(report,now=Date.now()){
 if(!isRecord(report)||report.kind!=="manual-public-wallet-inspection")
  return invalid("Invalid or unrecognized wallet evidence envelope.");
 if(report.chainId!==INK_CHAIN_ID||!address.test(report.wallet||""))
  return invalid("Evidence wallet or Ink chain is invalid.");
 if(report.canExecute!==false||report.ownerProved!==false||
  report.completeRealWalletValidation!==false)
  return invalid("Evidence contains an unsupported authorization claim.");
 if(!validDate(report.checkedAt,now))
  return invalid("Evidence has expired or contains an invalid timestamp.");
 if(!Array.isArray(report.checks)||!Array.isArray(report.referenceBlocks))
  return invalid("Evidence checks or public reference blocks are missing.");
 if(report.referenceBlocks.length<1||report.referenceBlocks.length>2)
  return invalid("Evidence requires one or two public Ink block references.");
 if(report.m8Acceptance!==undefined&&
   (!isRecord(report.m8Acceptance)||
    report.m8Acceptance.kind!=="m8-read-only-acceptance-matrix"||
    report.m8Acceptance.transactionEnabled!==false||
    report.m8Acceptance.complete!==false))
  return invalid("The accompanying M8 matrix makes an unsupported acceptance claim.");
 // This is a public-only report. Reject accidentally included private material
 // rather than letting scripts print/store a report containing secrets.
 const forbidden=new Set([
  "privateKey","signature","signatureBytes","nativeBalanceWei",
  "UPSTASH_REDIS_REST_TOKEN","AI_GATEWAY_API_KEY","mnemonic",
  "rawTransaction","collateralBaseRaw","debtBaseRaw",
 ]);
 const scan=(v,depth=0)=>{
  if(depth>14)return false;
  if(Array.isArray(v))return v.every(x=>scan(x,depth+1));
  if(!isRecord(v))return true;
  return Object.entries(v).every(([key,value])=>!forbidden.has(key)&&scan(value,depth+1));
 };
 if(!scan(report))return invalid("Evidence contains private or raw account fields.");
 const states=new Map();
 for(const check of report.checks){
  if(!isRecord(check)||typeof check.id!=="string"||
     !["pass","fail","not-tested"].includes(check.state)||states.has(check.id))
   return invalid("Evidence has duplicate or malformed check states.");
  states.set(check.id,check.state);
 }
 if(states.get("rpc")!=="pass")
  return invalid("A passing pinned Ink RPC observation is required.");
 const seen=new Set();
 const blocks=[];
 for(const item of report.referenceBlocks){
  if(!isRecord(item)||!allowedSources.has(item.source)||seen.has(item.source)||
     item.chainId!==INK_CHAIN_ID||!digits.test(item.blockNumber||"")||
     !hex32.test(item.blockHash||"")||!validDate(item.observedAt,now))
   return invalid("Public block reference is invalid or duplicated.");
  if(item.source==="tydro-pool"&&states.get("tydro-independent-pool")!=="pass")
   return invalid("Tydro block hash has no passing pinned Pool comparison.");
  seen.add(item.source);
  blocks.push({
   source:item.source,blockNumber:item.blockNumber,
   blockHash:item.blockHash.toLowerCase(),
  });
 }
 if(!seen.has("ink-rpc"))
  return invalid("Passing wallet RPC block reference is missing.");
 if(states.get("tydro-independent-pool")==="pass"&&!seen.has("tydro-pool"))
  return invalid("Passing pinned Tydro comparison lacks a block hash.");
 return {valid:true,reason:"Public-only Ink references parsed.",blocks};
}

/**
 * Read back every reported hash via an operator-chosen RPC. This independently
 * verifies the public block reference against the configured provider, but
 * does not attest the wallet's signature or protocol positions.
 */
export async function verifyM8PublicBlocks(report,reader,nowOrClock=()=>Date.now()){
 // Tests can inject a fixed numeric clock. The production CLI uses an actual
 // live clock sampled before AND after every RPC call, so a slow response
 // cannot validate an expired three-minute public reference.
 const sample=typeof nowOrClock==="function"?nowOrClock:()=>nowOrClock;
 let firstNow;
 try{firstNow=sample();}catch{
  return {valid:false,reason:"Verification clock unavailable.",checked:0,scope:"public-blocks-only"};
 }
 if(!Number.isFinite(firstNow))
  return {valid:false,reason:"Verification clock unavailable.",checked:0,scope:"public-blocks-only"};
 const schema=validateM8PublicEvidence(report,firstNow);
 if(!schema.valid)return {valid:false,reason:schema.reason,checked:0,scope:"public-blocks-only"};
 const fail=(reason,checked)=>({valid:false,reason,checked,scope:"public-blocks-only"});
 const fresh=(block,number,hash,now)=>{
  if(!block||typeof block.hash!=="string"||
     block.hash.toLowerCase()!==hash)return false;
  try{
   if(BigInt(block.number)!==number)return false;
   const timestamp=Number(block.timestamp)*1000;
   return Number.isFinite(timestamp)&&timestamp<=now+5000&&
    now-timestamp>=0&&now-timestamp<180000;
  }catch{return false;}
 };
 let previousNow=firstNow;
 const current=()=>{
  const now=sample();
  if(!Number.isFinite(now)||now<previousNow)
   throw Error("Invalid or reversed verifier clock.");
  previousNow=now;
  return now;
 };
 try{
  if(await reader.getChainId()!==INK_CHAIN_ID)
   return fail("Independent provider is not on Ink 57073.",0);
  let checked=0;
  for(const item of schema.blocks){
   const number=BigInt(item.blockNumber);
   const observed=await reader.getBlock(number);
   const atRead=current();
   if(!fresh(observed,number,item.blockHash,atRead))
    return fail("Independent RPC block hash, number or age disagrees.",checked);
   // A second read of the SAME height closes the simple reorg window while
   // the first public hash is checked. It is still not a finality proof.
   const confirmed=await reader.getBlock(number);
   const atConfirm=current();
   if(!fresh(confirmed,number,item.blockHash,atConfirm))
    return fail("Independent reference block changed or expired while checking.",checked);
   checked++;
  }
  if(await reader.getChainId()!==INK_CHAIN_ID)
   return fail("Independent provider chain changed during verification.",checked);
  const atCompletion=current();
  if(!validateM8PublicEvidence(report,atCompletion).valid)
   return fail("Reported evidence expired while independent RPC was checking.",checked);
  return {
   valid:true,
   reason:"Independent RPC twice confirmed each supplied Ink block and rechecked chain ID; public hashes only, not finality.",
   checked,scope:"public-blocks-only",
  };
 }catch{
  return fail("Independent Ink RPC, verification clock or block data unavailable.",0);
 }
}
