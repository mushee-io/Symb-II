import type {NadoAccountResponse,NadoMarketsResponse} from "../nado/types.ts";
import {crosscheckNadoPositions} from "./nado-positions.ts";
import type {TydroAccountResponse} from "../tydro/types.ts";
import {reconcileTydroDirect,type TydroDirectObservation} from "./tydro-direct.ts";

export type VerificationState="pass"|"fail"|"not-tested";
export type VerificationCheck={
 id:string;name:string;state:VerificationState;detail:string;
};
export type Source<T>={status:"success";data:T}|{status:"error";data?:never};
export type InkRpcObservation={
 chainId:number;blockNumber:string;blockTimestamp:string;
 code:string;nativeBalanceWei:string;observedAt:string;
};
export type WalletVerification={
 kind:"manual-public-wallet-inspection";wallet:string;chainId:57073;
 checkedAt:string;checks:VerificationCheck[];
 passed:number;failed:number;notTested:number;
 canExecute:false;ownerProved:false;completeRealWalletValidation:false;
 notes:string[];
};
const ok=(t:string,now:number)=>{
 const ms=Date.parse(t);
 return Number.isFinite(ms)&&ms<=now+5000&&now-ms<180000;
};
const check=(id:string,name:string,state:VerificationState,detail:string):VerificationCheck=>({id,name,state,detail});
export function assessWalletVerification(input:{
 wallet:string;connectionChainId:number|null;
 rpc:Source<InkRpcObservation>;
 nado:Source<NadoAccountResponse>;
 nadoMarkets?:Source<NadoMarketsResponse>;
 tydro:Source<TydroAccountResponse>;
 tydroDirect?:Source<TydroDirectObservation>;
 now?:number;
}):WalletVerification{
 const now=input.now??Date.now();
 const wallet=input.wallet;
 const validWallet=/^0x[a-f0-9]{40}$/i.test(wallet);
 const checks:VerificationCheck[]=[];
 checks.push(check("connection","Wallet connector on Ink",
   validWallet&&input.connectionChainId===57073?"pass":"fail",
   "The connected wallet provider reports an Ink address and chain ID 57073. Connection alone is not proof of signing control."));
 const rpc=input.rpc.status==="success"?input.rpc.data:null;
 const rpcTime=rpc?Date.parse(rpc.blockTimestamp):NaN;
 const rpcValid=rpc&&rpc.chainId===57073&&/^\d+$/.test(rpc.blockNumber)&&
   Number.isFinite(rpcTime)&&rpcTime<=now+5000&&now-rpcTime<180000;
 checks.push(check("rpc","Independent Ink RPC observation",
   rpcValid?"pass":"fail",
   rpcValid?"Live RPC returned an Ink block timestamp within 3 minutes.":"Ink chain ID, RPC block or recent timestamp unavailable."));
 checks.push(check("code","EOA / deployed contract detection",rpcValid&&rpc&&
   /^0x(?:[0-9a-f]{2})*$/i.test(rpc.code)?"pass":"fail",
   rpc&&rpc.code!=="0x"?"RPC returned deployed contract bytecode. ERC-1271 signing is NOT verified by this read.":
   "RPC returned no wallet contract code or code status is unavailable."));
 const n=input.nado.status==="success"?input.nado.data:null;
 const nValid=n&&validWallet&&n.address.toLowerCase()===wallet.toLowerCase()&&
   n.chainId===57073&&ok(n.updatedAt,now)&&!n.incomplete&&
   n.positionCoverageComplete&&n.warnings.length===0;
 checks.push(check("nado","Nado account, wallet and data completeness",
   nValid?"pass":"fail",
   nValid?"Nado account read matches the wallet and has complete, recent indexer/engine observations.":
    "Nado query failed, was stale/partial, or did not match the connected Ink wallet."));
 const nPositions=nValid?n.positions.filter(p=>p.marginMode==="cross"):[];
 checks.push(check("nado-open-position","Real Nado open-position reconciliation",
   !nValid?"not-tested":nPositions.length>0?"pass":"not-tested",
   !nValid?"No validated Nado account data.":nPositions.length>0?
     "At least one open cross-margin position was returned. Independent Nado UI comparison and execution tests are still required.":
     "No open cross-margin position found. Live position and reduce-only flow remain untested."));
 const crosscheck=crosscheckNadoPositions(
   nValid?n:undefined,
   input.nadoMarkets?.status==="success"?input.nadoMarkets.data:undefined,
   now,
 );
 checks.push(check("nado-position-market","Nado open-position product/market integrity",
   crosscheck.state,crosscheck.detail));
 const t=input.tydro.status==="success"?input.tydro.data:null;
 const tValid=t&&validWallet&&t.address.toLowerCase()===wallet.toLowerCase()&&
   t.chainId===57073&&ok(t.updatedAt,now)&&!t.incomplete&&t.warnings.length===0&&
   t.userEModeCategory!==null;
 checks.push(check("tydro","Tydro account, wallet and reserve completeness",
   tValid?"pass":"fail",
   tValid?"Tydro verified Pool account read matches this wallet and is recent/complete.":
     "Tydro query failed, was stale/partial, or did not match the connected Ink wallet."));
 const direct=reconcileTydroDirect(
   tValid?t:undefined,
   input.tydroDirect?.status==="success"?input.tydroDirect.data:undefined,
   now,
 );
 checks.push(check("tydro-independent-pool","Independent pinned Tydro Pool reconciliation",
   direct.state,direct.detail+
     (direct.blockNumber?" Reference Ink block "+direct.blockNumber+".":"")));
 const variableDebt=tValid?t.userReserves.filter(r=>{
   // Non-numeric values never count as verified borrowing.
   return /^\d+(?:\.\d+)?$/.test(r.variableDebt)&&Number(r.variableDebt)>0;
 }):[];
 checks.push(check("tydro-variable-debt","Real Tydro variable-debt account",
   !tValid?"not-tested":variableDebt.length>0?"pass":"not-tested",
   !tValid?"No validated Tydro account data.":variableDebt.length>0?
    "A real variable-debt reserve was returned. Independent contract comparison and simulated repay are still outstanding.":
    "No variable-rate borrowing recorded, so borrower-specific preflight remains untested."));
 checks.push(check("wallet-signature","Owner signature and smart-wallet control",
  "not-tested",
  "This inspection does not request a signature. Use a separate, explicit one-use challenge to validate EOA or ERC-1271 control."));
 checks.push(check("tx-preflight","End-to-end protocol preflight",
  "not-tested",
  "No protected repayment or Nado reduce-only API was called. Those services must first be enabled and tested separately."));
 checks.push(check("security","Independent adversarial security review",
  "not-tested",
  "Automated unit tests cannot substitute for security audit or real-wallet adversarial testing."));
 const passed=checks.filter(x=>x.state==="pass").length;
 const failed=checks.filter(x=>x.state==="fail").length;
 return {
  kind:"manual-public-wallet-inspection",wallet,chainId:57073,
  checkedAt:new Date(now).toISOString(),checks,passed,failed,
  notTested:checks.length-passed-failed,
  canExecute:false,ownerProved:false,completeRealWalletValidation:false,
  notes:[
   "This is an opt-in read-only inspection; it proves neither control of the wallet nor ability to execute.",
   "A no-position or no-debt wallet cannot satisfy active-position and active-borrow test cases.",
   "The report records statuses and a public wallet address, not position amounts or private credentials.",
   "Nado and Tydro remain separate protocols; no cross-margin netting is inferred.",
  ]
 };
}
