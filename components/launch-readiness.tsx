"use client";
import {useQuery} from "@tanstack/react-query";
import {Activity,CheckCircle2,AlertTriangle,LockKeyhole} from "lucide-react";
import type {LaunchGate} from "@/lib/ops/readiness";

type Readiness={release:string|null;network:"Ink";chainId:57073;services:LaunchGate[];
 allServicesConfigured:boolean;liveCredentialsValidated:false;executionEnabled:false;note:string};
export function LaunchReadiness(){
 const {data,isPending,error,refetch,isFetching}=useQuery({
  queryKey:["symb-ii-launch-readiness"],
  queryFn:async()=>{
    const r=await fetch("/api/ops/readiness",{cache:"no-store"});
    if(!r.ok)throw Error("Readiness endpoint unavailable");
    return r.json() as Promise<Readiness>;
  },staleTime:30000,refetchInterval:60000,retry:1,
 });
 return <section className="ops-panel" id="launch-readiness" aria-label="Milestone seven readiness">
  <div className="ops-panel-heading">
   <div><span className="eyebrow">M07 / INFRASTRUCTURE ACTIVATION</span>
    <h2>Production readiness.</h2>
    <p>Configuration gates, not promises. A configured service is not marked live until its credentials and behavior are independently tested.</p>
   </div><div className="ops-readonly"><LockKeyhole size={15}/> NO EXECUTION</div>
  </div>
  <div className="ops-toolbar"><span>Ink mainnet · chain ID 57073</span>
    <button className="btn btn-secondary" type="button" disabled={isFetching}
      onClick={()=>void refetch()}><Activity size={15}/> Refresh gates</button></div>
  {isPending?<p className="ops-note">Reading production configuration…</p>:
   error||!data?<p className="ops-alert" role="alert">Configuration status unavailable. Never assume any service is enabled.</p>:
   <>
    <div className="ops-gates">
      {data.services.map(g=><div className="ops-gate" key={g.id}>
        <div className="ops-gate-heading"><strong>{g.title}</strong>
         <span className={"ops-gate-state "+g.status}>
          {g.status==="configured"?<CheckCircle2 size={13}/>:<AlertTriangle size={13}/>}
          {g.status==="configured"?"Configured / UNTESTED":g.status==="disabled"?"Disabled":"Credentials missing"}
         </span></div>
        <p>{g.requirements.join(" · ")}</p>
        {g.status==="blocked"&&<p className="ops-gate-issues">{g.issues.join(" ")}</p>}
      </div>)}
    </div>
    <p className="ops-note">Release {data.release??"unavailable"} · Backend credential connectivity not confirmed by this public screen. No transaction permissions or automatic risk rescue are enabled.</p>
   </>}
 </section>;
}
