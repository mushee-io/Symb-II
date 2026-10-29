"use client";

import Link from "next/link";
import { useAccount, useBalance } from "wagmi";
import { ArrowLeft, ArrowRight, ArrowUpRight, ChartNoAxesCombined, CircleCheck, Clock3, ExternalLink, LockKeyhole, Network, ShieldAlert, Wallet } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { NadoPanel } from "@/components/nado-panel";
import { TydroPanel } from "@/components/tydro-panel";
import { RiskPanel } from "@/components/risk-panel";
import { WalletButton } from "@/components/wallet-button";
import { ink, INK_EXPLORER } from "@/lib/ink";

const steps = [
  { number:"02",title:"Nado integration",description:"Read-only markets, positions and order records",status:"Implemented" },
  { number:"03",title:"Tydro integration",description:"Read-only reserves, lending balances and health",status:"Implemented" },
  { number:"04",title:"Risk intelligence",description:"Separate Nado PnL, Tydro health sensitivity and exposure inventory",status:"In progress" },
  { number:"05",title:"AI capital operator",description:"Read-only, source-linked capital analysis preview",status:"Preview" },
  { number:"06",title:"Portfolio Rescue + Preflight",description:"Read-only Nado/Tydro scenarios and guarded single-asset repay preflight",status:"Preview" },
];

export default function Workspace() {
  const { address, isConnected, chainId } = useAccount();
  const onInk = isConnected && chainId === ink.id;
  const { data: balance, isLoading: balanceLoading, isError: balanceError, refetch } = useBalance({
    address,
    chainId: ink.id,
    query: { enabled: onInk, refetchInterval: 30000 },
  });
  return (
    <div className="site workspace-site">
      <SiteHeader/>
      <main className="shell workspace-main">
        <Link href="/" className="back-link"><ArrowLeft size={15}/> Back to overview</Link>
        <div className="workspace-title-row">
          <div><span className="eyebrow">SYMB-II / WORKSPACE</span><h1>Your capital workspace<span className="title-period">.</span></h1><p>Connect your Ink wallet, inspect real Nado markets and read your wallet-associated trading activity. Tydro lending and health data are read-only. Automated actions are not available.</p></div>
          <span className="milestone-pill"><span/> MILESTONE 04 · RISK PREVIEW</span>
        </div>
        <div className="workspace-grid">
          <section className="workspace-card wallet-panel">
            <div className="panel-top"><span><Wallet size={18}/> Connected wallet</span><span className="panel-status">{onInk ? "● CONNECTED" : "NOT CONNECTED"}</span></div>
            {!isConnected ? (
              <div className="empty-wallet"><div className="empty-wallet-icon"><Wallet size={32}/></div><h2>Connect to see your wallet</h2><p>View your actual Ink mainnet address and ETH balance. We never invent portfolio data.</p><WalletButton/></div>
            ) : !onInk ? (
              <div className="empty-wallet"><div className="empty-wallet-icon"><Network size={32}/></div><h2>Switch to Ink mainnet</h2><p>Symb-II is built exclusively on Ink. Switch networks to load your account data.</p><WalletButton/></div>
            ) : (
              <div className="wallet-details">
                <div className="detail-label">Ink ETH balance</div>
                <div className="large-balance">{balanceLoading ? "Loading…" : balanceError ? "Unavailable" : balance ? Number(balance.formatted).toLocaleString(undefined,{maximumFractionDigits:6}) : "Unavailable"} <span>{balance && !balanceError ? balance.symbol : ""}</span></div>
                <div className="detail-address">{address}</div>
                <div className="wallet-detail-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => void refetch()}>Refresh balance</button>
                  <a href={INK_EXPLORER + "/address/" + address} target="_blank" rel="noreferrer" className="btn btn-secondary">Explorer <ExternalLink size={14}/></a>
                </div>
                {balanceError && <p className="wallet-error" role="alert">Could not fetch the RPC balance. Please try again.</p>}
              </div>
            )}
            <div className="panel-footnote"><LockKeyhole size={15}/> Read-only wallet data. No transaction signing requested.</div>
          </section>
          <section className="workspace-card foundation-panel">
            <div className="panel-top"><span><ShieldAlert size={18}/> Protocol overview</span><span className="panel-status muted">ONCHAIN READS</span></div>
            <div className="foundation-info"><div className="foundation-icon"><ChartNoAxesCombined size={25}/></div><h2>No simulated positions</h2><p>Nado trading and Tydro lending information appear below. They remain separate protocol accounts. A read-only cross-protocol exposure inventory and separate Nado PnL / Tydro lending what-if models are available below. No combined liquidation model exists.</p></div>
            <div className="foundation-rows"><div><span>Nado records</span><b>See live panel below</b></div><div><span>Tydro lending</span><b>See health below</b></div><div><span>Protocol risk</span><b>See risk monitor below</b></div></div>
          </section>
        </div>
        <div className="agent-promo"><div><span className="eyebrow">M05 / AGENT PREVIEW</span><h2>Ask your capital, not a dashboard.</h2><p>Explore source-grounded read-only explanations of your Nado positions, Tydro lending and risk alerts. No model calls, trading or delegated execution.</p></div><Link href="/agent" className="btn btn-primary">Open capital assistant <ArrowRight size={16}/></Link></div>
        <RiskPanel/>
        <NadoPanel/>
        <TydroPanel/>
        <div className="workspace-roadmap-title"><div><span className="eyebrow">BUILDING THE FOUNDATION</span><h2>What comes next</h2></div><a href="https://github.com/mushee-io/Symb-II" target="_blank" rel="noreferrer">Follow development <ArrowUpRight size={16}/></a></div>
        <div className="roadmap-grid">{steps.map(step=><div className="roadmap-card" key={step.number}><span className="roadmap-number">M{step.number}</span><Clock3 size={18}/><h3>{step.title}</h3><p>{step.description}</p><span className="roadmap-status">{step.status} <ArrowRight size={13}/></span></div>)}</div>
        <div className="workspace-disclaimer"><CircleCheck size={17}/><span>Symb-II does not custody assets or operate an exchange. The app offers wallet balance inspection and read-only Nado and Tydro market/account records only. Some account results may be incomplete; no order placement, AI execution, lending actions or permissions are enabled.</span></div>
      </main>
      <SiteFooter/>
    </div>
  );
}
