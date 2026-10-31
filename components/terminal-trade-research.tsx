"use client";

import {useQuery} from "@tanstack/react-query";
import {ShieldAlert,ShieldCheck,LockKeyhole} from "lucide-react";
import type {EngineMarketEvidence} from "@/lib/preflight/nado-evidence";
import type {HistoricalCandleResponse} from "@/lib/trading/candles";
import {reviewMarketEvidence} from "@/lib/trading/analysis";
import styles from "@/app/workspace/terminal/terminal.module.css";

async function read<T>(url:string,signal?:AbortSignal):Promise<T>{
 const response=await fetch(url,{signal,cache:"no-store"});
 if(!response.ok)throw Error("A required Nado evidence source is unavailable.");
 return response.json() as Promise<T>;
}
const number=(n:number,precision=2)=>new Intl.NumberFormat("en-US",{maximumFractionDigits:precision}).format(n);

export function TerminalTradeResearch({productId,side,notional,leverage}:{
 productId:number;side:"long"|"short";notional:number;leverage:number;
}){
 const candles=useQuery({
  queryKey:["nado-candlesticks",productId,"15m"],
  queryFn:({signal})=>read<HistoricalCandleResponse>("/api/nado/candles?productId="+productId+"&interval=15m",signal),
  staleTime:30_000,refetchInterval:60_000,retry:1,
 });
 const engine=useQuery({
  queryKey:["nado-engine-quote",productId],
  queryFn:({signal})=>read<EngineMarketEvidence>("/api/nado/quote?productId="+productId,signal),
  staleTime:5_000,refetchInterval:15_000,retry:1,
 });
 const result=reviewMarketEvidence({productId,side,notional,leverage,
  candles:candles.data??null,engine:engine.data??null});
 const pending=candles.isPending||engine.isPending;
 const observed=result.status==="observed"&&!candles.isError&&!engine.isError&&!pending;
 const reasons=[...(candles.isError?["Historical price data could not be loaded."]:[]),
  ...(engine.isError?["Nado top-of-book could not be loaded."]:[]),...result.reasons];
 const metrics=observed?result.metrics:null;
 return <section className={styles.researchDesk} aria-label="Agent read-only market evidence review">
  <div className={styles.researchHeader}><div><strong>Agent evidence review</strong>
    <small>Cross-checking real Nado 15m OHLCV against official engine bid/ask</small></div>
    <span className={styles.researchStatus}>{pending?"READING":observed?"OBSERVED · NOT APPROVED":"EVIDENCE INCOMPLETE"}</span>
  </div>
  <div className={styles.researchSummary}>
   {pending?<p role="status">Reading two independent Nado data interfaces. No assumptions until results return.</p>:
    observed?<p><ShieldCheck size={16}/> Historical candles and official engine top-of-book passed the read-only review. This does <strong>not</strong> verify your trading account, margin, fees, depth or execution.</p>:
    <p role="status"><ShieldAlert size={16}/> This draft has insufficient reliable market evidence. No trading-safety conclusion can be made.</p>}
  </div>
  {metrics?<div className={styles.researchMetrics}>
    <div><span>{side==="long"?"Observed best ask":"Observed best bid"}</span><strong>${number(metrics.referencePrice,6)}</strong></div>
    <div><span>Top-of-book spread</span><strong>{number(metrics.observedSpreadPct,3)}%</strong></div>
    <div><span>20-bar moving average</span><strong>${number(metrics.sma20,6)}</strong></div>
    <div><span>Last close vs SMA</span><strong>{number(metrics.deviationFromSmaPct,2)}%</strong></div>
    <div><span>Observed 15m range</span><strong>${number(metrics.observedRangeLow,4)} – ${number(metrics.observedRangeHigh,4)}</strong></div>
    <div><span>Indicative base size</span><strong>{number(metrics.estimatedBaseQuantity,8)}</strong></div>
   </div>:<div className={styles.researchReasons}>
     {reasons.slice(0,5).map((reason,i)=><p key={i}>{reason}</p>)}
    </div>}
  <div className={styles.researchLock}><LockKeyhole size={16}/>
   <span>No authenticated account assessment, fees/slippage/depth verification, venue simulation, signatures or execution. This is not an AI trade recommendation.</span>
  </div>
 </section>;
}
