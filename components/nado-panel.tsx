"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { ArrowUpRight, RefreshCw, Search, Activity, ShieldAlert, Wallet, Clock3 } from "lucide-react";
import { ink } from "@/lib/ink";
import type { NadoMarketsResponse, NadoAccountResponse, NadoOrder } from "@/lib/nado/types";

async function request<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url,{ signal, cache:"no-store" });
  if (!response.ok) {
    const json: unknown = await response.json().catch(()=>null);
    const message = json && typeof json === "object" && "error" in json ? String(json.error) : "Nado request failed";
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
const fmt = (n:number,digits=2)=>new Intl.NumberFormat("en-US",{maximumFractionDigits:digits}).format(n);
const amount=(s:string)=>{const n=Number(s);return Number.isFinite(n)?fmt(n,6):s;};
const date=(n:number|null)=>n?new Date(n*1000).toLocaleString():"Unknown";
const stamp=(s:string)=>new Date(s).toLocaleTimeString();

function MarketExplorer() {
  const [search,setSearch]=useState("");
  const [marketType,setMarketType]=useState<"all"|"perp"|"spot">("all");
  const {data,isPending,error,refetch,isFetching}=useQuery({
    queryKey:["nado-markets"],
    queryFn:({signal})=>request<NadoMarketsResponse>("/api/nado/markets",signal),
    staleTime:15000,refetchInterval:30000,retry:1,
  });
  const shown=useMemo(()=>(data?.markets??[]).filter(m=>
    (marketType==="all"||m.type===marketType)&&
    (m.symbol+" "+m.base).toLowerCase().includes(search.toLowerCase())
  ).slice(0,30),[data,marketType,search]);
  return (
    <section className="nado-section" aria-labelledby="nado-market-title">
      <div className="nado-heading"><div><span className="eyebrow">NADO / PUBLIC MARKET DATA</span><h2 id="nado-market-title">Live markets</h2><p>Actual Nado indexer prices, 24-hour changes and volume. Refreshes approximately every 30 seconds.</p></div>
        <button type="button" className="btn btn-secondary" onClick={()=>void refetch()} disabled={isFetching}><RefreshCw size={15}/> Refresh</button>
      </div>
      <div className="nado-toolbar">
        <label className="nado-search"><Search size={15}/><span className="sr-only">Search markets</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search markets" aria-label="Search Nado markets"/></label>
        <div className="nado-tabs" role="group" aria-label="Market type">
          {(["all","perp","spot"] as const).map(t=><button key={t} type="button" onClick={()=>setMarketType(t)} aria-pressed={t===marketType} className={t===marketType?"nado-active":""}>{t==="all"?"All":t==="perp"?"Perpetuals":"Spot"}</button>)}
        </div>
      </div>
      {isPending?<div className="nado-state" role="status">Connecting to Nado market data…</div>:
        error?<div className="nado-state nado-error" role="alert">{error.message} <button type="button" onClick={()=>void refetch()}>Try again</button></div>:
        data&&data.markets.length===0?<div className="nado-state">The Nado indexer returned no available priced markets. No placeholder data is shown.</div>:
        <div className="nado-scroll"><table className="nado-table">
          <thead><tr><th>Market</th><th>Last price</th><th>24h change</th><th>24h volume</th><th>Type</th></tr></thead>
          <tbody>{shown.map(m=><tr key={m.productId}>
            <td><strong>{m.symbol}</strong><small>{m.base}/{m.quote}</small></td>
            <td>${fmt(m.lastPrice,m.lastPrice<1?6:2)}</td>
            <td className={m.change24h<0?"negative":"positive"}>{m.change24h>=0?"+":""}{fmt(m.change24h)}%</td>
            <td>${fmt(m.volume24h,0)}</td>
            <td><span className="nado-type">{m.type}</span></td>
          </tr>)}</tbody>
        </table>{shown.length===0&&<div className="nado-state">No matching markets in this view.</div>}</div>
      }
      {data&&<div className="nado-source">Source: Nado indexer · Retrieved {stamp(data.updatedAt)} · Showing up to 30 results · Not investment advice</div>}
    </section>
  );
}

function OrdersTable({orders}: {orders:NadoOrder[]}) {
  if(!orders.length)return <div className="nado-state">No orders found in the available Nado records. Historical orders include only indexed activity.</div>;
  return <div className="nado-scroll"><table className="nado-table"><thead><tr><th>Market</th><th>Side</th><th>Size</th><th>Price</th><th>{orders[0]?.kind==="open"?"Placed":"Last filled"}</th></tr></thead>
    <tbody>{orders.slice(0,40).map(o=><tr key={o.subaccount+o.id+o.productId}>
      <td><strong>{o.symbol}</strong><small>{o.subaccount}</small></td>
      <td className={o.side==="buy"?"positive":"negative"}>{o.side.toUpperCase()}</td>
      <td>{amount(o.size)}</td><td>{amount(o.price)}</td><td>{date(o.timestamp)}</td>
    </tr>)}</tbody></table></div>;
}

function AccountExplorer() {
  const {address,isConnected,chainId}=useAccount();
  const onInk=isConnected&&chainId===ink.id;
  const [tab,setTab]=useState<"positions"|"openOrders"|"indexedOrders">("positions");
  const {data,isFetching,isPending,error,refetch}=useQuery({
    queryKey:["nado-account",address?.toLowerCase()],
    queryFn:({signal})=>request<NadoAccountResponse>("/api/nado/account?address="+encodeURIComponent(address!),signal),
    enabled:Boolean(onInk&&address),
    staleTime:30000,refetchInterval:onInk?60000:false,retry:1,
  });
  const tabs=[{key:"positions" as const,name:"Open positions",count:data?.positions.length??0},
    {key:"openOrders" as const,name:"Open orders",count:data?.openOrders.length??0},
    {key:"indexedOrders" as const,name:"Indexed orders",count:data?.indexedOrders.length??0}];
  return <section className="nado-section" aria-labelledby="nado-account-title">
    <div className="nado-heading"><div><span className="eyebrow">NADO / READ-ONLY ACCOUNT VIEW</span><h2 id="nado-account-title">Your Nado activity</h2><p>Public Nado subaccount records for the connected Ink wallet. This is not a trading session and requests no signature.</p></div>
      {onInk&&<button type="button" className="btn btn-secondary" onClick={()=>void refetch()} disabled={isFetching}><RefreshCw size={15}/> Refresh</button>}
    </div>
    {!onInk?<div className="nado-state nado-wallet-state"><Wallet size={23}/><strong>Connect a wallet on Ink</strong><span>Symb-II will only query Nado account records for your connected Ink address.</span></div>:
      isPending?<div className="nado-state" role="status">Looking up public Nado subaccounts…</div>:
      error?<div className="nado-state nado-error" role="alert">{error.message} <button type="button" onClick={()=>void refetch()}>Try again</button></div>:
      data&&data.subaccounts.length===0?<div className="nado-state nado-wallet-state"><Activity size={23}/><strong>No Nado cross-margin subaccounts found</strong><span>There are no indexed Nado accounts associated with this address in the queried first page. Try a different connected wallet if you use another address on Nado.</span></div>:
      data&&<>
        <div className="nado-account-meta"><span><span className="connected-dot"/> Nado subaccounts: {data.subaccounts.length}</span><span><Clock3 size={14}/> Retrieved {stamp(data.updatedAt)}</span></div>
        {data.warnings.length>0&&<div className="nado-warning" role="status"><ShieldAlert size={17}/><div><strong>Partial account data</strong>{data.warnings.map((w,i)=><p key={i}>{w}</p>)}</div></div>}
        <div className="nado-tabs nado-account-tabs" role="tablist" aria-label="Nado account information">{tabs.map(t=><button type="button" role="tab" aria-selected={tab===t.key} key={t.key} className={tab===t.key?"nado-active":""} onClick={()=>setTab(t.key)}>{t.name} <span>{t.count}</span></button>)}</div>
        <div role="tabpanel">
          {tab==="positions"?(data.positions.length?<div className="nado-scroll"><table className="nado-table"><thead><tr><th>Market</th><th>Side</th><th>Margin</th><th>Size</th><th>Avg entry</th><th>Updated</th></tr></thead>
            <tbody>{data.positions.slice(0,40).map(p=><tr key={p.subaccount+p.id+p.productId}><td><strong>{p.symbol}</strong><small>{p.subaccount}</small></td><td className={p.side==="long"?"positive":"negative"}>{p.side.toUpperCase()}</td><td>{p.marginMode}</td><td>{amount(p.size)}</td><td>{amount(p.entryPrice)}</td><td>{date(p.updatedAt)}</td></tr>)}</tbody></table></div>:<div className="nado-state">No currently open positions found in the available Nado records.</div>):
            <OrdersTable orders={data[tab]}/>}
        </div>
        <div className="nado-source">Nado engine + indexer · Wallet address is publicly queryable; connection alone does not authenticate Nado ownership · Some older activity may be paginated</div>
      </>}
  </section>;
}

export function NadoPanel() {
  return <div className="nado-panels" id="nado"><div className="nado-section-title"><span className="nado-ready">M02 / READ-ONLY</span><div><h2>Nado integration</h2><p>Market discovery and wallet-associated account records, powered by official Nado APIs.</p></div><a href="https://nado.finance/" target="_blank" rel="noreferrer">Nado <ArrowUpRight size={14}/></a></div><MarketExplorer/><AccountExplorer/></div>;
}
