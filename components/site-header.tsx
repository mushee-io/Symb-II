"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {ArrowUpRight,Menu,X} from "lucide-react";
import {useState} from "react";
import {Brand} from "@/components/brand";
import {WalletButton} from "@/components/wallet-button";

export function SiteHeader(){
  const [menuOpen,setMenuOpen]=useState(false);
  const pathname=usePathname();
  const isWorkspace=pathname.startsWith("/workspace");
  return <header className="site-header">
    <div className="header-inner shell">
      <Brand/>
      <nav className="desktop-nav" aria-label="Primary navigation">
        <Link className={pathname==="/"?"nav-active":""} href="/">Home</Link>
        <Link className={pathname==="/workspace"?"nav-active":""} href="/workspace">Dashboard</Link>
        <Link className={pathname==="/workspace/nado"?"nav-active":""} href="/workspace/nado">Nado</Link>
        <Link className={pathname==="/workspace/tydro"?"nav-active":""} href="/workspace/tydro">Tydro</Link>
        <Link className={pathname==="/workspace/risk"?"nav-active":""} href="/workspace/risk">Risk</Link>
        <Link className={pathname==="/agent"?"nav-active":""} href="/agent">AI Agent</Link>
        <a href="https://github.com/mushee-io/Symb-II" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={13}/></a>
      </nav>
      <div className="header-right">
        <span className="chain-pill"><span/> Ink Mainnet</span>
        <WalletButton compact/>
        <button className="mobile-menu-toggle" type="button"
          aria-label={menuOpen?"Close menu":"Open menu"} aria-expanded={menuOpen}
          onClick={()=>setMenuOpen(value=>!value)}>
          {menuOpen?<X size={20}/>:<Menu size={20}/>}
        </button>
      </div>
    </div>
    {menuOpen&&<nav className="mobile-nav" aria-label="Mobile navigation" onClick={()=>setMenuOpen(false)}>
      <Link href="/">Home</Link><Link href="/workspace">Dashboard</Link>
      <Link href="/workspace/nado">Nado</Link><Link href="/workspace/tydro">Tydro</Link>
      <Link href="/workspace/risk">Risk</Link><Link href="/workspace/rescue">Rescue Lab</Link>
      <Link href="/workspace/preflight">Preflight</Link><Link href="/workspace/monitor">Alerts</Link>
      <Link href="/workspace/verify">Wallet Lab</Link><Link href="/workspace/readiness">Readiness</Link>
      <Link href="/agent">AI Agent</Link>
      <a href="https://github.com/mushee-io/Symb-II" target="_blank" rel="noreferrer">GitHub ↗</a>
    </nav>}
  </header>;
}
