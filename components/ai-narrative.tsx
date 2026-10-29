"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSignMessage } from "wagmi";
import { Bot, LockKeyhole, ShieldCheck, AlertTriangle } from "lucide-react";
import type { BriefIntent, CapitalBrief } from "@/lib/agent/brief";

type Config={modelEnabled:boolean;guided:boolean;walletSignatureRequired:boolean;tradingEnabled:boolean};
type AgentReply=
  |{kind:"ai";narrative:string;brief:CapitalBrief;model:string;note:string}
  |{kind:"guided-fallback";brief:CapitalBrief;note:string};

async function request<T>(url:string,body:unknown):Promise<T>{
  const res=await fetch(url,{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body),cache:"no-store",
  });
  const content=await res.json().catch(()=>({})) as {error?:string};
  if(!res.ok)throw Error(content.error??"Request unavailable.");
  return content as T;
}
export function AINarrative({wallet,intent,question,briefComplete}:{
  wallet:string;intent:BriefIntent;question:string;briefComplete:boolean;
}){
  const {signMessageAsync}=useSignMessage();
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [answer,setAnswer]=useState<AgentReply|null>(null);
  const {data:config,isPending:configPending}=useQuery({
    queryKey:["agent-config"],
    queryFn:async()=>{
      const response=await fetch("/api/agent/config",{cache:"no-store"});
      if(!response.ok)throw Error("Configuration unavailable.");
      return response.json() as Promise<Config>;
    },staleTime:60000,retry:1,
  });

  async function generate(){
    if(loading||!config?.modelEnabled||!briefComplete)return;
    setLoading(true);setError("");setAnswer(null);
    try{
      // This signature is a one-use proof of wallet control, not a transaction.
      const challenge=await request<{message:string;challengeId:string}>("/api/agent/challenge",{wallet});
      const signature=await signMessageAsync({message:challenge.message});
      const response=await request<AgentReply>("/api/agent/explain",{
        wallet,challengeId:challenge.challengeId,message:challenge.message,
        signature,intent,question,
      });
      setAnswer(response);
    }catch(err){
      setError(err instanceof Error?err.message:"Unable to generate the AI explanation.");
    }finally{setLoading(false);}
  }
  return <section className="ai-narrative" aria-label="Optional AI narrative">
    <div className="ai-narrative-heading"><Bot size={19}/><div>
      <strong>Optional AI explanation</strong>
      <p>Generative AI can explain a verified capital brief but cannot trade or receive signing permissions.</p>
    </div></div>
    {configPending?<p className="ai-narrative-message">Checking model availability…</p>:
      !config?.modelEnabled?<p className="ai-narrative-message">Guided mode is operational. Generative AI will become available after its protected Gateway, signature and rate-limit services are configured.</p>:
      <>
        <div className="ai-narrative-action">
          <button className="btn btn-secondary" type="button" disabled={loading||!briefComplete} onClick={()=>void generate()}>
            <LockKeyhole size={15}/>{loading?"Authenticating and analysing…":"Sign in and ask AI to explain"}
          </button>
          {!briefComplete&&<span>Complete, fresh Nado and Tydro readings are required for an AI explanation.</span>}
        </div>
        <p className="ai-narrative-message">This requests a one-time wallet message signature. It is not a blockchain transaction or spending approval. Each successful model request is rate-limited.</p>
        {error&&<div className="ai-narrative-error" role="alert"><AlertTriangle size={16}/>{error}</div>}
        {answer&&<div className="ai-narrative-output" role="status">
          {answer.kind==="ai"?<><span className="eyebrow">MODEL EXPLANATION · {answer.model}</span><p>{answer.narrative}</p>
            <div className="ai-narrative-note">{answer.note}</div></>:
            <><span className="eyebrow">DETERMINISTIC FALLBACK</span><p>{answer.note}</p>
              <p>{answer.brief.lines.join(" ")}</p></>}
        </div>}
        <div className="ai-narrative-guard"><ShieldCheck size={14}/> Live account data is rechecked server-side after wallet verification. The model cannot access keys, permissions or transaction methods.</div>
      </>}
  </section>;
}
