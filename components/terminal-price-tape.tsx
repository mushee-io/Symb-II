"use client";

import {useEffect,useMemo,useState} from "react";
import {chartPoints,recordPriceObservation,type PriceObservation} from "@/lib/trading/observations";
import styles from "@/app/workspace/terminal/terminal.module.css";

export function TerminalPriceTape({productId,price,updatedAt}:{productId:number;price:number;updatedAt:string}){
  const [samples,setSamples]=useState<PriceObservation[]>([]);
  useEffect(()=>{
    const at=Date.parse(updatedAt);
    if(Number.isFinite(at))setSamples(old=>recordPriceObservation(old,{productId,price,at}));
  },[productId,price,updatedAt]);
  const selected=useMemo(()=>chartPoints(samples,productId),[samples,productId]);
  const first=selected[0],last=selected[selected.length-1];
  const yMin=Math.min(...selected.map(p=>p.price));
  const yMax=Math.max(...selected.map(p=>p.price));
  const xMin=first?.at??0,xMax=last?.at??0;
  const chart=selected.length>=2 && xMax>xMin;
  const values=chart?selected.map(p=>{
    const x=12+776*(p.at-xMin)/(xMax-xMin);
    const y=100-84*(p.price-yMin)/(yMax-yMin||1);
    return x.toFixed(2)+","+y.toFixed(2);
  }).join(" "):"";
  return <section className={styles.priceTape} aria-label="Observed Nado price snapshots">
    <div className={styles.tapeHead}><strong>Observed price tape</strong><small>{selected.length} actual snapshots · Since this page opened · Not candlesticks</small></div>
    {chart?<svg viewBox="0 0 800 116" role="img" aria-label={"Observed Nado price movement from "+first.price+" to "+last.price}>
      <line x1="12" x2="788" y1="100" y2="100" stroke="#415b49" strokeWidth="1"/>
      <polyline points={values} stroke="#b6eec4" strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>:
    <p className={styles.muted} role="status">Waiting for at least two independently retrieved market snapshots. No synthetic chart history is shown.</p>}
    {chart&&<div className={styles.tapeFoot}><span>First: {new Date(xMin).toLocaleTimeString()}</span><span>Latest: {new Date(xMax).toLocaleTimeString()}</span></div>}
  </section>;
}
