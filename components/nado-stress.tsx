"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowDownUp, AlertTriangle } from "lucide-react";
import type { NadoAccountResponse, NadoMarketsResponse } from "@/lib/nado/types";
import { nadoPositionKey, simulateNadoFromFeeds } from "@/lib/risk/nado-stress";

async function getLiveMarkets(signal?: AbortSignal):Promise<NadoMarketsResponse>{
  const response=await fetch("/api/nado/markets",{signal,cache:"no-store"});
  if(!response.ok) throw new Error("Nado tickers could not be loaded.");
  return response.json() as Promise<NadoMarketsResponse>;
}
function formatted(n:string){
  const value=Number(n);
  return Number.isFinite(value)?value.toLocaleString("en-US",{maximumFractionDigits:6}):"—";
}

export function NadoStress({ account }:{ account:NadoAccountResponse }){
  const [shock,setShock]=useState(-20);
  const [chosen,setChosen]=useState("");
  const {data:markets,error,isPending,refetch}=useQuery({
    queryKey:["nado-markets"],
    queryFn:({signal})=>getLiveMarkets(signal),
    staleTime:15000,refetchInterval:30000,retry:1,
  });
  const positions=account.positions.filter(p=>markets?.markets.some(m=>m.productId===p.productId&&m.type==="perp"));
  const key=positions.some(p=>nadoPositionKey(p)===chosen)?chosen:(positions[0]?nadoPositionKey(positions[0]):"");
  const result=markets?simulateNadoFromFeeds(account,markets,key,shock):null;
  return <div className="stress-panel nado-stress" id="nado-stress">
    <div className="stress-heading"><span className="stress-emblem"><Activity size={20}/></span>
      <div><span className="eyebrow">NADO ONLY / LINEAR PERP WHAT-IF</span>
        <h3>Nado position sensitivity</h3>
        <p>Estimate the <strong>change in position PnL</strong> if a Nado perpetual ticker moves. This is not a liquidation or margin-health calculation.</p>
      </div>
    </div>
    {isPending?<div className="nado-state" role="status">Loading matching Nado perp quotes…</div>:
      error?<div className="stress-unavailable" role="alert"><AlertTriangle size={17}/><span>{error.message} <button className="risk-retry" type="button" onClick={()=>void refetch()}>Retry</button></span></div>:
      positions.length===0?<div className="stress-unavailable"><AlertTriangle size={17}/><span>No Nado open perpetual positions have live matching tickers for this wallet. No synthetic trades are shown.</span></div>:
      <>
        <div className="stress-controls">
          <label className="stress-field"><span>Open Nado position</span>
            <select value={key} onChange={e=>setChosen(e.target.value)}>
              {positions.map(p=><option value={nadoPositionKey(p)} key={nadoPositionKey(p)}>
                {p.symbol} · {p.side.toUpperCase()} · {p.subaccount}
              </option>)}
            </select>
          </label>
          <div className="stress-field"><span>Hypothetical ticker move</span>
            <div className="stress-range"><input type="range" min={-50} max={50} step={1} value={shock} aria-label="Nado hypothetical perp ticker change" onChange={e=>setShock(Number(e.target.value))}/>
              <strong className={shock<0?"negative":"positive"}>{shock>0?"+":""}{shock}%</strong>
            </div>
            <div className="stress-presets">{[-40,-20,-10,10,20].map(n=><button key={n} type="button" aria-pressed={shock===n} className={shock===n?"selected":""} onClick={()=>setShock(n)}>{n>0?"+":""}{n}%</button>)}</div>
          </div>
        </div>
        {result?.ok?<div className="stress-result">
          <div><span>Current ticker reference price</span><strong>{formatted(result.lastPrice)} <small>{result.quote}</small></strong></div>
          <ArrowDownUp size={18}/>
          <div><span>Hypothetical change in PnL</span><strong className={Number(result.pnlChange)<0?"stress-urgent":""}>{Number(result.pnlChange)>0?"+":""}{formatted(result.pnlChange)} <small>{result.quote}</small></strong></div>
        </div>:<div className="stress-unavailable"><AlertTriangle size={17}/><span>{result?.reason??"Market price data unavailable."}</span></div>}
        {result?.ok&&<p className="stress-footnote">Linear base quantity {formatted(result.baseSize)} · Quote notional {formatted(result.referenceNotional)} {result.quote} · Shocked ticker {formatted(result.shockedPrice)} {result.quote}. Uses last-trade ticker, not a guaranteed mark or fill price.</p>}
      </>
    }
    <div className="stress-disclaimer">Read-only educational estimate. The calculation does not account for mark/index divergence, funding, spreads, slippage, fees, leverage, collateral transfers, auto-deleveraging, liquidation tiers or other positions. Never substitute this result for Nado's official margin health.</div>
  </div>;
}
