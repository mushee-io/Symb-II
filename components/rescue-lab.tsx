"use client";

import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {AlertTriangle, ArrowDownRight, ArrowRight, CircleAlert, RefreshCw, ShieldCheck, SlidersHorizontal} from "lucide-react";
import BigNumber from "bignumber.js";
import type {NadoAccountResponse,NadoMarketsResponse} from "@/lib/nado/types";
import type {TydroAccountResponse} from "@/lib/tydro/types";
import {nadoPositionKey} from "@/lib/risk/nado-stress";
import {reviewNadoReduction,reviewTydroDebtReduction} from "@/lib/risk/rescue";

const nadoSizes=[10,25,50,75] as const;
const debtSizes=[10,25,50,75] as const;
const shocks=[-40,-20,-10,10,20] as const;
function showQuantity(value:string,digits=4){
  try{
    const n=new BigNumber(value);
    if(!n.isFinite())return "Unavailable";
    return n.decimalPlaces(digits,BigNumber.ROUND_HALF_UP).toFormat();
  }catch{return "Unavailable";}
}
async function fetchMarkets(signal?:AbortSignal):Promise<NadoMarketsResponse>{
  const response=await fetch("/api/nado/markets",{cache:"no-store",signal});
  if(!response.ok)throw new Error("Nado market prices unavailable");
  return response.json() as Promise<NadoMarketsResponse>;
}
function Assumptions({items}:{items:string[]}){
  return <div className="rescue-assumptions"><strong>Model limitations</strong>
    <ul>{items.map((item,i)=><li key={i}>{item}</li>)}</ul>
  </div>;
}

export function RescueLab({nado,tydro,wallet}:{
  nado:NadoAccountResponse|undefined;
  tydro:TydroAccountResponse|undefined;
  wallet:string;
}){
  const [selected,setSelected]=useState("");
  const [reduction,setReduction]=useState<(typeof nadoSizes)[number]>(50);
  const [shock,setShock]=useState<(typeof shocks)[number]>(-20);
  const [repayment,setRepayment]=useState<(typeof debtSizes)[number]>(25);
  const {data:markets,error:marketError,isPending:marketLoading,refetch,isFetching}=useQuery({
    queryKey:["nado-markets"],
    queryFn:({signal})=>fetchMarkets(signal),
    enabled:Boolean(nado),
    staleTime:15000,refetchInterval:30000,retry:1,
  });
  // Use independently fetched, provider-owned account feeds for each protocol.
  const walletMatch=(address:string)=>address.toLowerCase()===wallet.toLowerCase();
  const currentNado=nado&&walletMatch(nado.address)?nado:undefined;
  const currentTydro=tydro&&walletMatch(tydro.address)?tydro:undefined;
  const positions=(currentNado?.positions??[]).filter(p=>markets?.markets.some(m=>m.type==="perp"&&m.productId===p.productId));
  const positionKey=positions.some(p=>nadoPositionKey(p)===selected)?selected:
    (positions[0]?nadoPositionKey(positions[0]):"");
  const tradeScenario=currentNado&&markets?reviewNadoReduction({
    account:currentNado,markets,positionKey,reductionPct:reduction,shockPct:shock
  }):null;
  const lendingScenario=currentTydro?reviewTydroDebtReduction(currentTydro,repayment):null;

  return <section id="portfolio-rescue" className="rescue-lab" aria-labelledby="rescue-title">
    <div className="rescue-head">
      <div><span className="eyebrow">M06 PREVIEW / READ-ONLY WHAT-IF TOOLS</span>
        <h2 id="rescue-title">Portfolio Rescue Lab<span className="title-period">.</span></h2>
        <p>Compare bounded risk sensitivities before considering any action. Nado positions and Tydro loans remain independent; nothing here places orders, repays debt or transfers collateral.</p>
      </div>
      <span className="rescue-lock"><ShieldCheck size={16}/> NO TRANSACTIONS</span>
    </div>
    <div className="rescue-grid">
      <div className="rescue-protocol">
        <div className="rescue-protocol-header"><span className="rescue-indicator nado"/> <div><strong>Nado</strong><small>Perpetual size sensitivity</small></div></div>
        <p className="rescue-description">Review what your *hypothetical PnL change* under a fixed ticker shock might look like if an existing position were smaller.</p>
        {!currentNado?<div className="rescue-empty"><CircleAlert size={16}/> Nado wallet data is not available or does not match this wallet.</div>:
          marketLoading?<div className="rescue-empty">Loading reference ticker data…</div>:
          marketError?<div className="rescue-empty"><AlertTriangle size={16}/> Tickers are unavailable. <button type="button" onClick={()=>void refetch()} disabled={isFetching}>Retry</button></div>:
          positions.length===0?<div className="rescue-empty">No matching open Nado perpetual positions. No hypothetical holdings are created.</div>:
          <>
            <label className="rescue-field">Position
              <select value={positionKey} onChange={e=>setSelected(e.target.value)}>
                {positions.map(p=><option key={nadoPositionKey(p)} value={nadoPositionKey(p)}>{p.symbol} · {p.side} · {p.subaccount}</option>)}
              </select>
            </label>
            <div className="rescue-field">Hypothetical reference price move
              <div className="rescue-presets">{shocks.map(s=><button key={s} type="button" aria-pressed={shock===s} onClick={()=>setShock(s)} className={shock===s?"selected":""}>{s>0?"+":""}{s}%</button>)}</div>
            </div>
            <div className="rescue-field">Review reduction in position size
              <div className="rescue-presets">{nadoSizes.map(s=><button key={s} type="button" aria-pressed={reduction===s} onClick={()=>setReduction(s)} className={reduction===s?"selected":""}>{s}%</button>)}</div>
            </div>
            {tradeScenario?.ok?<div className="rescue-scenario">
              <div><span>Original price-shock PnL sensitivity</span><strong>{showQuantity(tradeScenario.originalPositionSensitivity)} {tradeScenario.quote}</strong></div>
              <ArrowDownRight size={20} aria-hidden="true"/>
              <div><span>After hypothetical {tradeScenario.reductionPct}% size reduction</span><strong>{showQuantity(tradeScenario.remainingPositionSensitivity)} {tradeScenario.quote}</strong></div>
              <p>Illustrative remaining base quantity: {showQuantity(tradeScenario.remainingSize,6)}. This is not projected net profit, savings or margin health.</p>
            </div>:<div className="rescue-empty"><AlertTriangle size={16}/>{tradeScenario?.reason??"Unable to calculate the Nado what-if."}</div>}
            {tradeScenario?.ok&&<Assumptions items={tradeScenario.assumptions}/>}
          </>}
      </div>
      <div className="rescue-protocol">
        <div className="rescue-protocol-header"><span className="rescue-indicator tydro"/> <div><strong>Tydro</strong><small>Aggregate debt sensitivity</small></div></div>
        <p className="rescue-description">Review the mathematical effect on Tydro health if every outstanding debt balance decreased by the same percentage while collateral remained unchanged.</p>
        {!currentTydro?<div className="rescue-empty"><CircleAlert size={16}/> Tydro wallet data is not available or does not match this wallet.</div>:
          <>
            <div className="rescue-field">Hypothetical proportional reduction in total debt
              <div className="rescue-presets">{debtSizes.map(s=><button key={s} type="button" aria-pressed={repayment===s} onClick={()=>setRepayment(s)} className={repayment===s?"selected":""}>{s}%</button>)}</div>
            </div>
            {lendingScenario?.ok?<div className="rescue-scenario">
              <div><span>Current Tydro-reported health factor</span><strong>{showQuantity(lendingScenario.currentHealthFactor,3)}×</strong></div>
              <ArrowRight size={20} aria-hidden="true"/>
              <div><span>Mathematical health-factor sensitivity</span><strong>{showQuantity(lendingScenario.estimatedHealthFactor,3)}×</strong></div>
              <p>Baseline: {lendingScenario.currentRisk}. Scenario: {lendingScenario.estimatedRisk}. This does not establish repay feasibility, remaining borrowing capacity or liquidation protection.</p>
            </div>:<div className="rescue-empty"><AlertTriangle size={16}/>{lendingScenario?.reason??"Unable to calculate this Tydro scenario."}</div>}
            {lendingScenario?.ok&&<Assumptions items={lendingScenario.assumptions}/>}
          </>}
      </div>
    </div>
    <div className="rescue-conclusion"><SlidersHorizontal size={18}/>
      <div><strong>Review, don't execute</strong><p>These are two different single-protocol calculations, not a combined portfolio rescue transaction. No recommendation is made to trade, repay or add leverage. Inspect account risk and execution details on the official Nado/Tydro interfaces before making financial decisions.</p></div>
    </div>
  </section>;
}
