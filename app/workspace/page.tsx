"use client";

import Link from "next/link";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {useAccount,useBalance} from "wagmi";
import {ArrowRight,ArrowUpRight,ChartNoAxesCombined,Droplets,ExternalLink,LockKeyhole,Monitor,Network,ShieldAlert,Wallet} from "lucide-react";
import {WalletButton} from "@/components/wallet-button";
import {ink,INK_EXPLORER} from "@/lib/ink";

const destinations=[
  {href:"/workspace/terminal",name:"Trading terminal",detail:"Live Nado market watch, command desk and safe order previews",icon:Monitor,eyebrow:"AGENT WORKSPACE"},
  {href:"/workspace/nado",name:"Nado markets",detail:"Live spot, perpetuals, positions and order records",icon:ChartNoAxesCombined,eyebrow:"MARKET DATA"},
  {href:"/workspace/tydro",name:"Tydro lending",detail:"Reserves, supply and borrowing health",icon:Droplets,eyebrow:"LENDING"},
  {href:"/workspace/risk",name:"Risk monitor",detail:"Independent margin and lending risk readings",icon:ShieldAlert,eyebrow:"YOUR CAPITAL"},
] as const;

const legacySectionRoutes:Record<string,string>={
  "#risk":"/workspace/risk",
  "#nado":"/workspace/nado",
  "#tydro":"/workspace/tydro",
  "#portfolio-rescue":"/workspace/rescue",
  "#preflight":"/workspace/preflight",
  "#launch-readiness":"/workspace/readiness",
  "#wallet-verification":"/workspace/verify",
  "#risk-alerts":"/workspace/monitor",
};

export default function Workspace(){
  const router=useRouter();
  useEffect(()=>{
    // Previously shared single-page section URLs still lead to the real tool.
    const destination=legacySectionRoutes[window.location.hash.toLowerCase()];
    if(destination)router.replace(destination);
  },[router]);
  const {address,isConnected,chainId}=useAccount();
  const onInk=Boolean(address&&isConnected&&chainId===ink.id);
  const {data:balance,isLoading:balanceLoading,isError:balanceError,refetch}=useBalance({
    address,chainId:ink.id,
    query:{enabled:onInk,refetchInterval:30000},
  });
  return <>
    <div className="workspace-overview-intro">
      <span className="eyebrow">SYMB-II / DASHBOARD</span>
      <h1>Capital, without the clutter<span className="title-period">.</span></h1>
      <p>Open the desktop-first trading terminal for a read-only agent command desk, or select a dedicated protocol and risk page.</p>
    </div>
    <div className="workspace-overview-cards">
      <section className="workspace-card wallet-panel">
        <div className="panel-top"><span><Wallet size={18}/> Your Ink wallet</span><span className="panel-status">{onInk?"● CONNECTED":"NOT CONNECTED"}</span></div>
        {!isConnected?<div className="empty-wallet"><div className="empty-wallet-icon"><Wallet size={32}/></div><h2>Connect your wallet</h2><p>Read your real Ink ETH balance and account data. No sample balances are shown.</p><WalletButton/></div>:
          !onInk?<div className="empty-wallet"><div className="empty-wallet-icon"><Network size={32}/></div><h2>Switch to Ink mainnet</h2><p>Switch your wallet to chain 57073 to read your account.</p><WalletButton/></div>:
          <div className="wallet-details">
            <div className="detail-label">Ink ETH balance</div>
            <div className="large-balance">{balanceLoading?"Loading…":balanceError||!balance?"Unavailable":Number(balance.formatted).toLocaleString(undefined,{maximumFractionDigits:6})} <span>{balance&&!balanceError?balance.symbol:""}</span></div>
            <div className="detail-address">{address}</div>
            <div className="wallet-detail-actions">
              <button className="btn btn-secondary" type="button" onClick={()=>void refetch()}>Refresh balance</button>
              <a href={INK_EXPLORER+"/address/"+address} target="_blank" rel="noreferrer" className="btn btn-secondary">Explorer <ExternalLink size={14}/></a>
            </div>
            {balanceError&&<p className="wallet-error" role="alert">Could not fetch the Ink balance. Try again.</p>}
          </div>}
        <div className="panel-footnote"><LockKeyhole size={15}/> Read-only account inspection. No spending approvals.</div>
      </section>
      <section className="workspace-card workspace-start-card">
        <span className="eyebrow">HOW TO GET STARTED</span>
        <h2>Everything has its place.</h2>
        <p>Browse markets without a wallet. Connect on Ink to see your positions, health and available read-only analysis.</p>
        <div className="workspace-start-steps">
          <div><strong>01</strong><span>Open Nado or Tydro for live public markets.</span></div>
          <div><strong>02</strong><span>Connect a wallet to inspect your own account.</span></div>
          <div><strong>03</strong><span>Use Risk, Rescue, Alerts or Wallet Lab when needed.</span></div>
        </div>
        <Link href="/workspace/verify" className="workspace-text-link">Check wallet verification <ArrowUpRight size={15}/></Link>
      </section>
    </div>
    <div className="workspace-shortcuts-head"><div><span className="eyebrow">YOUR TOOLS</span><h2>Pick a destination</h2></div><span>INK MAINNET · READ ONLY</span></div>
    <div className="workspace-shortcuts">
      {destinations.map(({href,name,detail,icon:Icon,eyebrow})=><Link href={href} className="workspace-shortcut" key={href}>
        <div className="workspace-shortcut-top"><span className="workspace-shortcut-icon"><Icon size={20}/></span><ArrowUpRight size={18}/></div>
        <small>{eyebrow}</small><strong>{name}</strong><p>{detail}</p>
        <span className="workspace-shortcut-open">Open page <ArrowRight size={15}/></span>
      </Link>)}
    </div>
    <p className="workspace-overview-disclaimer">Symb-II does not custody assets or operate an exchange. Live market and account views are read-only; rescue calculations are hypothetical. Transactions, automatic trading and external notification delivery are not active.</p>
  </>;
}
