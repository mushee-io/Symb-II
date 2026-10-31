"use client";

import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {useAccount} from "wagmi";
import {AlertTriangle,ArrowUpRight,RefreshCw,Wallet} from "lucide-react";
import Link from "next/link";
import {ink} from "@/lib/ink";
import type {NadoAccountResponse} from "@/lib/nado/types";
import type {TydroAccountResponse} from "@/lib/tydro/types";
import styles from "@/app/workspace/terminal/terminal.module.css";

async function read<T>(path:string,signal?:AbortSignal):Promise<T>{
  const response=await fetch(path,{signal,cache:"no-store"});
  if(!response.ok)throw new Error("Provider request failed (HTTP "+response.status+"). No substitute positions or orders.");
  return response.json() as Promise<T>;
}
function fresh(iso:string){
  const age=Date.now()-Date.parse(iso);
  return Number.isFinite(age)&&age>=0&&age<180_000;
}
function tableDate(seconds:number|null){return seconds?new Date(seconds*1000).toLocaleString():"Unavailable";}
function textAmount(value:string){const amount=Number(value);return Number.isFinite(amount)?amount.toLocaleString(undefined,{maximumFractionDigits:6}):"Unavailable";}

export function TerminalAccountDesk(){
  const {address,chainId,isConnected}=useAccount();
  const active=Boolean(address&&isConnected&&chainId===ink.id);
  const [tab,setTab]=useState<"positions"|"orders"|"history"|"lending">("positions");
  const nado=useQuery({
    queryKey:["nado-account",address?.toLowerCase()],
    queryFn:({signal})=>read<NadoAccountResponse>("/api/nado/account?address="+encodeURIComponent(address!),signal),
    enabled:active,retry:1,staleTime:30000,refetchInterval:active?60000:false,
  });
  const tydro=useQuery({
    queryKey:["tydro-account",address?.toLowerCase()],
    queryFn:({signal})=>read<TydroAccountResponse>("/api/tydro/account?address="+encodeURIComponent(address!),signal),
    enabled:active&&tab==="lending",retry:1,staleTime:30000,refetchInterval:active&&tab==="lending"?60000:false,
  });
  const n=nado.data;
  const t=tydro.data;
  const nComplete=Boolean(n&&n.chainId===57073&&n.address.toLowerCase()===address?.toLowerCase()&&
    n.positionCoverageComplete&&!n.incomplete&&n.warnings.length===0&&fresh(n.updatedAt));
  const tComplete=Boolean(t&&t.chainId===57073&&t.address.toLowerCase()===address?.toLowerCase()&&
    !t.incomplete&&t.warnings.length===0&&fresh(t.updatedAt));
  const tabs=[["positions","Positions"],["orders","Open orders"],["history","Indexed history"],["lending","Tydro lending"]] as const;
  const orderRows=tab==="orders"?n?.openOrders:n?.indexedOrders;
  const noData=(message:string)=><p className={styles.muted}>{message}</p>;
  return <section className={styles.positions} aria-label="Unified Nado and Tydro account desk">
    <div className={styles.panelTop}>
      <strong>Account activity · Nado + Tydro</strong>
      <span>{active&&address?address.slice(0,6)+"…"+address.slice(-4):"No connected Ink wallet"}</span>
    </div>
    <div className={styles.accountTabs} role="tablist" aria-label="Account activity views">
      {tabs.map(([key,label])=><button type="button" role="tab" key={key} aria-selected={tab===key}
        className={tab===key?styles.activeTab:""} onClick={()=>setTab(key)}>{label}</button>)}
      <button type="button" className={styles.accountRefresh}
        disabled={!active||nado.isFetching||tydro.isFetching}
        onClick={()=>void (tab==="lending"?tydro.refetch():nado.refetch())}>
        <RefreshCw size={13}/> Refresh
      </button>
    </div>
    {!active?<div className={styles.positionsEmpty}><Wallet size={18}/>
      <p>Connect a wallet on Ink mainnet to read its public protocol records. No signatures or spending permissions are requested.</p>
    </div>:
    tab==="lending"?(
      tydro.isPending?noData("Reading on-chain Tydro Pool account…"):
      tydro.error?<p className={styles.warning} role="alert">{tydro.error.message}</p>:
      t?<div>
        {!tComplete&&<p className={styles.warning} role="status"><AlertTriangle size={14}/> Tydro evidence is missing, stale or incomplete. No safe health status can be inferred.</p>}
        <div className={styles.accountMetrics}>
          <span>Collateral <strong>{tComplete?textAmount(t.collateralBase):"Unavailable"}</strong><small>Oracle base units, not USD</small></span>
          <span>Debt <strong>{tComplete?textAmount(t.debtBase):"Unavailable"}</strong><small>Oracle base units, not USD</small></span>
          <span>Health factor <strong>{tComplete?(t.healthFactor===null?(Number(t.debtBase)===0?"No active debt":"Unknown"):textAmount(t.healthFactor)+"×"):"Unknown"}</strong><small>Liquidation risk below 1.0</small></span>
        </div>
        {t.userReserves.length?<div className={styles.tableScroll}><table><thead><tr><th>Asset</th><th>Supplied</th><th>Variable debt</th><th>Stable debt</th><th>Collateral</th></tr></thead>
          <tbody>{t.userReserves.map(r=><tr key={r.address}><td>{r.symbol}</td><td>{textAmount(r.supplied)}</td><td>{textAmount(r.variableDebt)}</td><td>{textAmount(r.stableDebt)}</td><td>{r.usingAsCollateral?"Yes":"No"}</td></tr>)}</tbody></table></div>:
          noData("No Tydro positions in the queried reserves. This is not proof of a risk-free wallet.")}
        <p className={styles.muted}><Link href="/workspace/tydro">Full lending details <ArrowUpRight size={12}/></Link></p>
      </div>:noData("No Tydro account evidence returned.")
    ):(
      nado.isPending?noData("Reading indexed Nado account records…"):
      nado.error?<p className={styles.warning} role="alert">{nado.error.message}</p>:
      n?<div>
        {!nComplete&&<p className={styles.warning} role="status"><AlertTriangle size={14}/> Nado coverage is stale, missing or partial. Do not infer that missing orders or positions mean zero exposure. {n.warnings.join(" ")}</p>}
        {tab==="positions"?(n.positions.length?
          <div className={styles.tableScroll}><table><thead><tr><th>Market</th><th>Side</th><th>Size</th><th>Entry</th><th>Margin mode</th><th>Subaccount</th></tr></thead>
          <tbody>{n.positions.slice(0,40).map(p=><tr key={p.subaccount+p.id+p.productId}><td>{p.symbol}</td><td>{p.side.toUpperCase()}</td><td>{textAmount(p.size)}</td><td>{textAmount(p.entryPrice)}</td><td>{p.marginMode}</td><td>{p.subaccount.slice(0,12)}…</td></tr>)}</tbody></table></div>:
          noData("No open positions found in available indexed records.")):
          orderRows?.length?<div className={styles.tableScroll}><table><thead><tr><th>Market</th><th>Side</th><th>Size</th><th>Price</th><th>Timestamp</th></tr></thead>
            <tbody>{orderRows.slice(0,40).map(o=><tr key={o.subaccount+o.id+o.productId}><td>{o.symbol}</td><td>{o.side.toUpperCase()}</td><td>{textAmount(o.size)}</td><td>{textAmount(o.price)}</td><td>{tableDate(o.timestamp)}</td></tr>)}</tbody></table></div>:
          noData("No "+(tab==="orders"?"open":"indexed")+" orders in the available Nado records.")}
        <p className={styles.muted}>Nado engine/indexer snapshot · {new Date(n.updatedAt).toLocaleString()} · <Link href="/workspace/nado">Complete account view <ArrowUpRight size={12}/></Link></p>
      </div>:noData("No Nado account evidence returned.")
    )}
  </section>;
}
