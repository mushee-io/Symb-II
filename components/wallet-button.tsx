"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { ink } from "@/lib/ink";
import { ArrowUpRight, LogOut, Wallet, AlertTriangle } from "lucide-react";
import { useState } from "react";

function shortAddress(value: string) {
  return value.slice(0, 6) + "…" + value.slice(-4);
}

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const wrongNetwork = isConnected && chainId !== ink.id;

  if (!isConnected) {
    return (
      <div className="wallet-action">
        <button
          type="button"
          className={compact ? "btn btn-primary btn-small" : "btn btn-primary"}
          disabled={isPending}
          onClick={() => {
            const connector = connectors[0];
            if (connector) connect({ connector });
          }}
        >
          <Wallet size={16} strokeWidth={1.8} />
          {isPending ? "Connecting…" : "Connect wallet"}
          <ArrowUpRight size={15} />
        </button>
        {connectError && <span className="wallet-error" role="alert">{connectError.message}</span>}
      </div>
    );
  }

  if (wrongNetwork) {
    return (
      <div className="wallet-action">
        <button type="button" className="btn btn-warning" disabled={isSwitching} onClick={() => switchChain({ chainId: ink.id })}>
          <AlertTriangle size={15} /> {isSwitching ? "Switching…" : "Switch to Ink"}
        </button>
        {switchError && <span className="wallet-error" role="alert">{switchError.message}</span>}
      </div>
    );
  }

  return (
    <div className="wallet-action wallet-connected">
      <button type="button" className="btn btn-outlined" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="connected-dot" /> {shortAddress(address!)}
      </button>
      {open && (
        <div className="wallet-menu">
          <div className="wallet-menu-header"><span className="connected-dot" /> Connected to Ink</div>
          <a target="_blank" rel="noreferrer" href={"https://explorer.inkonchain.com/address/" + address}>View on explorer <ArrowUpRight size={14}/></a>
          <button type="button" onClick={() => { disconnect(); setOpen(false); }}><LogOut size={14}/> Disconnect</button>
        </div>
      )}
    </div>
  );
}
