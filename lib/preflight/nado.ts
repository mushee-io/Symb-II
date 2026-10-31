import "server-only";
import {getNadoAccount,getNadoMarkets,getNadoPreflightEngineEvidence,getNadoReduceOnlyObservation} from "@/lib/nado/queries";
import {nadoPositionKey} from "@/lib/risk/nado-stress";
import {assessNadoEvidence,canInspectNadoReduction,type EngineMarketEvidence} from "./nado-evidence";
import {assessReductionSize,type ReduceOnlyObservation} from "./nado-reduce";
import {reviewNadoReduceOnlyLimit} from "@/lib/nado/order-limit-policy";
import {finalizePreflight,type PreflightRequest,type PreflightReport} from "./policy";

/** Read-only Nado product diagnostics, NEVER an authenticated order preview.
 * The engine's public data is not trading authorization for any subaccount.
 */
export async function preflightNado(request:Extract<PreflightRequest,{kind:"nado-position-reduce"}>):Promise<PreflightReport>{
 const [account,markets]=await Promise.all([getNadoAccount(request.wallet),getNadoMarkets()]);
 const positions=account.positions.filter(p=>nadoPositionKey(p)===request.positionKey);
 const productId=positions.length===1?positions[0].productId:null;
 const fallback:EngineMarketEvidence={
   observedAt:new Date().toISOString(),engineChainId:null,engineEndpoint:null,
   productId:productId??-1,productType:null,oraclePrice:null,priceIncrement:null,
   sizeIncrement:null,minSize:null,bid:null,ask:null,
   warnings:["No unique position or Nado engine could not be queried."],
 };
 let evidence=fallback;
 if(productId!==null){
   try{evidence=await getNadoPreflightEngineEvidence(productId);}
   catch{/* Fail closed: missing independent Nado engine evidence */}
 }
 let assessed=assessNadoEvidence({
   wallet:request.wallet,account,markets,positionKey:request.positionKey,engine:evidence,
 });
 const position=positions.length===1?positions[0]:null;
 let reduction=null;
 // A reduce-only maximum is queried ONLY for a fully consistent read-only
 // portfolio/product/health snapshot. The failing execution gate is exempted:
 // this query has no order-signing or transaction capabilities.
 if(position&&canInspectNadoReduction(assessed)){
   let observation:ReduceOnlyObservation;
   try{
     observation=await getNadoReduceOnlyObservation({
       address:request.wallet,subaccount:position.subaccount,
       productId:position.productId,positionSide:position.side,
     });
   }catch{
     observation={observedAt:new Date().toISOString(),walletSubaccountMatched:false,
       engineMaxSize:null,priceReference:null,orderSide:null,
       warning:"Engine reduce-only query failed. No trading limits verified.",
     };
   }
   reduction=assessReductionSize({
     positionSize:position.size,positionSide:position.side,
     minSize:evidence.minSize,sizeIncrement:evidence.sizeIncrement,
     percent:request.percent,observation,
   });
 }
 // Account and ticker timestamps may expire while an engine RPC is running.
 // Reassess the original source snapshot at response time; never report a
 // feasible size for an expired or contradictory input set.
 assessed=assessNadoEvidence({
   wallet:request.wallet,account,markets,positionKey:request.positionKey,
   engine:evidence,now:Date.now(),
 });
 const coreNadoEvidencePassed=canInspectNadoReduction(assessed);
 if(!coreNadoEvidencePassed)reduction=null;
 // Even a matching engine cap is NOT a valid order.
 assessed.gates.push({
   name:"Hypothetical reduce-only size bounds",
   state:reduction?.feasibleBySize?"pass":"unknown",
   detail:reduction?.reason??"No verified reduce-only engine limit for this exact wallet position.",
 });
 // A second, independent display-only limit-tick and slippage screening on
 // current official BBO is useful for review. No user or exchange signature.
 const indicativeLimit=reduction&&position&&coreNadoEvidencePassed?
   reviewNadoReduceOnlyLimit({
     wallet:request.wallet,sourceWallet:account.address,productId:position.productId,
     positionSide:position.side,engine:evidence,reduction,
     limitPrice:position.side==="long"?(evidence.bid??""):(evidence.ask??""),
     maxSlippageBps:0,now:Date.now(),
   }):null;
 assessed.gates.push({
   name:"Indicative Nado reduce-only limit review",
   state:indicativeLimit?.passesIndicativeBounds?"pass":"unknown",
   detail:indicativeLimit?.passesIndicativeBounds?
     "Top-of-book reference matches tick, slippage and engine size heuristics. No executable quote, order credentials, wallet approval or signing.":
     (indicativeLimit?.reasons.join(" ")??"An exact fresh, supported Nado limit-order reference is unavailable."),
 });
 // Nado execution restrictions ALWAYS fail regardless of all source gates.
 return finalizePreflight({
   version:1,network:"Ink",chainId:57073,kind:request.kind,
   wallet:request.wallet,asset:null,createdAt:new Date().toISOString(),blockNumber:null,
   reviewOnly:true,executionEnabled:false,transactionPayload:null,
   amount:null,target:{protocol:"Nado",name:"Read-only engine evidence — no signed orders",address:null},
   gas:{estimatedUnits:null,maxEstimatedNativeFee:null,nativeBalance:null},
   allowance:{required:null,current:null,sufficient:null},
   nadoMarketEvidence:assessed.marketEvidence,
   nadoReduceOnly:reduction??undefined,
   gates:assessed.gates,
 });
}
