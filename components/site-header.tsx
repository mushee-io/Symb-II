"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { WalletButton } from "@/components/wallet-button";

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const isWorkspace = pathname.startsWith("/workspace");
  return (
    <header className="site-header">
      <div className="header-inner shell">
        <Brand />
        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link className={!isWorkspace ? "nav-active" : ""} href="/">Overview</Link>
          <Link className={isWorkspace ? "nav-active" : ""} href="/workspace">Workspace</Link>
          <Link href="/#integrations">Integrations</Link>
          <a href="https://github.com/mushee-io/Symb-II" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={13} /></a>
        </nav>
        <div className="header-right">
          <span className="chain-pill"><span/> Ink Mainnet</span>
          <WalletButton compact />
          <button className="mobile-menu-toggle" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20}/> : <Menu size={20}/>}
          </button>
        </div>
      </div>
      {menuOpen && <nav className="mobile-nav" aria-label="Mobile navigation" onClick={() => setMenuOpen(false)}>
        <Link href="/">Overview</Link><Link href="/workspace">Workspace</Link><Link href="/#integrations">Integrations</Link>
        <a href="https://github.com/mushee-io/Symb-II" target="_blank" rel="noreferrer">GitHub ↗</a>
      </nav>}
    </header>
  );
}
