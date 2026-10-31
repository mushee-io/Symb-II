"use client";

import {useEffect,useState} from "react";
import {useAccount,useSignMessage} from "wagmi";
import {useQuery} from "@tanstack/react-query";
import {Bot,LockKeyhole,ShieldCheck,AlertTriangle} from "lucide-react";
import {ink} from "@/lib/ink";
import type {TradeResearch} from "@/lib/trading/analysis";
import styles from "@/app/workspace/terminal/terminal.module.css";

type Result={
 kind:"ai-market"|"evidence-only"|"evidence-incomplete";
 narrative?:string;model?:string;evidence:TradeResearch;note:string;executionEnabled:false;
};
type AgentConfig={modelEnabled:boolean;walletSignatureRequired:boolean;tradingEnabled:boolean};
async function post<T>(path:string,body:unknown):Promise<T>{
 const res=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify(body),cache:"no-store"});
 const payload=await res.json().catch(()=>({})) as {error?:string};
 if(!res.ok)throw Error(payload.error??"Protected AI service unavailable.");
 return payload as T;
}
export function TerminalAIExplanation({productId,side,notional,leverage}:{
 productId:number;side:"long"|"short";notional:number;leverage:number;
}){
 const {address,isConnected,chainId}=useAccount();
 const {signMessageAsync}=useSignMessage();
 const [result,setResult]=useState<Result|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const config=useQuery({
  queryKey:["agent-config"],
  queryFn:async()=>{
   const res=await fetch("/api/agent/config",{cache:"no-store"});
   if(!res.ok)throw Error("AI availability could not be determined.");
   return res.json() as Promise<AgentConfig>;
  },
  staleTime:30000,retry:1,
 });
 // Never show old AI research after switching instrument, direction, wallet or draft.
 useEffect(()=>{setResult(null);setError("");},[productId,side,notional,leverage,address,chainId]);
 const walletReady=Boolean(isConnected&&address&&chainId===ink.id);
 const ready=config.data?.modelEnabled===true&&walletReady&&notional>0&&notional<=1_000_000&&
  Number.isFinite(notional)&&leverage>=1&&leverage<=10&&Number.isFinite(leverage);
 async function explain(){
  if(!ready||!address||busy)return;
  setBusy(true);setResult(null);setError("");
  try{
   const {challengeId,message}=await post<{challengeId:string;message:string}>("/api/agent/challenge",{wallet:address});
   const signature=await signMessageAsync({message});
   const answer=await post<Result>("/api/agent/market",{
    wallet:address,challengeId,message,signature,
    productId,side,notional,leverage,
   });
   if(answer.executionEnabled!==false)throw Error("Unsafe AI service response rejected.");
   setResult(answer);
  }catch(e){setError(e instanceof Error?e.message:"AI research request failed.");}
  finally{setBusy(false);}
 }
 return <section className={styles.optionalModel} aria-label="Optional real AI market analysis">
   <div className={styles.agentTitle}><Bot size={18}/>
    <div><strong>Model-generated market explanation</strong>
     <small>Grounded in real Nado indexer + engine evidence, never execution</small></div></div>
   {!config.data?.modelEnabled?<p className={styles.muted} role="status">
     Protected generative AI is not activated on this deployment. It requires the AI Gateway,
     private Redis authentication and an operator-enabled feature flag. The read-only market
     evidence above still works without AI.
    </p>:
    <>
     <p className={styles.muted}>A one-time wallet message signature proves account control for this
      explanation only. No token approvals, trades or wallet spending permissions are requested.</p>
     <button type="button" className={styles.parseButton} disabled={!ready||busy}
      onClick={()=>void explain()}><LockKeyhole size={14}/> {busy?"Authenticating and checking live evidence…":"Sign message and ask AI to explain"}</button>
     {!walletReady&&<p className={styles.muted}>Connect a wallet on Ink Mainnet (57073) to use the optional AI explanation.</p>}
     {error&&<p className={styles.warning} role="alert"><AlertTriangle size={14}/>{error}</p>}
     {result&&<div className={styles.modelResult} role="status">
       <strong>{result.kind==="ai-market"?"AI explanation · "+result.model:"Deterministic fallback"}</strong>
       {result.narrative&&<p>{result.narrative}</p>}
       <p>{result.note}</p>
       {result.evidence.status!=="observed"&&result.evidence.reasons.map((r,i)=><p key={i}>{r}</p>)}
      </div>}
    </>
   }
   <p className={styles.modelFootnote}><ShieldCheck size={14}/> No autonomous trades, orders or signed transactions. Model output is not investment advice and must be checked against the verified numerical evidence.</p>
  </section>;
}
