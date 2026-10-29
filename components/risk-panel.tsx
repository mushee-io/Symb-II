"use client";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, AlertTriangle, ShieldCheck, ShieldAlert, Wallet } from "lucide-react";
import { ink } from "@/lib/ink";
import { TydroStress } from "@/components/tydro-stress";
import { NadoStress } from "@/components/nado-stress";
import { ExposureOverview } from "@/components/exposure-overview";
import { RiskAlerts } from "@/components/risk-alerts";
import { PersistentWatch } from "@/components/persistent-watch";
import { RescueLab } from "@/components/rescue-lab";
import type { NadoAccountResponse } from "@/lib/nado/types";
import type { TydroAccountResponse } from "@/lib/tydro/types";
import { nadoRiskState, tydroRiskState, type RiskState } from "@/lib/risk/status";

async function load<T>(url:string,signal?:AbortSignal):Promise<T>{
  const response=await fetch(url,{signal,cache:"no-store"});
  if(!response.ok) throw new Error("Protocol data unavailable.");
  return response.json() as Promise<T>;
}
function color(state:RiskState){return state==="urgent"?"risk-urgent":state==="caution"?"risk-caution":state==="above-warning-level"?"risk-okay":"risk-unknown";}
function stateLabel(state:RiskState){
  switch(state){case "urgent":return "Urgent review";case "caution":return "Close to protocol threshold";case "above-warning-level":return "Above display warning level";case "no-exposure":return "No active borrowing / margin found";default:return "Unknown";}
}
export function RiskPanel(){
  const {address,isConnected,chainId}=useAccount();
  const connected=Boolean(isConnected&&chainId===ink.id&&address);
  const nado=useQuery({
    queryKey:["nado-account",address?.toLowerCase()],
    queryFn:({signal})=>load<NadoAccountResponse>("/api/nado/account?address="+encodeURIComponent(address!),signal),
    enabled:connected,retry:1,staleTime:30000,refetchInterval:connected?60000:false,
  });
  const tydro=useQuery({
    queryKey:["tydro-account",address?.toLowerCase()],
    queryFn:({signal})=>load<TydroAccountResponse>("/api/tydro/account?address="+encodeURIComponent(address!),signal),
    enabled:connected,retry:1,staleTime:30000,refetchInterval:connected?60000:false,
  });
  const tstate=tydro.data?tydroRiskState(tydro.data.healthFactor):"unknown";
  return <section className="nado-section" id="risk" aria-labelledby="risk-panel-title">
    <div className="nado-heading"><div><span className="eyebrow">M04 / RISK MONITOR FOUNDATIONS</span><h2 id="risk-panel-title">Protocol risk monitor</h2><p>Side-by-side, separately calculated Nado margin health and Tydro lending health. No shared collateral, no fictitious combined liquidation level.</p></div>
      <span className="risk-pill">READ-ONLY SIGNALS</span>
    </div>
    {!connected?<div className="nado-state nado-wallet-state"><Wallet size={24}/><strong>Connect an Ink wallet to inspect risk</strong><span>No signatures or private credentials required. Connect to inspect live Nado PnL sensitivity, Tydro lending health and the cross-protocol exposure inventory.</span></div>:
      <div className="risk-cards">
        <div className="risk-card">
          <div className="risk-card-head"><span>Nado</span><a href="#nado">Open positions <ArrowUpRight size={13}/></a></div>
          {nado.isPending?<p className="risk-loading">Loading current Nado margin readings…</p>:
            nado.error?<p className="risk-message">Nado risk unavailable. No safe status can be inferred.</p>:
            nado.data&&<>
              {!nado.data.subaccounts.length?<div className="risk-condition risk-unknown">No cross-margin Nado account found</div>:
                nado.data.subaccountHealth.map(h=>{
                  const state=nadoRiskState(h.maintenanceHealth,h.exists);
                  return <div className="risk-subaccount" key={h.subaccount}>
                    <div><strong>{h.subaccount}</strong><span className={"risk-condition "+color(state)}>{stateLabel(state)}</span></div>
                    <div className="risk-value">{h.exists?Number(h.maintenanceHealth).toLocaleString(undefined,{maximumFractionDigits:3}):"No account"}</div>
                    <small>Maintenance health · Nado engine units (not a health-factor multiple)</small>
                  </div>;
                })}
              {nado.data.warnings.length>0&&<p className="risk-message">{nado.data.warnings.length} Nado query warnings; this view may be incomplete.</p>}
              <div className="nado-source">Nado engine · Retrieved {new Date(nado.data.updatedAt).toLocaleTimeString()}</div>
            </>}
        </div>
        <div className="risk-card">
          <div className="risk-card-head"><span>Tydro</span><a href="#tydro">Lending details <ArrowUpRight size={13}/></a></div>
          {tydro.isPending?<p className="risk-loading">Loading on-chain health factor…</p>:
            tydro.error?<p className="risk-message">Tydro lending risk unavailable. No safe status can be inferred.</p>:
            tydro.data&&<>
              <div className={"risk-condition "+color(tstate)}>{stateLabel(tstate)}</div>
              <div className="risk-value">{tydro.data.healthFactor===null?"No debt":Number(tydro.data.healthFactor).toFixed(3)+"×"}</div>
              <small>{tydro.data.healthFactor===null?"No borrowed funds recorded by Tydro's pool":"Tydro's on-chain health factor; liquidation can be possible below 1.0"}</small>
              {tydro.data.warnings.length>0&&<p className="risk-message">{tydro.data.warnings.length} Tydro query warnings; this view may be incomplete.</p>}
              <div className="nado-source">Tydro Pool · Retrieved {new Date(tydro.data.updatedAt).toLocaleTimeString()}</div>
            </>}
        </div>
      </div>}
    {connected && address && <RiskAlerts wallet={address} nado={{status:nado.isPending?"loading":nado.isError?"error":"success",data:nado.data}} tydro={{status:tydro.isPending?"loading":tydro.isError?"error":"success",data:tydro.data}} fetching={nado.isFetching||tydro.isFetching}/>}
    {connected && address && <PersistentWatch key={address.toLowerCase()} wallet={address}/>}
    {connected && address && <RescueLab wallet={address} nado={nado.data} tydro={tydro.data}/>}
    {connected && nado.data && tydro.data && <ExposureOverview nado={nado.data} tydro={tydro.data}/>}
    {connected && nado.data && <NadoStress account={nado.data}/>}
    {connected && tydro.data && <TydroStress account={tydro.data}/>}
    <div className="risk-warning"><ShieldAlert size={18}/><span>Risk status above reflects snapshots; the optional Nado and Tydro what-if models use bounded simplifying assumptions and is not a guarantee. Nado maintenance health and Tydro health factor have different units and liquidation rules. A positive reading does not ensure safety during volatile markets or stale data.</span></div>
  </section>;
}
