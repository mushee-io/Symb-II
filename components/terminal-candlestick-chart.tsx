"use client";

import {useMemo,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {RefreshCw,ShieldAlert} from "lucide-react";
import {CANDLE_INTERVALS,calculateCandleIndicators,type HistoricalCandleResponse,type CandleInterval} from "@/lib/trading/candles";
import styles from "@/app/workspace/terminal/terminal.module.css";

async function readHistoricalCandles(productId:number,interval:CandleInterval,signal?:AbortSignal){
 const response=await fetch("/api/nado/candles?productId="+productId+"&interval="+interval,{signal,cache:"no-store"});
 if(!response.ok)throw Error("Official Nado historical candles unavailable (HTTP "+response.status+"). No chart data was substituted.");
 return response.json() as Promise<HistoricalCandleResponse>;
}
function formatPrice(value:number){return "$"+new Intl.NumberFormat("en-US",{maximumFractionDigits:value<1?6:2}).format(value);}
const INTERVAL_LABELS:Record<CandleInterval,string>={"1m":"1m","5m":"5m","15m":"15m","1h":"1H","4h":"4H","1d":"1D"};

export function TerminalCandlestickChart({productId}:{productId:number}){
 const [interval,setInterval]=useState<CandleInterval>("15m");
 const query=useQuery({
  queryKey:["nado-candlesticks",productId,interval],
  queryFn:({signal})=>readHistoricalCandles(productId,interval,signal),
  enabled:Number.isSafeInteger(productId)&&productId>=0,
  staleTime:30_000,refetchInterval:60_000,retry:1,
 });
 const data=query.data;
 const bars=data?.candles??[];
 const indicators=useMemo(()=>calculateCandleIndicators(bars),[bars]);
 const width=940,height=312,left=78,right=24,top=22,bottom=36;
 const innerW=width-left-right,innerH=height-top-bottom;
 const low=bars.length?Math.min(...bars.map(b=>b.low)):0;
 const high=bars.length?Math.max(...bars.map(b=>b.high)):0;
 const range=Math.max(high-low,high*.001);
 const paddedLow=low-range*.08,paddedHigh=high+range*.08;
 const toY=(value:number)=>top+(paddedHigh-value)/(paddedHigh-paddedLow)*innerH;
 const step=bars.length?innerW/bars.length:0;
 const bodyW=Math.max(1.5,Math.min(10,step*.65));
 const sampled=(bars.length>0?bars:[{time:0,open:1,high:1,low:1,close:1,volume:0}]).slice(-96);
 const outdated=Boolean(data&&bars.length&&Date.now()-bars[bars.length-1].time*1000>
     Math.max(data.periodSeconds*3000,300000));
 const suspicious=Boolean(data&& (data.chainId!==57073||data.productId!==productId||
     data.interval!==interval||data.executionEnabled!==false));
 const readable=!query.error&&!query.isPending&&!suspicious&&sampled.length>0&&bars.length>0;
 return <section className={styles.candlePanel} aria-label="Historical Nado candlestick chart">
  <div className={styles.candleHeader}>
    <div><strong>Historical price chart</strong><small>Official Nado indexer · Real OHLCV candles · No synthetic bars</small></div>
    <div className={styles.candleActions}>
     <div className={styles.timeframeTabs} role="group" aria-label="Select historical candle interval">
      {(Object.keys(CANDLE_INTERVALS) as CandleInterval[]).map(key=>
       <button type="button" key={key} onClick={()=>setInterval(key)}
        aria-pressed={interval===key} className={interval===key?styles.selectedTimeframe:""}>{INTERVAL_LABELS[key]}</button>)}
     </div>
     <button className={styles.refreshCandles} type="button" onClick={()=>void query.refetch()} disabled={query.isFetching}
       aria-label="Refresh historical Nado candles"><RefreshCw size={15}/></button>
    </div>
  </div>
  {query.isPending?<div className={styles.chartUnavailable} role="status">Retrieving independently indexed candlesticks from Nado…</div>:
   query.error?<div className={styles.chartUnavailable} role="alert">{query.error.message}</div>:
   !readable?<div className={styles.chartUnavailable} role="alert">Nado returned unavailable or inconsistent historical market data. No simulated candles are shown.</div>:
   <>
    <svg viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`Historical ${interval} candlestick chart showing ${bars.length} indexed Nado trading candles`}
      className={styles.candleSvg}>
     {Array.from({length:5},(_,i)=>{
       const y=top+(innerH*i)/4;
       const price=paddedHigh-(paddedHigh-paddedLow)*(i/4);
       return <g key={i}><line x1={left} y1={y} x2={width-right} y2={y} stroke="#395542" strokeWidth="1" strokeDasharray="4 5"/>
        <text x={left-9} y={y+4} textAnchor="end" fontSize="12" fill="#95b6a3">{formatPrice(price)}</text></g>;
     })}
     {sampled.map((bar,i)=>{
      const x=left+step*(i+.5),c=bar.close>=bar.open;
      const openY=toY(bar.open),closeY=toY(bar.close);
      const color=c?"#9fddaa":"#e6a29b";
      return <g key={bar.time}>
       <line x1={x} x2={x} y1={toY(bar.high)} y2={toY(bar.low)} stroke={color} strokeWidth="1.7"/>
       <rect x={x-bodyW/2} y={Math.min(openY,closeY)}
         width={bodyW} height={Math.max(1.4,Math.abs(openY-closeY))}
         fill={color} rx=".7"/>
      </g>;
     })}
     <text x={left} y={height-12} fontSize="11" fill="#94b4a0">
       {new Date(bars[0].time*1000).toLocaleString()}</text>
     <text x={width-right} y={height-12} textAnchor="end" fontSize="11" fill="#94b4a0">
       {new Date(bars[bars.length-1].time*1000).toLocaleString()}</text>
    </svg>
    <div className={styles.candleStatistics}>
     <span>Last close <strong>{formatPrice(bars[bars.length-1].close)}</strong></span>
     <span>Range <strong>{formatPrice(low)} – {formatPrice(high)}</strong></span>
     <span>20-bar SMA <strong>{indicators?formatPrice(indicators.sma20):"Need 20 candles"}</strong></span>
     <span>Observed change <strong>{indicators?indicators.periodChangePct.toFixed(2)+"%":"Insufficient history"}</strong></span>
    </div>
   </>
  }
  {(data?.incomplete||outdated)&&<div className={styles.candleWarnings} role="status"><ShieldAlert size={15}/>
    <span>{[...(data?.warnings??[]),...(outdated?["Last indexed candle is delayed and is not a current execution price."]:[])].join(" ")}</span>
   </div>}
  <p className={styles.candleDisclaimer}>Price history and indicators describe observed trades; they are not a strategy, fill price, liquidation calculation or investment recommendation. No orders can be placed from this chart.</p>
 </section>;
}
