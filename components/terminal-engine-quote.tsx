"use client";

import {useQuery} from "@tanstack/react-query";
import {assessTopOfBook} from "@/lib/trading/quote";
import type {EngineMarketEvidence} from "@/lib/preflight/nado-evidence";
import styles from "@/app/workspace/terminal/terminal.module.css";

async function loadQuote(productId:number,signal?:AbortSignal):Promise<EngineMarketEvidence>{
  const response=await fetch("/api/nado/quote?productId="+productId,{signal,cache:"no-store"});
  if(!response.ok)throw Error("Nado engine quote unavailable");
  return response.json() as Promise<EngineMarketEvidence>;
}
const money=(n:number)=>"$"+new Intl.NumberFormat("en-US",{maximumFractionDigits:n<1?6:2}).format(n);

export function TerminalEngineQuote({productId}:{productId:number}){
  const q=useQuery({
    queryKey:["nado-engine-quote",productId],
    queryFn:({signal})=>loadQuote(productId,signal),
    enabled:Number.isSafeInteger(productId)&&productId>=0,
    staleTime:5000,refetchInterval:15000,retry:1,
  });
  const observation=assessTopOfBook(q.data??null,productId);
  return <section className={styles.engineQuote} aria-label="Official Nado engine bid and ask">
    <div className={styles.tapeHead}><strong>Nado top of book</strong><small>Official engine · 15-second refresh · Not a firm execution quote</small></div>
    {q.isPending?<p className={styles.muted}>Reading the live engine bid and ask…</p>:
      q.error?<p className={styles.warning} role="status">Nado engine evidence unavailable. No bid/ask or spread can be verified.</p>:
      observation.status==="unknown"?<p className={styles.warning} role="status">{observation.reason}</p>:
      <div className={styles.engineQuoteMetrics}>
        <span><small>Best bid</small><strong>{money(observation.bid)}</strong></span>
        <span><small>Best ask</small><strong>{money(observation.ask)}</strong></span>
        <span><small>Observed spread</small><strong>{observation.spreadPct.toFixed(3)}%</strong></span>
      </div>}
    <p className={styles.muted}>One official engine observation; no depth, fees, guaranteed fills, position allowance or post-trade margin verification. No order is submitted.</p>
  </section>;
}
