"use client";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { ArrowUpRight, Droplets, RefreshCw, Search, ShieldAlert, Wallet, Landmark, Info } from "lucide-react";
import { ink } from "@/lib/ink";
import {observeTydroHealth} from "@/lib/tydro/health-policy";
import type { TydroAccountResponse, TydroMarketsResponse } from "@/lib/tydro/types";

async function getJson<T>(url:string,signal?:AbortSignal):Promise<T>{
  const response=await fetch(url,{cache:"no-store",signal});
  if(!response.ok){
    const payload:unknown=await response.json().catch(()=>null);
    throw new Error(payload&&typeof payload==="object"&&"error" in payload?String(payload.error):"Tydro request failed");
  }
  return response.json() as Promise<T>;
}
function formatAmount(value:string,digits=5){
  const n=Number(value);
  return Number.isFinite(n)?new Intl.NumberFormat("en-US",{maximumFractionDigits:digits}).format(n):value;
}
function percent(n:number){return Number.isFinite(n)?n.toFixed(2)+"%":"Unavailable";}
function age(iso:string){return new Date(iso).toLocaleTimeString();}
function ReadWarnings({warnings}:{warnings:string[]}){
  if(!warnings.length)return null;
  return <div className="nado-warning" role="status"><ShieldAlert size={18}/><div><strong>Partial Tydro information</strong>{warnings.map((warning,i)=><p key={i}>{warning}</p>)}</div></div>;
}
function MarketPanel(){
  const [query,setQuery]=useState("");
  const {data,error,isPending,isFetching,refetch}=useQuery({
    queryKey:["tydro-markets"],
    queryFn:({signal})=>getJson<TydroMarketsResponse>("/api/tydro/markets",signal),
    staleTime:30000,refetchInterval:60000,retry:1,
  });
  const shown=useMemo(()=>(data?.reserves??[]).filter(r=>
    r.symbol.toLowerCase().includes(query.toLowerCase())||
    r.address.toLowerCase().includes(query.toLowerCase())
  ),[data,query]);
  return <section className="nado-section" aria-labelledby="tydro-markets-title">
    <div className="nado-heading"><div><span className="eyebrow">TYDRO / INK CONTRACT DATA</span><h2 id="tydro-markets-title">Lending markets</h2><p>Read-only rates, market totals and collateral parameters directly from the Tydro Pool data provider. Rates are indicative variable APR, not promised yield.</p></div>
      <button className="btn btn-secondary" type="button" onClick={()=>void refetch()} disabled={isFetching}><RefreshCw size={15}/> Refresh</button>
    </div>
    <div className="nado-toolbar"><label className="nado-search"><Search size={15}/><span className="sr-only">Search lending assets</span><input type="search" placeholder="Search Tydro assets" value={query} onChange={e=>setQuery(e.target.value)}/></label><span className="tydro-live-tag"><span className="connected-dot"/> INK MAINNET / READ-ONLY</span></div>
    {isPending?<div className="nado-state" role="status">Reading Tydro reserves from Ink…</div>:
      error?<div className="nado-state nado-error" role="alert">{error.message} <button onClick={()=>void refetch()} type="button">Try again</button></div>:
      data&&<>
        <ReadWarnings warnings={data.warnings}/>
        <div className="nado-scroll"><table className="nado-table tydro-table"><thead><tr><th>Asset</th><th>Supply APR</th><th>Borrow APR</th><th>Supplied</th><th>Borrowed</th><th>Collateral LTV</th><th>Status</th></tr></thead>
          <tbody>{shown.map(m=><tr key={m.address}>
            <td><strong>{m.symbol}</strong><small title={m.address}>{m.address.slice(0,8)}…{m.address.slice(-5)}</small></td>
            <td className="positive">{percent(m.supplyAprPct)}</td><td>{m.borrowEnabled?percent(m.borrowAprPct):"—"}</td>
            <td>{formatAmount(m.supplied,3)} <small>{m.symbol}</small></td><td>{formatAmount(m.borrowed,3)} <small>{m.symbol}</small></td>
            <td>{m.collateralEligible?percent(m.ltvPct):"Not eligible"}</td>
            <td><span className={"tydro-status "+(!m.active||m.frozen?"tydro-paused":"")}>{!m.active?"Inactive":m.frozen?"Frozen":m.borrowEnabled?"Active":"Supply only"}</span></td>
          </tr>)}</tbody></table>{shown.length===0&&<div className="nado-state">No Tydro markets match this search.</div>}</div>
        <div className="nado-source">Source: verified Tydro Pool & data-provider contracts · {data.reserves.length} listed reserves · Last read {age(data.updatedAt)} · Rates can change</div>
      </>
    }
  </section>;
}
function AccountPanel(){
  const {address,isConnected,chainId}=useAccount();
  const onInk=isConnected&&chainId===ink.id;
  const {data,isPending,error,isFetching,refetch}=useQuery({
    queryKey:["tydro-account",address?.toLowerCase()],
    queryFn:({signal})=>getJson<TydroAccountResponse>("/api/tydro/account?address="+encodeURIComponent(address!),signal),
    enabled:Boolean(onInk&&address),
    staleTime:30000,refetchInterval:onInk?60000:false,retry:1,
  });
  const health=data?observeTydroHealth({debtBase:data.debtBase,healthFactor:data.healthFactor,incomplete:data.incomplete,warnings:data.warnings}):null;
  return <section className="nado-section" aria-labelledby="tydro-account-title">
    <div className="nado-heading"><div><span className="eyebrow">TYDRO / PUBLIC ACCOUNT DATA</span><h2 id="tydro-account-title">Lending health & positions</h2><p>View on-chain supply balances, variable debt and your Tydro health factor. Nado and Tydro positions are not cross-margined.</p></div>
      {onInk&&<button className="btn btn-secondary" type="button" disabled={isFetching} onClick={()=>void refetch()}><RefreshCw size={15}/> Refresh</button>}
    </div>
    {!onInk?<div className="nado-state nado-wallet-state"><Wallet size={22}/><strong>Connect your Ink wallet</strong><span>Symb-II will read publicly available Tydro balances without a signature or permission request.</span></div>:
      isPending?<div className="nado-state" role="status">Reading your Tydro lending account on Ink…</div>:
      error?<div className="nado-state nado-error" role="alert">{error.message} <button type="button" onClick={()=>void refetch()}>Try again</button></div>:
      data&&<>
        <ReadWarnings warnings={data.warnings}/>
        <div className="tydro-account-cards">
          <div className="tydro-metric tydro-health"><span><ShieldAlert size={15}/> {health?.label??"Health unknown"}</span><strong className={health?.state==="critical"||health?.state==="elevated"?"tydro-risk":""}>{health?.display??"Unavailable"}</strong><small>{health?.state==="unknown"?"Missing or contradictory account evidence; no safety conclusion can be made.":health?.state==="no-debt"?"No debt reported in the complete on-chain snapshot.":"Liquidation risk rises as health approaches 1.0. No future health is guaranteed."}</small></div>
          <div className="tydro-metric"><span>Total collateral</span><strong>{formatAmount(data.collateralBase,2)}</strong><small>{data.baseCurrency}, not necessarily USD</small></div>
          <div className="tydro-metric"><span>Total debt</span><strong>{formatAmount(data.debtBase,2)}</strong><small>{data.baseCurrency}, not necessarily USD</small></div>
          <div className="tydro-metric"><span>Borrow capacity left</span><strong>{formatAmount(data.availableBorrowsBase,2)}</strong><small>Current on-chain snapshot; not a borrowing guarantee</small></div>
        </div>
        <div className="tydro-parameters"><span>Weighted liquidation threshold <strong>{percent(data.liquidationThresholdPct)}</strong></span><span>Account LTV <strong>{percent(data.ltvPct)}</strong></span><span>Last read <strong>{age(data.updatedAt)}</strong></span></div>
        <div className="tydro-subheading"><h3>Your supply & borrowing balances</h3><p>Displayed in native token units; stable and variable debt are shown separately.</p></div>
        {data.userReserves.length?<div className="nado-scroll"><table className="nado-table"><thead><tr><th>Asset</th><th>Supplied</th><th>Variable debt</th><th>Stable debt</th><th>Collateral enabled</th></tr></thead>
          <tbody>{data.userReserves.map(r=><tr key={r.address}><td><strong>{r.symbol}</strong></td><td>{formatAmount(r.supplied)}</td><td>{formatAmount(r.variableDebt)}</td><td>{formatAmount(r.stableDebt)}</td><td>{r.usingAsCollateral?"Yes":"No"}</td></tr>)}</tbody>
        </table></div>:<div className="nado-state">No Tydro supply or borrow balances found for this wallet in the successfully queried reserves.</div>}
        <div className="nado-source">The health factor is provided by Tydro's Pool contract. No liquidation price, guaranteed return, simulated capital or combined Nado/Tydro margin is inferred from these readings.</div>
      </>
    }
  </section>;
}
export function TydroPanel(){
  return <div className="nado-panels tydro-panels" id="tydro">
    <div className="nado-section-title"><span className="nado-ready">M03 / ONCHAIN</span><div><h2>Tydro integration</h2><p>Supply, borrowing and protocol-specific risk directly from Ink.</p></div><a href="https://app.tydro.com/" target="_blank" rel="noreferrer">Open Tydro <ArrowUpRight size={14}/></a></div>
    <div className="tydro-explain"><Droplets size={18}/><span>Symb-II displays Tydro data without creating a new lending protocol, moving funds or requesting approval. Lending actions and cross-protocol risk simulations are later milestones.</span></div>
    <MarketPanel/><AccountPanel/>
  </div>;
}
