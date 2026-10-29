"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Bot, ShieldCheck, CircleHelp, RefreshCw, LockKeyhole, Send, AlertCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { WalletButton } from "@/components/wallet-button";
import { ink } from "@/lib/ink";
import { INTENTS, classifyBriefIntent, buildReadOnlyBrief, type BriefIntent, type CapitalBrief } from "@/lib/agent/brief";
import type { NadoAccountResponse } from "@/lib/nado/types";
import type { TydroAccountResponse } from "@/lib/tydro/types";
import type { FeedState } from "@/lib/risk/alerts";

async function getJson<T>(url:string,signal?:AbortSignal):Promise<T>{
  const response=await fetch(url,{cache:"no-store",signal});
  if(!response.ok)throw Error("Protocol provider unavailable.");
  return response.json() as Promise<T>;
}
export default function AgentPage(){
  const {address,isConnected,chainId}=useAccount();
  const connected=isConnected&&chainId===ink.id&&Boolean(address);
  const [question,setQuestion]=useState("");
  const [intent,setIntent]=useState<BriefIntent>("overview");
  const [asked,setAsked]=useState(false);
  const [unsupported,setUnsupported]=useState(false);
  const n=useQuery({
    queryKey:["nado-account",address?.toLowerCase()],
    queryFn:({signal})=>getJson<NadoAccountResponse>("/api/nado/account?address="+encodeURIComponent(address!),signal),
    enabled:connected,retry:1,staleTime:30000,refetchInterval:connected?60000:false,
  });
  const t=useQuery({
    queryKey:["tydro-account",address?.toLowerCase()],
    queryFn:({signal})=>getJson<TydroAccountResponse>("/api/tydro/account?address="+encodeURIComponent(address!),signal),
    enabled:connected,retry:1,staleTime:30000,refetchInterval:connected?60000:false,
  });
  const nfeed:FeedState<NadoAccountResponse>={status:n.isPending?"loading":n.isError?"error":"success",data:n.data};
  const tfeed:FeedState<TydroAccountResponse>={status:t.isPending?"loading":t.isError?"error":"success",data:t.data};
  const brief:CapitalBrief|null=asked&&connected&&address?buildReadOnlyBrief({intent,wallet:address,nado:nfeed,tydro:tfeed}):null;
  function select(next:BriefIntent){
    setIntent(next);setQuestion(INTENTS.find(x=>x.id===next)?.prompt??"");setUnsupported(false);setAsked(true);
  }
  function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const next=classifyBriefIntent(question);
    if(next){setIntent(next);setAsked(true);setUnsupported(false);}
    else {setUnsupported(true);setAsked(false);}
  }
  return <div className="site agent-site"><SiteHeader/>
    <main className="shell agent-main">
      <Link href="/workspace" className="back-link"><ArrowLeft size={15}/> Back to capital workspace</Link>
      <div className="agent-head"><div><span className="eyebrow">M05 / GUIDED CAPITAL ANALYSIS</span><h1>Meet your capital assistant<span className="title-period">.</span></h1>
        <p>Ask supported questions about your Ink portfolio. The first release turns verified account readings into transparent, rule-based explanations.</p></div>
        <div className="agent-version"><Bot size={16}/> READ-ONLY PREVIEW</div>
      </div>
      <div className="agent-layout">
        <section className="agent-chat">
          <div className="agent-chat-header"><span><Bot size={18}/> Symb-II capital assistant</span><span>INK · GUIDED MODE</span></div>
          <div className="agent-intro"><span className="agent-icon"><Bot size={25}/></span><h2>Start with what your capital is doing.</h2>
            <p>I can summarise Nado positions, Tydro debt, protocol health warnings and a practical review checklist. I cannot trade or invent missing figures.</p></div>
          {!connected?<div className="agent-empty"><LockKeyhole size={22}/><strong>Connect an Ink wallet</strong><p>Account analysis is available once your wallet is connected. No transaction signature or private key is required.</p><WalletButton/></div>:
            <>
              <div className="agent-intents">{INTENTS.map(i=><button type="button" key={i.id} className={intent===i.id&&asked?"agent-choice selected":"agent-choice"} onClick={()=>select(i.id)}>{i.label} <ArrowRight size={13}/></button>)}</div>
              <form className="agent-form" onSubmit={submit}>
                <label htmlFor="agent-question">Ask a supported read-only question</label>
                <div><input id="agent-question" value={question} onChange={e=>setQuestion(e.target.value)} maxLength={300} placeholder="How is my Tydro lending health?" />
                  <button className="btn btn-primary" type="submit" disabled={!question.trim()}><Send size={15}/> Analyse</button>
                </div>
              </form>
              {unsupported&&<div className="agent-unsupported" role="status"><CircleHelp size={16}/> I can currently answer the five guided question types above. Generative AI and transactional commands are not enabled.</div>}
              {brief&&<div className="agent-answer" aria-live="polite">
                <div className="agent-answer-head"><strong>{brief.title}</strong><span>{brief.complete?"CURRENT SNAPSHOT":"LIMITED DATA"}</span></div>
                <ul>{brief.lines.map((line,index)=><li key={index}>{line}</li>)}</ul>
                {brief.limitations.length>0&&<div className="agent-limitations"><AlertCircle size={16}/><div><strong>Data limitations</strong>{brief.limitations.map((x,i)=><p key={i}>{x}</p>)}</div></div>}
                <div className="agent-sources"><strong>Source references</strong>{brief.sources.length?brief.sources.map((s,i)=><span key={i}>{s}</span>):<span>No verified source available</span>}</div>
                <div className="agent-guardrail"><ShieldCheck size={15}/> Deterministic account summary · No AI model inference · No trades or approvals</div>
              </div>}
            </>}
        </section>
        <aside className="agent-sidebar">
          <div className="agent-side-card"><span className="eyebrow">LIVE ACCOUNT SOURCES</span>
            <h3>Verified protocol readings</h3>
            <div><strong>Nado</strong><span>{!connected?"Connect wallet":n.isPending?"Loading":n.isError?"Unavailable":n.data?.incomplete?"Partial":"Read-only"}</span></div>
            <div><strong>Tydro</strong><span>{!connected?"Connect wallet":t.isPending?"Loading":t.isError?"Unavailable":t.data?.incomplete?"Partial":"Read-only"}</span></div>
            {connected&&<button type="button" className="btn btn-secondary" onClick={()=>{void n.refetch();void t.refetch();}} disabled={n.isFetching||t.isFetching}><RefreshCw size={15}/> Refresh sources</button>}
          </div>
          <div className="agent-side-card">
            <span className="eyebrow">WHAT IS NOT ENABLED</span><h3>Clear execution boundaries</h3>
            <p>No model-generated financial instructions, unrestricted tools, position closing, automatic repayments or agent signing authority.</p>
            <p>Generative model integration requires a separately secured API, abuse controls, evaluations and permission enforcement. It is not active in this release.</p>
          </div>
          <Link href="/workspace#risk" className="agent-side-link">Inspect detailed risk and simulations <ArrowRight size={16}/></Link>
        </aside>
      </div>
    </main><SiteFooter/></div>;
}
