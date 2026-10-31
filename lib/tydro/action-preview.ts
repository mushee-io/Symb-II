import {getAddress,isAddress,parseUnits} from "viem";
import {TYDRO} from "./contracts.ts";
import type {TydroAccountResponse,TydroMarketsResponse,TydroReserve,TydroUserReserve} from "./types.ts";
import {observeTydroHealth} from "./health-policy.ts";

export type TydroDraftAction="supply"|"withdraw"|"borrow"|"repay";
export type DraftGate={name:string;status:"observed"|"blocked"|"unknown";detail:string};
export type TydroActionDraft={
  state:"blocked";reviewOnly:true;executionEnabled:false;simulationVerified:false;
  transactionPayload:null;signatureRequested:false;chainId:57073;
  action:TydroDraftAction;asset:string;amount:string;wallet:string|null;
  atomicUnits:string|null;symbol:string|null;gates:DraftGate[];
  note:string;
};
const decimal=/^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const fresh=(value:unknown,now:number)=>{
  if(typeof value!=="string")return false;
  const timestamp=Date.parse(value);
  return Number.isFinite(timestamp)&&timestamp<=now+5000&&timestamp>=now-90_000;
};
export function atomicAmount(amount:unknown,decimals:number):bigint|null{
 if(typeof amount!=="string"||amount.length<1||amount.length>90||
   !decimal.test(amount)||!Number.isInteger(decimals)||decimals<0||decimals>36)return null;
 const fraction=amount.split(".")[1]??"";
 if(fraction.length>decimals)return null;
 try{
  const atomic=parseUnits(amount,decimals);
  return atomic>0n?atomic:null;
 }catch{return null;}
}
function observedAmount(amount:unknown,decimals:number):bigint|null{
 if(typeof amount!=="string"||amount.length>90||!decimal.test(amount)||!Number.isInteger(decimals)||
   decimals<0||decimals>36|| (amount.split(".")[1]??"").length>decimals)return null;
 try{return parseUnits(amount,decimals);}catch{return null;}
}
export function previewTydroAction(input:{
 action:TydroDraftAction;asset:string;amount:string;wallet:string|null;
 markets:TydroMarketsResponse|null;account:TydroAccountResponse|null;now?:number;
}):TydroActionDraft{
 const {action,asset,amount,wallet,markets,account}=input,now=input.now??Date.now();
 const gates:DraftGate[]=[];
 const add=(name:string,passed:boolean|null,detail:string)=>{
  gates.push({name,status:passed===true?"observed":passed===false?"blocked":"unknown",detail});
 };
 const validWallet=typeof wallet==="string"&&isAddress(wallet,{strict:false});
 add("Public address identity",validWallet,"A valid public address identifies data only; it does not prove ownership.");
 const validAsset=typeof asset==="string"&&isAddress(asset,{strict:false});
 const marketSource=Boolean(markets&&markets.source==="Tydro (Aave V3 Ink) contracts"&&
  markets.chainId===57073&&markets.pool.toLowerCase()===TYDRO.pool.toLowerCase()&&
  !markets.incomplete&&markets.warnings.length===0&&fresh(markets.updatedAt,now));
 const accountSource=Boolean(account&&validWallet&&account.source==="Tydro (Aave V3 Ink) contracts"&&
  account.chainId===57073&&account.pool.toLowerCase()===TYDRO.pool.toLowerCase()&&
  account.address.toLowerCase()===getAddress(wallet!).toLowerCase()&&
  !account.incomplete&&account.warnings.length===0&&fresh(account.updatedAt,now));
 add("Canonical Ink Pool and fresh reserves",marketSource,"Requires unmodified Tydro Pool, complete reserves and fresh 90-second data.");
 add("Wallet-scoped on-chain account evidence",accountSource,"Requires fresh verified Ink Pool account data for this exact address, with no missing data.");
 const matches=validAsset&&marketSource?markets!.reserves.filter(r=>r.address.toLowerCase()===asset.toLowerCase()):[];
 const reserve:TydroReserve|null=matches.length===1?matches[0]:null;
 const reserveValid=Boolean(reserve&&reserve.active&&!reserve.frozen);
 add("Active and unfrozen reserve",reserveValid,"The exact asset must be present once in the canonical reserve inventory and accept operations.");
 if(action==="borrow")add("Borrowing enabled",reserve?.borrowEnabled??false,"Current reserve borrowing permission; does not establish available liquidity or borrowing capacity.");
 const atomic=reserve?atomicAmount(amount,reserve.decimals):null;
 add("Positive exact token amount",atomic!==null,"Amount must fit the reserve's actual decimals without rounding, scientific notation or a zero amount.");
 const u=accountSource&&reserve?account!.userReserves.filter(r=>r.address.toLowerCase()===reserve.address.toLowerCase()):[];
 const user:TydroUserReserve|null=u.length===1?u[0]:null;
 if(action==="withdraw"||action==="repay"){
   const observed=user?observedAmount(action==="withdraw"?user.supplied:user.variableDebt,reserve?.decimals??-1):null;
   add("Reported position amount",observed===null?null:atomic!==null&&atomic<=observed&&observed>0n,
    "Read-only reported balance must cover the draft amount; actual spendable balance and debt index require independent block-pinned validation.");
 }
 const health=accountSource?observeTydroHealth({
  debtBase:account!.debtBase,healthFactor:account!.healthFactor,incomplete:account!.incomplete,warnings:account!.warnings,
 }):null;
 if(action==="borrow"||action==="withdraw")
   add("Post-action collateral and health simulation",null,
    "Not verified: reserve liquidity, LTV, eMode, collateral factors and resulting health require pinned Aave Pool simulation.");
 else if(action==="repay")
   add("Wallet underlying balance and exact Pool allowance",null,
    "Not verified: ERC-20 balance, allowance, repayment rate mode and gas require a pinned wallet-specific simulation.");
 else
   add("Wallet underlying balance and Pool approval",null,
    "Not verified: ERC-20 balance, allowance, caps, token-specific behavior and gas require independent simulation.");
 add("Wallet proof and user approval",null,
  "No ownership proof, EOA/1271 validation, transaction review, approval or signature has been requested.");
 add("Independent security and execution authorization",false,
  "Live execution is deliberately disabled pending audits and explicit user authorization.");
 return {
  state:"blocked",reviewOnly:true,executionEnabled:false,simulationVerified:false,
  transactionPayload:null,signatureRequested:false,chainId:57073,action,asset,
  amount,wallet:validWallet?getAddress(wallet!):null,
  atomicUnits:atomic?.toString()??null,symbol:reserve?.symbol??null,gates,
  note:health?.state==="critical"?
   "Current reported health is below 1.0; liquidation risk may already be present. No action can be approved here.":
   "Read-only draft only. No transaction construction, gas quote, approval, protocol call or order execution.",
 };
}
