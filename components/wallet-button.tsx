"use client";

import {useAccount,useConnect,useDisconnect,useSwitchChain} from "wagmi";
import {ink} from "@/lib/ink";
import {walletConnectConfigured} from "@/lib/wagmi";
import {classifyWalletConnection} from "@/lib/wallet/connect-policy";
import {ArrowUpRight,LogOut,Wallet,AlertTriangle,Smartphone} from "lucide-react";
import {useState} from "react";

function shortAddress(value:string){return value.slice(0,6)+"…"+value.slice(-4);}

export function WalletButton({compact=false}:{compact?:boolean}){
 const {address,isConnected,chainId}=useAccount();
 const {connect,connectors,isPending,error:connectError}=useConnect();
 const {disconnect}=useDisconnect();
 const {switchChain,isPending:isSwitching,error:switchError}=useSwitchChain();
 const [open,setOpen]=useState(false);
 const [choose,setChoose]=useState(false);
 const state=classifyWalletConnection({isConnected,address,chainId});

 if(state==="disconnected")return <div className="wallet-action">
  <button type="button" className={compact?"btn btn-primary btn-small":"btn btn-primary"}
    disabled={isPending} aria-expanded={choose} aria-controls="wallet-connect-choices"
    onClick={()=>setChoose(value=>!value)}>
    <Wallet size={16} strokeWidth={1.8}/>
    {isPending?"Connecting…":"Connect wallet"} <ArrowUpRight size={15}/>
  </button>
  {choose&&<div id="wallet-connect-choices" className="wallet-menu wallet-chooser">
   <div className="wallet-menu-header"><Wallet size={14}/> Choose a wallet</div>
   {connectors.map(connector=><button key={connector.uid} type="button"
     disabled={isPending}
     onClick={()=>{
       // Only a deliberate click starts wallet pairing. Never sign or send.
       connect({connector});setChoose(false);
     }}>
     {connector.id==="walletConnect"?<Smartphone size={15}/>:<Wallet size={15}/>}
     {connector.id==="walletConnect"?"WalletConnect (mobile / QR)":connector.name}
   </button>)}
   {!walletConnectConfigured&&<p className="wallet-chooser-help">
     Mobile wallet pairing is not configured on this deployment. On a phone,
     open Symb-II inside a compatible wallet's built-in browser instead.
   </p>}
   <p className="wallet-chooser-help">Ink mainnet only · Chain ID 57073. Connecting
    reveals a public address, not ownership proof or trading permission.</p>
  </div>}
  {connectError&&<span className="wallet-error" role="alert">{connectError.message}</span>}
 </div>;

 if(state==="invalid-wallet")return <div className="wallet-action">
  <span className="wallet-error" role="alert">Wallet address is invalid. No account data is trusted.</span>
  <button type="button" className="btn btn-secondary" onClick={()=>disconnect()}>
   <LogOut size={14}/> Disconnect
  </button>
 </div>;

 if(state==="wrong-network")return <div className="wallet-action">
  <button type="button" className="btn btn-warning" disabled={isSwitching}
   onClick={()=>switchChain({chainId:ink.id})}>
   <AlertTriangle size={15}/> {isSwitching?"Switching…":"Switch to Ink"}
  </button>
  {switchError&&<span className="wallet-error" role="alert">
    Switch failed. Select Ink (57073) in your wallet or disconnect.
    {" "+switchError.message}
   </span>}
  <button type="button" className="wallet-disconnect-link" onClick={()=>disconnect()}>
    <LogOut size={13}/> Disconnect
  </button>
 </div>;

 return <div className="wallet-action wallet-connected">
  <button type="button" className="btn btn-outlined" aria-expanded={open}
   onClick={()=>setOpen(value=>!value)}>
    <span className="connected-dot"/> {shortAddress(address!)}
  </button>
  {open&&<div className="wallet-menu">
   <div className="wallet-menu-header"><span className="connected-dot"/> Ink connected · Read-only</div>
   <a target="_blank" rel="noreferrer" href={"https://explorer.inkonchain.com/address/"+address}>
     View on explorer <ArrowUpRight size={14}/>
   </a>
   <button type="button" onClick={()=>{disconnect();setOpen(false);}}>
    <LogOut size={14}/> Disconnect
   </button>
  </div>}
 </div>;
}
