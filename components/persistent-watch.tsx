"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSignMessage } from "wagmi";
import { BellRing, History, LockKeyhole, ShieldCheck, ShieldAlert } from "lucide-react";
import type { WatchAction,WatchEvent } from "@/lib/watch/policy";

type Config={enabled:boolean;schedule:string;maxAccountsPerRun:number;notificationsDelivered:boolean;signatureRequired:boolean};
type WatchResponse={subscribed:boolean;lastChecked?:string|null;events?:WatchEvent[]};
async function post<T>(path:string,data:unknown):Promise<T>{
  const res=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data),cache:"no-store"});
  const payload=await res.json().catch(()=>({})) as {error?:string};
  if(!res.ok)throw Error(payload.error??"Watch API unavailable.");
  return payload as T;
}
export function PersistentWatch({wallet}:{wallet:string}){
  const {signMessageAsync}=useSignMessage();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [status,setStatus]=useState<WatchResponse|null>(null);
  const {data:config,isPending}=useQuery({
    queryKey:["persistent-watch-config"],
    queryFn:async()=>{
      const res=await fetch("/api/watch/config",{cache:"no-store"});
      if(!res.ok)throw Error("Watch configuration is unavailable.");
      return res.json() as Promise<Config>;
    },retry:1,staleTime:60000,
  });

  async function invoke(action:WatchAction){
    if(busy||!config?.enabled)return;
    setBusy(true);setError("");
    try{
      const challenge=await post<{message:string;challengeId:string}>("/api/watch/challenge",{wallet,action});
      // The wallet signs a plain message; no transaction or token allowance is requested.
      const signature=await signMessageAsync({message:challenge.message});
      const response=await post<WatchResponse>("/api/watch/manage",{
        wallet,action,challengeId:challenge.challengeId,message:challenge.message,signature
      });
      if(action==="status")setStatus(response);
      else if(action==="unsubscribe")setStatus({subscribed:false,events:[],lastChecked:null});
      else setStatus({subscribed:true,events:[],lastChecked:null});
    }catch(e){setError(e instanceof Error?e.message:"Watch action failed.");}
    finally{setBusy(false);}
  }
  return <section className="persistent-watch" aria-labelledby="persistent-watch-title">
    <div className="persistent-watch-head"><span className="stress-emblem"><History size={19}/></span>
      <div><span className="eyebrow">OPT-IN / SERVER-SIDE MONITORING</span>
        <h3 id="persistent-watch-title">Scheduled risk-watch history</h3>
        <p>Store minimal risk status changes for this Ink wallet. No spending permissions, price execution or notification delivery.</p>
      </div></div>
    {isPending?<p className="persistent-watch-note">Checking watch availability…</p>:
      !config?.enabled?<div className="persistent-watch-off"><ShieldAlert size={17}/><span>Scheduled monitoring is not enabled on this deployment. Live in-browser alerts remain available above. A private Redis store, watch switch and cron secret are required.</span></div>:
      <>
        <p className="persistent-watch-note">{config.schedule}. The worker currently checks up to {config.maxAccountsPerRun} least-recently-checked wallets per run; more subscriptions can mean less frequent coverage. Alerts are saved for later inspection—not delivered automatically.</p>
        <div className="persistent-watch-actions">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>void invoke("status")}>
            <History size={15}/>{busy?"Confirming…":"Sign to view watch status"}
          </button>
          {status?.subscribed?
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>void invoke("unsubscribe")}>Unsubscribe & delete history</button>:
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>void invoke("subscribe")}>
              <BellRing size={15}/> Consent to periodic monitoring
            </button>}
        </div>
        {error&&<div className="ai-narrative-error" role="alert">{error}</div>}
        {status&&<div className="persistent-watch-status" role="status">
          <strong>{status.subscribed?"Subscription active":"Not subscribed"}</strong>
          <span>{status.lastChecked?"Last scheduled check: "+new Date(status.lastChecked).toLocaleString():"No completed scheduled checks recorded yet."}</span>
          {status.events?.map((event,i)=><div className="persistent-watch-event" key={event.at+"-"+i}>
            <div><strong>{event.kind==="recovery"?"No flagged conditions in snapshot":event.kind==="initial"?"Initial snapshot":"Risk status changed"}</strong><small>{new Date(event.at).toLocaleString()}</small></div>
            <p>{event.critical} critical / {event.warning} warnings. {event.details.length?"See affected protocols below.":"Absence of warnings does not prove safety."}</p>
            {event.details.map(d=><p key={d.id}>{d.source} · {d.level} · {d.title}</p>)}
          </div>)}
        </div>}
      </>}
    <div className="persistent-watch-footer"><LockKeyhole size={14}/><span>Subscription changes require a one-time wallet signature and can be revoked. No account balances, trade history or raw positions are stored by this watch. This is not emergency liquidation protection.</span></div>
    <div className="m13-delivery-note" aria-label="Notification delivery not active">
      <BellRing size={17}/>
      <div><strong>M13 / External notifications not active</strong>
        <p>Email and mobile push delivery are not connected. A watch subscription authorises monitoring history only, not outbound alerts. A separate verified delivery opt-in, private queue, provider and live tests are required.</p>
      </div>
    </div>
  </section>;
}
