"use client";

import {useQuery} from "@tanstack/react-query";
import {RefreshCw,ShieldAlert} from "lucide-react";
import {assessTopOfBook} from "@/lib/trading/quote";
import type {EngineMarketEvidence} from "@/lib/preflight/nado-evidence";
import styles from "@/app/workspace/terminal/terminal.module.css";

async function readEngine(productId:number,signal?:AbortSignal):Promise<EngineMarketEvidence>{
 const response=await fetch("/api/nado/quote?productId="+productId,{signal,cache:"no-store"});
 if(!response.ok)throw Error("Official Nado order-book quote unavailable.");
 return response.json() as Promise<EngineMarketEvidence>;
}
const price=(amount:number)=>new Intl.NumberFormat("en-US",{maximumFractionDigits:amount<1?6:2}).format(amount);

/**
 * Only the genuine official top-of-book quote is exposed by the current API.
 * Never fabricate a level-2 ladder or invented sizes to imitate a venue UI.
 */
export function TerminalOrderBook({productId}:{productId:number}){
 const quote=useQuery({
  queryKey:["nado-engine-quote",productId],
  queryFn:({signal})=>readEngine(productId,signal),
  enabled:Number.isSafeInteger(productId)&&productId>=0,
  staleTime:5000,refetchInterval:15000,retry:1,
 });
 const observation=assessTopOfBook(quote.data??null,productId);
 return <section className={styles.orderBook} aria-label="Nado official top-of-book pricing">
  <div className={styles.panelTop}><strong>Order book</strong><small>OFFICIAL ENGINE / L1</small></div>
  <div className={styles.bookModes}><span className={styles.bookModeActive}>BOOK</span><span>TRADES</span><span className={styles.bookRefresh}><button type="button" aria-label="Refresh Nado order book" disabled={quote.isFetching} onClick={()=>void quote.refetch()}><RefreshCw size={14}/></button></span></div>
  <div className={styles.bookLabels}><span>PRICE</span><span>LIVE LEVEL</span></div>
  {quote.isPending?<p className={styles.muted} role="status">Loading verified Nado engine prices…</p>:
   quote.error?<p className={styles.warning} role="status">{quote.error.message}</p>:
   observation.status==="unknown"?<p className={styles.warning} role="status">{observation.reason}</p>:
   <>
    <div className={styles.sellLadder} aria-label="Current best ask">
     <div className={styles.bookRow}><span>{price(observation.ask)}</span><span>BEST ASK</span></div>
    </div>
    <div className={styles.bookMid}>
     <strong>{price((observation.ask+observation.bid)/2)}</strong>
     <small>Midpoint · indicative</small>
     <span>Spread {observation.spreadPct.toFixed(3)}%</span>
    </div>
    <div className={styles.buyLadder} aria-label="Current best bid">
     <div className={styles.bookRow}><span>{price(observation.bid)}</span><span>BEST BID</span></div>
    </div>
   </>}
  <div className={styles.bookNotice}><ShieldAlert size={15}/>
   <p>Best bid and ask only. Nado market depth and order sizes are not supplied by this integration, so no additional price levels are invented.</p>
  </div>
  <div className={styles.bookEnd}>INK · NADO ENGINE · 15S REFRESH<br/>OBSERVATION ONLY / NO ORDER ROUTING</div>
 </section>;
}
