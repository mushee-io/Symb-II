import BigNumber from "bignumber.js";
import {getAddress,isAddress} from "viem";
import type {EngineMarketEvidence} from "../preflight/nado-evidence.ts";
import type {ReductionPreview} from "../preflight/nado-reduce.ts";

/**
 * Safety review for an indicative, reduce-only Nado limit order.
 * Engine quotes are reference data, not authorized execution quotes.
 * Never create a signed order or submit an order in this module.
 */
export type NadoOrderLimitReview={
 referenceOnly:true;executionEnabled:false;canSubmit:false;
 orderPayload:null;passesIndicativeBounds:boolean;reasons:string[];
 productId:number;limitPrice:string;quantity:string|null;orderSide:"long"|"short"|null;
};
const positive=(value:unknown):BigNumber|null=>{
 if(typeof value!=="string"||value.length<1||value.length>90||
    !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value))return null;
 const parsed=new BigNumber(value);
 return parsed.isFinite()&&parsed.gt(0)?parsed:null;
};
export function reviewNadoReduceOnlyLimit(args:{
 wallet:string;sourceWallet:string;productId:number;
 positionSide:"long"|"short";engine:EngineMarketEvidence;
 reduction:ReductionPreview;limitPrice:string;maxSlippageBps:number;
 now?:number;
}):NadoOrderLimitReview{
 const {wallet,sourceWallet,productId,positionSide,engine,reduction,limitPrice,maxSlippageBps}=args;
 const now=args.now??Date.now();
 const reasons:string[]=[];
 const refuse=(reason:string)=>reasons.push(reason);
 const side=positionSide==="long"?"short":positionSide==="short"?"long":null;
 const response=():NadoOrderLimitReview=>({
  referenceOnly:true,executionEnabled:false,canSubmit:false,orderPayload:null,
  passesIndicativeBounds:reasons.length===0,reasons,productId,limitPrice,
  quantity:reduction?.floorToIncrement??null,orderSide:side,
 });
 if(!isAddress(wallet,{strict:false})||!isAddress(sourceWallet,{strict:false})||
    (isAddress(wallet,{strict:false})&&isAddress(sourceWallet,{strict:false})&&
     getAddress(wallet)!==getAddress(sourceWallet)))
  refuse("Wallet does not match Nado account source.");
 if(!Number.isSafeInteger(productId)||productId<0||productId>1000000||
    engine?.engineChainId!==57073||engine?.productId!==productId||
    engine?.productType!=="perp"||
    !Array.isArray(engine?.warnings)||engine.warnings.length)
  refuse("Official Nado engine, product, network or warnings are invalid.");
 const ts=Date.parse(engine?.observedAt??"");
 if(!Number.isFinite(ts)||!Number.isFinite(now)||ts>now+5000||now-ts>15000)
  refuse("Nado top-of-book is older than 15 seconds or invalid.");
 if(!reduction||!reduction.checked||!reduction.feasibleBySize||
    ![10,25,50,75].includes(reduction.requestedPercent)||
    !side||reduction.side!==side||reduction.warnings.length<1)
  refuse("Reduce-only size or direction was not independently confirmed.");
 if(!Number.isInteger(maxSlippageBps)||maxSlippageBps<0||maxSlippageBps>100)
  refuse("Review slippage must be 0-100 basis points.");
 const price=positive(limitPrice),tick=positive(engine?.priceIncrement);
 const bid=positive(engine?.bid),ask=positive(engine?.ask);
 const quantity=positive(reduction?.floorToIncrement),increment=positive(reduction?.sizeIncrement);
 const min=positive(reduction?.minimumSize),max=positive(reduction?.engineMaxReduceOnly);
 if(!price||!tick||!bid||!ask||!quantity||!increment||!min||!max){
  refuse("Exact tick, engine bid/ask, reduce size, minimum or maximum is unavailable.");
  return response();
 }
 if(bid.gt(ask))refuse("Crossed Nado book.");
 const spread=ask.minus(bid).div(ask.plus(bid).div(2)).times(100);
 if(spread.gt(5))refuse("Observed Nado bid/ask spread exceeds 5% review limit.");
 if(!price.div(tick).isInteger())refuse("Limit price is not aligned to engine price tick.");
 if(!quantity.div(increment).isInteger()||quantity.lt(min)||quantity.gt(max))
  refuse("Reduction quantity violates authoritative engine size increments or limits.");
 if(Number.isInteger(maxSlippageBps)&&maxSlippageBps>=0&&maxSlippageBps<=100){
  const factor=new BigNumber(maxSlippageBps).div(10000);
  // Closing a long is a sell (short); closing a short is a buy (long).
  if(side==="short"&&price.lt(bid.times(new BigNumber(1).minus(factor))))
   refuse("Sell price allows more downside than the configured slippage review limit.");
  if(side==="long"&&price.gt(ask.times(new BigNumber(1).plus(factor))))
   refuse("Buy price allows more upside than the configured slippage review limit.");
 }
 return response();
}
