import { getAddress, isAddress, keccak256, stringToHex } from "viem";
import type { RescueOutcome } from "../risk/rescue.ts";

export const PROPOSAL_TTL_MS=120_000;
export type ProposalAction="nado-reduction-review"|"tydro-debt-review";
export type ReviewRequest={
  wallet:string;
  action:ProposalAction;
  positionKey?:string;
  shockPct?:number;
  reductionPct?:number;
  repaymentPct?:number;
};
export type ProposalPacket={
  version:1;
  id:string;
  wallet:string;
  chainId:57073;
  action:ProposalAction;
  protocol:"Nado"|"Tydro";
  createdAt:string;
  expiresAt:string;
  scenario:{
    label:string;
    before:string;
    after:string;
    units:string;
    snapshotAt:string;
    assumptions:string[];
  };
  digest:string;
  executable:false;
  gasEstimate:null;
  calldata:null;
  targetContract:null;
};
export type ProposalReceipt={
  id:string;proposalId:string;wallet:string;
  digest:string;action:ProposalAction;protocol:"Nado"|"Tydro";
  acknowledgedAt:string;status:"review-acknowledged-only";
  executable:false;
};
const validPk=(x:string)=>x.length>0&&x.length<=180&&/^[\w.:()-]+$/.test(x);
export function isProposalsConfigured(env:NodeJS.ProcessEnv=process.env):boolean{
  return env.SYMB_II_PROPOSALS_ENABLED==="true" &&
    Boolean(env.UPSTASH_REDIS_REST_URL)&&
    Boolean(env.UPSTASH_REDIS_REST_TOKEN);
}
export function parseReviewRequest(value:unknown):ReviewRequest|null{
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const r=value as Record<string,unknown>;
  if(typeof r.wallet!=="string"||!isAddress(r.wallet,{strict:false}))return null;
  if(r.action==="nado-reduction-review" &&
    typeof r.positionKey==="string"&&validPk(r.positionKey)&&
    Number.isInteger(r.shockPct)&&typeof r.shockPct==="number"&&
    r.shockPct>=-50&&r.shockPct<=50&&
    [10,25,50,75].includes(r.reductionPct as number)&&
    r.repaymentPct===undefined)
    return {wallet:getAddress(r.wallet),action:r.action,
      positionKey:r.positionKey,shockPct:r.shockPct,reductionPct:r.reductionPct as number};
  if(r.action==="tydro-debt-review" &&
    [10,25,50,75].includes(r.repaymentPct as number)&&
    r.positionKey===undefined&&r.shockPct===undefined&&r.reductionPct===undefined)
    return {wallet:getAddress(r.wallet),action:r.action,repaymentPct:r.repaymentPct as number};
  return null;
}
function validTimestamp(iso:string){return Number.isFinite(Date.parse(iso));}
export function packetFromScenario(args:{
  request:ReviewRequest;result:RescueOutcome;id:string;now:number;
}):ProposalPacket|null{
  const {request,result,id,now}=args;
  if(!result.ok||!Number.isFinite(now)||!/^[-0-9a-f]{36}$/i.test(id)||
     !isAddress(request.wallet,{strict:false}))return null;
  const nado=result.kind==="position-reduction";
  if((nado&&request.action!=="nado-reduction-review")||
    (!nado&&request.action!=="tydro-debt-review")||
    !validTimestamp(result.snapshotAt)||Math.abs(now-Date.parse(result.snapshotAt))>180_000)
    return null;
  const protocol: "Nado"|"Tydro"=nado?"Nado":"Tydro";
  const details=nado?
    {label:result.symbol+" | hypothetical "+result.reductionPct+"% position reduction at "+result.shockPct+"% price shock",
     before:result.originalPositionSensitivity,after:result.remainingPositionSensitivity,
     units:result.quote+" quote-denominated PnL sensitivity"}:
    {label:"Hypothetical "+result.repaymentPct+"% reduction in ALL Tydro debt balances",
     before:result.currentHealthFactor,after:result.estimatedHealthFactor,
     units:"Tydro health-factor multiple"};
  const base={
    version:1 as const,id,wallet:getAddress(request.wallet),
    chainId:57073 as const,action:request.action,protocol,
    createdAt:new Date(now).toISOString(),expiresAt:new Date(now+PROPOSAL_TTL_MS).toISOString(),
    scenario:{...details,snapshotAt:result.snapshotAt,assumptions:result.assumptions.slice(0,6)},
    executable:false as const,gasEstimate:null,calldata:null,targetContract:null,
  };
  // Canonical digest over server-reviewed values, expiry, wallet, chain and
  // explicit non-executability. No client-provided balances are accepted.
  const digest=keccak256(stringToHex(JSON.stringify(base)));
  return {...base,digest};
}
export function reviewSignatureMessage(packet:ProposalPacket,origin:string):string{
  const url=new URL(origin);
  if(url.protocol!=="https:"&&url.hostname!=="localhost")throw Error("Insecure signing origin");
  return [
    "Symb-II | REVIEW ACKNOWLEDGEMENT ONLY",
    "Domain: "+url.host,
    "Wallet: "+packet.wallet,
    "Ink Chain ID: "+packet.chainId,
    "Review ID: "+packet.id,
    "Action: "+packet.action,
    "Scenario Digest: "+packet.digest,
    "Expires At: "+packet.expiresAt,
    "I acknowledge reviewing the described non-executable scenario.",
    "This is NOT consent to trade, repay, transfer funds, approve a token, delegate a wallet or execute any transaction.",
  ].join("\n");
}
export function packetValidForAcknowledgement(packet:ProposalPacket, wallet:string, now:number):boolean {
  if(!isAddress(wallet,{strict:false})||
     packet.wallet.toLowerCase()!==wallet.toLowerCase()||
     packet.chainId!==57073||packet.executable!==false||
     packet.calldata!==null||packet.targetContract!==null||
     !Number.isFinite(now)||now<Date.parse(packet.createdAt)-5000||
     now>=Date.parse(packet.expiresAt))return false;
  const {digest,...base}=packet;
  return digest===keccak256(stringToHex(JSON.stringify(base)));
}
