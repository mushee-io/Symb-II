"use client";

import {useMemo,useState} from "react";
import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {useAccount} from "wagmi";
import {Activity,ArrowUpRight,Bot,Clock3,LockKeyhole,RefreshCw,ShieldAlert,Wallet} from "lucide-react";
import {WalletButton} from "@/components/wallet-button";
import {ink} from "@/lib/ink";
import type {NadoMarket,NadoMarketsResponse,NadoAccountResponse} from "@/lib/nado/types";
import styles from "@/app/workspace/terminal/terminal.module.css";

async function readJson<T>(url:string,signal?:AbortSignal):Promise<T>{
  const response=await fetch(url,{signal,cache:"no-store"});
  if(!response.ok)throw new Error("Live provider unavailable ("+response.status+"). No substitute data displayed.");
  return response.json() as Promise<T>;
}
const number=(n:number,digits=2)=>new Intl.NumberFormat("en-GB",{maximumFractionDigits:digits}).format(n);
const money=(n:number)=>"$"+number(n,2);
const priceLabel=(n:number)=>"$"+number(n,n<1?6:2);
const MAX_QUOTE_AGE_MS=120000;

export function TradingTerminal(){
  const {address,isConnected,chainId}=useAccount();
  const onInk=Boolean(isConnected&&address&&chainId===ink.id);
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [search,setSearch]=useState("");
  const [side,setSide]=useState<"long"|"short">("long");
  const [notionalText,setNotionalText]=useState("500");
  const [leverageText,setLeverageText]=useState("2");
  const [instruction,setInstruction]=useState("");
  const [parserNote,setParserNote]=useState("");
  const markets=useQuery({
    queryKey:["nado-markets"],
    queryFn:({signal})=>readJson<NadoMarketsResponse>("/api/nado/markets",signal),
    staleTime:15000,refetchInterval:30000,retry:1,
  });
  const account=useQuery({
    queryKey:["nado-account",address?.toLowerCase()],
    queryFn:({signal})=>readJson<NadoAccountResponse>("/api/nado/account?address="+encodeURIComponent(address!),signal),
    enabled:onInk,staleTime:30000,refetchInterval:onInk?60000:false,retry:1,
  });
  const perps=useMemo(()=>(markets.data?.markets??[]).filter(m=>m.type==="perp"),[markets.data]);
  const market=perps.find(m=>m.productId===selectedId)??perps[0]??null;
  const filtered=perps.filter(m=>(m.symbol+" "+m.base).toLowerCase().includes(search.toLowerCase())).slice(0,24);
  const notional=Number(notionalText);
  const leverage=Number(leverageText);
  const validDraft=Boolean(market&&Number.isFinite(notional)&&notional>0&&Number.isFinite(leverage)&&leverage>=1&&leverage<=10);
  const quoteAge=markets.data?Date.now()-new Date(markets.data.updatedAt).getTime():Infinity;
  const quoteFresh=Number.isFinite(quoteAge)&&quoteAge>=0&&quoteAge<=MAX_QUOTE_AGE_MS;
  const validPrice=Boolean(market&&Number.isFinite(market.lastPrice)&&market.lastPrice>0);
  const draftReady=validDraft&&validPrice&&quoteFresh;
  const margin=validDraft?notional/leverage:NaN;
  const quantity=draftReady&&market?notional/market.lastPrice:NaN;
  const moveOnePercent=validDraft?notional*0.01:NaN;

  function interpretInstruction(){
    const prompt=instruction.trim();
    if(!prompt){setParserNote("Enter an instruction first. No network transaction will be created.");return;}
    const sideMatch=prompt.match(/\b(long|short|buy|sell)\b/i);
    const cashMatch=prompt.match(/\$\s*(\d+(?:\.\d+)?)/);
    const leverageMatch=prompt.match(/\b(\d+(?:\.\d+)?)\s*x\b/i);
    const mentioned=perps.find(m=>new RegExp("\\b"+m.base.replace(/[^A-Za-z0-9]/g,"")+"\\b","i").test(prompt));
    if(!sideMatch||!cashMatch||!mentioned){
      setParserNote("Could not safely parse a side, $ notional and supported market. Try: Prepare a $500 BTC long at 2x.");
      return;
    }
    const candidateLeverage=leverageMatch?Number(leverageMatch[1]):leverage;
    const candidateNotional=Number(cashMatch[1]);
    if(!Number.isFinite(candidateNotional)||candidateNotional<=0||!Number.isFinite(candidateLeverage)||candidateLeverage<1||candidateLeverage>10){
      setParserNote("Draft rejected: use a positive USD notional and leverage from 1x to 10x.");
      return;
    }
    setSelectedId(mentioned.productId);
    setSide(/long|buy/i.test(sideMatch[1])?"long":"short");
    setNotionalText(String(candidateNotional));
    setLeverageText(String(candidateLeverage));
    setParserNote("Instruction parsed into a local preview only. This is a deterministic parser, not a generative AI model or a trading signal.");
  }

  return <div className={styles.terminal}>
    <div className={styles.heading}>
      <div><span className="eyebrow">SYMB-II / DESKTOP-FIRST TERMINAL</span>
        <h1>Trading terminal<span className="title-period">.</span></h1>
        <p>Live Nado perpetual market snapshots, wallet-associated positions and a local order draft. This is the first building block of the desktop trading agent.</p>
      </div>
      <span className={styles.lock}><LockKeyhole size={15}/> READ-ONLY · NO ORDER SUBMISSION</span>
    </div>
    <div className={styles.statusRow}>
      <span><Activity size={15}/> Ink Mainnet · 57073</span>
      <span><Clock3 size={15}/> {markets.data?"Indexer snapshot "+new Date(markets.data.updatedAt).toLocaleTimeString():"Awaiting market data"}</span>
      <span>{onInk?"Wallet connected":isConnected?"Wrong wallet network":"Wallet not connected"}</span>
      <button type="button" onClick={()=>void markets.refetch()} disabled={markets.isFetching}><RefreshCw size={14}/> Refresh markets</button>
    </div>
    <div className={styles.grid}>
      <section className={styles.watch} aria-label="Nado market watchlist">
        <div className={styles.panelTop}><strong>Market watch</strong><small>{perps.length} indexed perpetuals</small></div>
        <label className={styles.search}>Filter markets<input aria-label="Filter Nado perpetual markets" value={search} onChange={e=>setSearch(e.target.value)} placeholder="BTC, ETH, SOL…"/></label>
        {markets.isPending?<p className={styles.muted} role="status">Loading live Nado markets…</p>:
          markets.error?<p className={styles.warning} role="alert">{markets.error.message}</p>:
          !perps.length?<p className={styles.warning}>No live perpetual markets returned. Drafting is unavailable.</p>:
          <div className={styles.watchList}>{filtered.map(m=>
            <button type="button" key={m.productId} className={styles.marketButton+" "+(m.productId===market?.productId?styles.active:"")} aria-pressed={m.productId===market?.productId} onClick={()=>setSelectedId(m.productId)}>
              <span><strong>{m.symbol}</strong><small>{m.base}/{m.quote}</small></span>
              <span className={styles.right}><strong>{priceLabel(m.lastPrice)}</strong><small className={m.change24h<0?styles.down:styles.up}>{m.change24h>=0?"+":""}{number(m.change24h)}%</small></span>
            </button>)}
            {!filtered.length&&<p className={styles.muted}>No matching markets.</p>}
          </div>}
      </section>
      <section className={styles.center} aria-label="Market detail and agent instructions">
        <div className={styles.panelTop}><strong>{market?market.symbol:"Select a market"}</strong><small>Nado indexer · indicative snapshot</small></div>
        {market?<div className={styles.quote}>
          <div><small>Last indexed price</small><strong>{priceLabel(market.lastPrice)}</strong></div>
          <div><small>24-hour change</small><strong className={market.change24h<0?styles.down:styles.up}>{market.change24h>=0?"+":""}{number(market.change24h)}%</strong></div>
          <div><small>24-hour indexed volume</small><strong>{money(market.volume24h)}</strong></div>
        </div>:<p className={styles.muted}>Market data is unavailable. The terminal does not generate simulated prices.</p>}
        {!quoteFresh&&<div className={styles.warning} role="status">Quote missing or more than two minutes old. Draft estimates are disabled until refreshed.</div>}
        <div className={styles.agentArea}>
          <div className={styles.agentTitle}><Bot size={18}/><div><strong>Agent command desk</strong><small>Rule-based draft parser · AI reasoning not connected</small></div></div>
          <label htmlFor="terminal-instruction">Describe a draft to prepare</label>
          <textarea id="terminal-instruction" value={instruction} onChange={e=>setInstruction(e.target.value)} placeholder="Prepare a $500 BTC long at 2x" rows={4}/>
          <button type="button" className={styles.parseButton} onClick={interpretInstruction}>Parse into order draft</button>
          {parserNote&&<p className={styles.parserNote} role="status">{parserNote}</p>}
          <p className={styles.muted}>No AI-generated investment advice, signing, approvals, exchange orders or autonomous actions. Parsing only updates the fields on this screen.</p>
        </div>
        <div className={styles.links}><Link href="/workspace/risk">Risk monitor <ArrowUpRight size={13}/></Link><Link href="/workspace/rescue">Rescue Lab <ArrowUpRight size={13}/></Link><Link href="/agent">Guided explanations <ArrowUpRight size={13}/></Link></div>
      </section>
      <section className={styles.draft} aria-label="Local order draft">
        <div className={styles.panelTop}><strong>Order draft</strong><small>Preview only</small></div>
        <div className={styles.sideButtons}>
          <button type="button" aria-pressed={side==="long"} className={side==="long"?styles.longActive:""} onClick={()=>setSide("long")}>Long</button>
          <button type="button" aria-pressed={side==="short"} className={side==="short"?styles.shortActive:""} onClick={()=>setSide("short")}>Short</button>
        </div>
        <label className={styles.field}>Notional · estimated USD equivalent<input type="number" min="0.01" step="any" value={notionalText} onChange={e=>setNotionalText(e.target.value)} inputMode="decimal"/></label>
        <label className={styles.field}>Illustrative leverage · 1x–10x<input type="number" min="1" max="10" step="any" value={leverageText} onChange={e=>setLeverageText(e.target.value)} inputMode="decimal"/></label>
        <div className={styles.preview}>
          <strong>Indicative calculations</strong>
          <div><span>Market</span><b>{market?.symbol??"Unavailable"}</b></div>
          <div><span>Side</span><b>{side.toUpperCase()}</b></div>
          <div><span>Notional input</span><b>{validDraft?money(notional):"Invalid"}</b></div>
          <div><span>Simple margin division</span><b>{validDraft?money(margin):"Unavailable"}</b></div>
          <div><span>Approx. quantity</span><b>{draftReady?number(quantity,8):"Unavailable"}</b></div>
          <div><span>Gross PnL for 1% favourable move</span><b>{validDraft?money(moveOnePercent):"Unavailable"}</b></div>
        </div>
        {!validDraft&&<p className={styles.warning}>Enter a positive notional and leverage between 1 and 10.</p>}
        <div className={styles.disabledAction}><LockKeyhole size={16}/> Order placement disabled</div>
        <p className={styles.muted}>These calculations are not Nado margin, liquidation or execution quotes. They exclude fees, slippage, funding, margin requirements and market impact. The quote may be stale between refreshes. Never use this draft to infer a safe liquidation price.</p>
      </section>
    </div>
    <section className={styles.positions} aria-label="Wallet-associated Nado positions">
      <div className={styles.panelTop}><strong>Open positions · wallet inspection</strong><span>{onInk&&address?address.slice(0,6)+"…"+address.slice(-4):"No connected Ink wallet"}</span></div>
      {!onInk?<div className={styles.positionsEmpty}><Wallet size={18}/><p>Connect an Ink wallet to inspect publicly accessible Nado account positions. This does not authorise trading.</p><WalletButton/></div>:
        account.isPending?<p className={styles.muted}>Reading wallet-associated Nado subaccounts…</p>:
        account.error?<p className={styles.warning} role="alert">{account.error.message}</p>:
        account.data?<div>
          {(!account.data.positionCoverageComplete||account.data.incomplete||account.data.warnings.length>0)&&<p className={styles.warning}><ShieldAlert size={15}/> Some Nado account evidence is partial or incomplete. Do not treat missing positions as proof of no risk. {account.data.warnings.join(" ")}</p>}
          {account.data.positions.length?<div className={styles.tableScroll}><table><thead><tr><th>Market</th><th>Side</th><th>Size</th><th>Entry price</th><th>Margin mode</th></tr></thead>
            <tbody>{account.data.positions.slice(0,8).map(p=><tr key={p.subaccount+p.id+p.productId}><td>{p.symbol}</td><td>{p.side}</td><td>{p.size}</td><td>{p.entryPrice}</td><td>{p.marginMode}</td></tr>)}</tbody></table></div>:
            <p className={styles.muted}>No positions in the available records. Account coverage may be incomplete; confirm against Nado directly.</p>}
        </div>:<p className={styles.muted}>No Nado account data returned.</p>}
    </section>
    <p className={styles.footer}>Symb-II is not an exchange or brokerage. Desktop-first web terminal preview only; no native desktop installer is included yet. Trading remains disabled pending security review and independent wallet testing.</p>
  </div>;
}
