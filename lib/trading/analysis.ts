import {assessTopOfBook} from "./quote.ts";
import {calculateCandleIndicators,type HistoricalCandleResponse} from "./candles.ts";
import type {EngineMarketEvidence} from "../preflight/nado-evidence.ts";

export type TradeResearch={
 status:"observed"|"insufficient";
 source:"Nado indexer + Nado engine";
 productId:number;side:"long"|"short";
 reasons:string[];
 metrics:null|{
  referencePrice:number;estimatedBaseQuantity:number;
  observedSpreadPct:number;sma20:number;deviationFromSmaPct:number;
  observedRangeLow:number;observedRangeHigh:number;observedVolume:number;
 };
 executionEnabled:false;authenticated:false;simulationVerified:false;
};
/** Read-only synthesis. Deliberately cannot certify orders, recommend trades or create signing payloads. */
export function reviewMarketEvidence(args:{
 productId:number;side:"long"|"short";notional:number;leverage:number;
 candles:HistoricalCandleResponse|null;engine:EngineMarketEvidence|null;now?:number;
}):TradeResearch{
 const {productId,side,notional,leverage,candles,engine}=args,now=args.now??Date.now();
 const reasons:string[]=[];
 const quote=assessTopOfBook(engine,productId,now);
 if(quote.status!=="ready")reasons.push(quote.reason);
 if(!Number.isSafeInteger(productId)||productId<0)reasons.push("Invalid market product ID.");
 if(side!=="long"&&side!=="short")reasons.push("Invalid draft direction.");
 if(!Number.isFinite(notional)||notional<=0)reasons.push("Notional must be positive.");
 if(!Number.isFinite(leverage)||leverage<1||leverage>10)reasons.push("Illustrative leverage must be 1x–10x.");
 const latest=candles?.candles[candles.candles.length-1];
 const sourceMatches=Boolean(candles&&candles.chainId===57073&&
  candles.productId===productId&&candles.source==="Nado official indexer"&&
  candles.executionEnabled===false&&candles.interval==="15m"&&candles.periodSeconds===900);
 if(!sourceMatches)reasons.push("Expected historical 15-minute Ink candle evidence for exactly this product is missing.");
 if(candles?.incomplete||candles?.warnings?.length)reasons.push("Nado reported partial or missing candle history.");
 if(!candles||candles.candles.length<20)reasons.push("Twenty historical candles are required for a basic moving average.");
 const latestAge=latest?now-latest.time*1000:Infinity;
 if(!Number.isFinite(latestAge)||latestAge<0||latestAge>45*60*1000)
  reasons.push("Last historical candle is outdated or has an invalid timestamp.");
 const indicators=candles?calculateCandleIndicators(candles.candles):null;
 if(!indicators||!Number.isFinite(indicators.sma20)||indicators.sma20<=0)
  reasons.push("Moving-average evidence could not be calculated.");
 // Analysis is blocked if *any* source, time, field or draft validation is missing.
 const base={
  status:"insufficient" as const,source:"Nado indexer + Nado engine" as const,
  productId,side,reasons,metrics:null,executionEnabled:false as const,
  authenticated:false as const,simulationVerified:false as const,
 };
 if(reasons.length||quote.status!=="ready"||!candles||!latest||!indicators)return base;
 const referencePrice=side==="long"?quote.ask:quote.bid;
 if(!Number.isFinite(referencePrice)||referencePrice<=0)
  return {...base,reasons:["No valid direction-specific top-of-book reference."]};
 const estimatedBaseQuantity=notional/referencePrice;
 const deviationFromSmaPct=100*(latest.close-indicators.sma20)/indicators.sma20;
 const observedVolume=candles.candles.reduce((a,c)=>a+c.volume,0);
 if(![estimatedBaseQuantity,deviationFromSmaPct,observedVolume].every(Number.isFinite))
  return {...base,reasons:["Historical or notional arithmetic could not be verified."]};
 return {
  ...base,status:"observed",reasons:[],
  metrics:{
   referencePrice,estimatedBaseQuantity,observedSpreadPct:quote.spreadPct,
   sma20:indicators.sma20,deviationFromSmaPct,
   observedRangeLow:indicators.rangeLow,observedRangeHigh:indicators.rangeHigh,
   observedVolume,
  },
 };
}
