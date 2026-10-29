"use client";
import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {useSignMessage} from "wagmi";
import {ShieldCheck,FileText,ClipboardCopy} from "lucide-react";
import type {ReviewRequest,ProposalPacket,ProposalReceipt} from "@/lib/proposals/policy";
import type {RescueOutcome} from "@/lib/risk/rescue";

type Config={enabled:boolean};
async function post<T>(path:string,body:unknown):Promise<T>{
 const res=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify(body),cache:"no-store"});
 const payload=await res.json().catch(()=>({})) as {error?:string};
 if(!res.ok)throw Error(payload.error||"Review service unavailable.");
 return payload as T;
}
export function ProposalReview({wallet,request,scenario}:{
 wallet:string;request:ReviewRequest;scenario:Extract<RescueOutcome,{ok:true}>
}){
 const {signMessageAsync}=useSignMessage();
 const [packet,setPacket]=useState<ProposalPacket|null>(null);
 const [receipt,setReceipt]=useState<ProposalReceipt|null>(null);
 const [consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [copied,setCopied]=useState(false);
 const {data:config,isPending}=useQuery({
   queryKey:["proposal-config"],staleTime:60000,retry:1,
   queryFn:async()=>{const res=await fetch("/api/proposals/config",{cache:"no-store"});
     if(!res.ok)throw Error("Config unavailable");return res.json() as Promise<Config>;}
 });
 const summary=scenario.kind==="position-reduction"?
   "Nado "+scenario.symbol+" | "+scenario.reductionPct+"% hypothetical size reduction | "+
   scenario.shockPct+"% ticker shock | PnL sensitivity "+scenario.originalPositionSensitivity+
   " to "+scenario.remainingPositionSensitivity+" "+scenario.quote :
   "Tydro | "+scenario.repaymentPct+"% hypothetical reduction across ALL debt tokens | health factor "+
   scenario.currentHealthFactor+" to "+scenario.estimatedHealthFactor;
 async function copy(){
   try{await navigator.clipboard.writeText("Symb-II | Ink 57073 | REVIEW ONLY\n"+summary+
     "\nNot a trade, borrowing instruction or transaction authorization.");setCopied(true);}
   catch{setError("Could not access clipboard.");}
 }
 async function draft(){
   setBusy(true);setError("");setPacket(null);setReceipt(null);setConsent(false);
   try{const response=await post<{packet:ProposalPacket}>("/api/proposals/draft",request);
     setPacket(response.packet);}
   catch(e){setError(e instanceof Error?e.message:"Draft could not be created.");}
   finally{setBusy(false);}
 }
 async function acknowledge(){
   if(!packet||!consent||busy)return;
   setBusy(true);setError("");
   const message=["Symb-II | REVIEW ACKNOWLEDGEMENT ONLY",
     "Domain: "+window.location.host,
     "Wallet: "+packet.wallet,
     "Ink Chain ID: "+packet.chainId,
     "Review ID: "+packet.id,
     "Action: "+packet.action,
     "Scenario Digest: "+packet.digest,
     "Expires At: "+packet.expiresAt,
     "I acknowledge reviewing the described non-executable scenario.",
     "This is NOT consent to trade, repay, transfer funds, approve a token, delegate a wallet or execute any transaction.",
   ].join("\n");
   try{const signature=await signMessageAsync({message});
     const data=await post<{receipt:ProposalReceipt}>("/api/proposals/acknowledge",{
       wallet,id:packet.id,signature,
     });setReceipt(data.receipt);setPacket(null);
   }catch(e){setPacket(null);setError((e instanceof Error?e.message:"Signature failed.")+
     " Obtain a new server draft to retry.");}
   finally{setBusy(false);}
 }
 return <div className="proposal-review">
   <div className="proposal-review-title"><FileText size={17}/><strong>Review record</strong><small>NO EXECUTION</small></div>
   <p>Copy this scenario or create an expiring, server-rechecked receipt. A plain-text wallet signature only records your acknowledgement.</p>
   <button type="button" className="btn btn-secondary" onClick={()=>void copy()}>
     <ClipboardCopy size={14}/>{copied?"Copied":"Copy review summary"}</button>
   {isPending?<p className="proposal-note">Checking receipt availability…</p>:
    !config?.enabled?<p className="proposal-note">Signed receipts are disabled until the private review store is configured. Copying still works.</p>:
    <div className="proposal-steps">
      <button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>void draft()}>
        <ShieldCheck size={15}/>{busy?"Checking live data…":"Recheck and prepare review"}</button>
      {packet&&<div className="proposal-packet">
        <strong>Server-verified, non-executable review</strong>
        <p>{packet.scenario.label}</p>
        <p>Before: {packet.scenario.before} · After: {packet.scenario.after} ({packet.scenario.units})</p>
        <p>Expires: {new Date(packet.expiresAt).toLocaleTimeString()} · Digest {packet.digest.slice(0,18)}…</p>
        <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
          I acknowledge this is not permission to trade, repay or transfer funds.</label>
        <button type="button" className="btn btn-primary" disabled={!consent||busy} onClick={()=>void acknowledge()}>
          Sign review acknowledgement</button>
      </div>}
      {receipt&&<div className="proposal-receipt" role="status">Review acknowledged; no transaction occurred.
        <small>Receipt {receipt.id} · {new Date(receipt.acknowledgedAt).toLocaleString()}</small></div>}
    </div>}
   {error&&<p className="proposal-error" role="alert">{error}</p>}
 </div>;
}
