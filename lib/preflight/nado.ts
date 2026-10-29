import "server-only";
import {getNadoAccount,getNadoMarkets,getNadoPreflightEngineEvidence,getNadoReduceOnlyObservation} from "@/lib/nado/queries";
import {nadoPositionKey} from "@/lib/risk/nado-stress";
import {assessNadoEvidence,type EngineMarketEvidence} from "./nado-evidence";
import {assessReductionSize,type ReduceOnlyObservation} from "./nado-reduce";
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
 const assessed=assessNadoEvidence({
   wallet:request.wallet,account,markets,positionKey:request.positionKey,engine:evidence,
 });
 const position=positions.length===1?positions[0]:null;
 let reduction=null;
 if(position&&account.positionCoverageComplete===true&&
    account.incomplete===false&&account.warnings.length===0&&
    evidence.engineChainId===57073&&evidence.productType==="perp"){
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
 // Even a matching engine cap is NOT a valid order.
 assessed.gates.push({
   name:"Hypothetical reduce-only size bounds",
   state:reduction?.feasibleBySize?"pass":"unknown",
   detail:reduction?.reason??"No verified reduce-only engine limit for this exact wallet position.",
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
