export const CANDLE_INTERVALS={
  "1m":60,"5m":300,"15m":900,"1h":3600,"4h":14400,"1d":86400,
} as const;
export type CandleInterval=keyof typeof CANDLE_INTERVALS;
export type HistoricalCandle={time:number;open:number;high:number;low:number;close:number;volume:number};
export type HistoricalCandleResponse={
 source:"Nado official indexer";chainId:57073;productId:number;
 interval:CandleInterval;periodSeconds:number;observedAt:string;
 candles:HistoricalCandle[];incomplete:boolean;warnings:string[];
 executionEnabled:false;
};
type BnLike={toString():string};
export type RawNadoCandle={time:BnLike;open:BnLike;high:BnLike;low:BnLike;close:BnLike;volume:BnLike};
const MAX_BARS=96;
function num(value:BnLike):number{
 const raw=value?.toString?.();
 if(typeof raw!=="string"||!/^(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(raw))return Number.NaN;
 return Number(raw);
}
export function normalizeNadoCandles(raw:readonly RawNadoCandle[],productId:number,interval:CandleInterval,now=Date.now()):HistoricalCandleResponse{
 if(!Number.isSafeInteger(productId)||productId<0)throw Error("Invalid product ID");
 const periodSeconds=CANDLE_INTERVALS[interval];
 if(!periodSeconds)throw Error("Unsupported candle interval");
 if(!Array.isArray(raw))throw Error("Malformed indexer candle response");
 const warnings:string[]=[];
 const valid:HistoricalCandle[]=[];
 let dropped=0;
 for(const bar of raw.slice(0,MAX_BARS)){
  const time=num(bar.time),open=num(bar.open),high=num(bar.high),low=num(bar.low),close=num(bar.close),volume=num(bar.volume);
  const ok=Number.isSafeInteger(time)&&time>946684800&&time*1000<=now+periodSeconds*1000&&
   [open,high,low,close,volume].every(Number.isFinite)&&
   open>0&&low>0&&high>0&&close>0&&volume>=0&&
   low<=open&&low<=close&&high>=open&&high>=close&&high>=low;
  if(ok)valid.push({time,open,high,low,close,volume});
  else dropped++;
 }
 if(raw.length>MAX_BARS){warnings.push("Candle response exceeded bounded maximum; excess bars were dropped.");dropped++;}
 if(dropped)warnings.push(dropped+" invalid or excess candlestick records omitted.");
 valid.sort((a,b)=>a.time-b.time);
 const candles:HistoricalCandle[]=[];
 for(const item of valid){
  const prior=candles[candles.length-1];
  if(prior&&prior.time===item.time){warnings.push("Duplicate candle timestamps present; one record omitted.");continue;}
  candles.push(item);
 }
 if(!candles.length)warnings.push("No verified historical candlesticks returned by Nado.");
 if(candles.length>1&&candles.some((bar,i)=>i>0&&(bar.time-candles[i-1].time)>periodSeconds*2))
  warnings.push("Historical data contains missing time intervals; no synthetic bars were inserted.");
 const latest=candles[candles.length-1];
 if(latest&&now-latest.time*1000>Math.max(periodSeconds*3000,300_000))
  warnings.push("Latest historical candle is delayed; it is not a current trading price.");
 return {
  source:"Nado official indexer",chainId:57073,productId,interval,periodSeconds,
  observedAt:new Date(now).toISOString(),candles,
  incomplete:warnings.length>0,warnings,executionEnabled:false,
 };
}

/** Pure arithmetic on indexer-sourced close prices; informational, not a trading signal. */
export function calculateCandleIndicators(candles:readonly HistoricalCandle[]){
 if(candles.length<20)return null;
 const last20=candles.slice(-20);
 if(last20.some(c=>!Number.isFinite(c.close)||c.close<=0))return null;
 const sma20=last20.reduce((sum,c)=>sum+c.close,0)/20;
 const last=candles[candles.length-1];
 const first=candles[0];
 return {sma20,periodChangePct:(last.close-first.close)/first.close*100,
   rangeHigh:Math.max(...candles.map(c=>c.high)),rangeLow:Math.min(...candles.map(c=>c.low))};
}
