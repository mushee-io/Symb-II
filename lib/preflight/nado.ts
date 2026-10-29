import "server-only";
import {getNadoAccount,getNadoMarkets} from "@/lib/nado/queries";
import {nadoPositionKey} from "@/lib/risk/nado-stress";
import {finalizePreflight,type Gate,type PreflightRequest,type PreflightReport} from "./policy";

/** Nado requires protocol-authorised signed orders and specific execution
 * constraints. We deliberately do not synthesize order calldata or guess
 * collateral approval requirements from the public indexer.
 */
export async function preflightNado(request:Extract<PreflightRequest,{kind:"nado-position-reduce"}>):Promise<PreflightReport>{
 const [account,markets]=await Promise.all([getNadoAccount(request.wallet),getNadoMarkets()]);
 const position=account.positions.find(x=>nadoPositionKey(x)===request.positionKey);
 const market=markets.markets.find(x=>x.productId===position?.productId&&x.type==="perp");
 const fresh=Math.abs(Date.now()-Date.parse(account.updatedAt))<90_000&&Math.abs(Date.now()-Date.parse(markets.updatedAt))<90_000;
 const gates:Gate[]=[
   {name:"Ink wallet",state:account.address.toLowerCase()===request.wallet.toLowerCase()&&account.chainId===57073?"pass":"fail",detail:"Wallet and Nado account must match Ink chain 57073"},
   {name:"Position coverage",state:account.positionCoverageComplete?"pass":"fail",detail:"All relevant Nado positions must be included"},
   {name:"Live perp reference",state:position&&market&&market.lastPrice>0?"pass":"fail",detail:"Exact position product must have a current perpetual reference ticker"},
   {name:"Feed freshness",state:fresh?"pass":"fail",detail:"Indexed account and ticker reads must be current"},
   {name:"Nado order constraints and signatures",state:"unknown",detail:"Independent Nado execution auth, product increments, margin, fees, oracle marks and order-signing scheme have not been verified"},
   {name:"Nado executable preflight",state:"fail",detail:"No Nado order, delegated wallet signature, gas quote or execution simulation is available; route intentionally blocked"},
 ];
 return finalizePreflight({
   version:1,network:"Ink",chainId:57073,kind:request.kind,
   wallet:request.wallet,asset:null,createdAt:new Date().toISOString(),blockNumber:null,
   reviewOnly:true,executionEnabled:false,transactionPayload:null,
   amount:null,target:{protocol:"Nado",name:"Off-chain signed order — not configured",address:null},
   gas:{estimatedUnits:null,maxEstimatedNativeFee:null,nativeBalance:null},
   allowance:{required:null,current:null,sufficient:null},gates,
 });
}
