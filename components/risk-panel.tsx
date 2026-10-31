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
import {PreflightPanel} from "@/components/preflight-panel";
import type { NadoAccountResponse } from "@/lib/nado/types";
import type { TydroAccountResponse } from "@/lib/tydro/types";
import { nadoRiskState, tydroRiskState, type RiskState } from "@/lib/risk/status";
import {TYDRO} from "@/lib/tydro/contracts";

async function load<T>(url:string,signal?:AbortSignal):Promise<T>{
  const response=await fetch(url,{signal,cache:"no-store"});
  if(!response.ok) throw new Error("Protocol data unavailable.");
  return response.json() as Promise<T>;
}
function color(state:RiskState){return state==="urgent"?"risk-urgent":state==="caution"?"risk-caution":state==="above-warning-level"?"risk-okay":"risk-unknown";}
function stateLabel(state:RiskState){
  switch(state){case "urgent":return "Urgent review";case "caution":return "Close to protocol threshold";case "above-warning-level":return "Above display warning level";case "no-exposure":return "No active borrowing / margin found";default:return "Unknown";}
}
export function RiskPanel({mode="risk"}:{mode?:"risk"|"rescue"|"preflight"|"monitor"}={}){
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
  // The Pool only reports a null health factor on a debt-free account.
  // Never turn a missing borrower's HF, stale state or malformed wallet data
  // into a reassuring "No debt" label.
  const t=tydro.data;
  const observedAt=t?Date.parse(t.updatedAt):NaN;
  const tSourceValid=Boolean(t&&t.chainId===57073&&
    typeof t.address==="string"&&t.address.toLowerCase()===address?.toLowerCase()&&
    typeof t.pool==="string"&&t.pool.toLowerCase()===TYDRO.pool.toLowerCase()&&
    t.incomplete===false&&Array.isArray(t.warnings)&&t.warnings.length===0&&
    Number.isFinite(observedAt)&&observedAt<=Date.now()+5000&&
    Date.now()-observedAt>=0&&Date.now()-observedAt<180000);
  const tstate:RiskState=tSourceValid&&t?
    tydroRiskState(t.healthFactor,t.debtBase):"unknown";
  const headings={
    risk:["M04 / LIVE ACCOUNT RISK","Protocol risk monitor","Side-by-side, separately calculated Nado margin health and Tydro lending health. No shared collateral or fictitious combined liquidation level."],
    rescue:["M06 / WHAT-IF ANALYSIS","Portfolio rescue scenarios","Inspect two independent, hypothetical reductions in Nado position size and Tydro debt. No trade, repayment or automatic rescue occurs."],
    preflight:["M06 / GUARDED DIAGNOSTICS","Pre-execution preflight","Review protected read-only account, allowance, price and gas checks. The live feature is disabled until private security verification."],
    monitor:["M04 + M07 / OBSERVABILITY","Wallet risk alerts","In-tab alert transitions and the status of the optional daily signed watch. Email and mobile push delivery remain disabled."],
  } as const;
  const [eyebrow,title,description]=headings[mode];
  return <section className="nado-section workspace-feature-panel" id={mode==="rescue"?"portfolio-rescue":mode==="monitor"?"risk-alerts":mode} aria-labelledby="risk-panel-title">
    <div className="nado-heading"><div><span className="eyebrow">{eyebrow}</span><h2 id="risk-panel-title">{title}</h2><p>{description}</p></div>
      <span className="risk-pill">READ-ONLY SIGNALS</span>
    </div>
    {mode==="risk" && (!connected?<div className="nado-state nado-wallet-state"><Wallet size={24}/><strong>Connect an Ink wallet to inspect risk</strong><span>No signatures or private credentials required. Connect to inspect live Nado PnL sensitivity, Tydro lending health and the cross-protocol exposure inventory.</span></div>:
      <div className="risk-cards">
        <div className="risk-card">
          <div className="risk-card-head"><span>Nado</span><a href="/workspace/nado">Open positions <ArrowUpRight size={13}/></a></div>
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
          <div className="risk-card-head"><span>Tydro</span><a href="/workspace/tydro">Lending details <ArrowUpRight size={13}/></a></div>
          {tydro.isPending?<p className="risk-loading">Loading on-chain health factor…</p>:
            tydro.error?<p className="risk-message">Tydro lending risk unavailable. No safe status can be inferred.</p>:
            tydro.data&&<>
              <div className={"risk-condition "+color(tstate)}>{stateLabel(tstate)}</div>
              <div className="risk-value">{tstate==="no-exposure"?"No debt":
                tstate==="unknown"?"Unavailable":
                Number(tydro.data.healthFactor).toFixed(3)+"×"}</div>
              <small>{tstate==="no-exposure"?"Verified account snapshot reports zero debt":
                tstate==="unknown"?"Debt, wallet or health data is missing, inconsistent or stale. No safe state can be inferred.":
                "Tydro's on-chain health factor; liquidation can be possible below 1.0"}</small>
              {tydro.data.warnings.length>0&&<p className="risk-message">{tydro.data.warnings.length} Tydro query warnings; this view may be incomplete.</p>}
              <div className="nado-source">Tydro Pool · Retrieved {new Date(tydro.data.updatedAt).toLocaleTimeString()}</div>
            </>}
        </div>
      </div>)}
    {mode==="monitor" && !connected && <div className="nado-state nado-wallet-state"><Wallet size={24}/><strong>Connect your Ink wallet to inspect alerts</strong><span>No sample warnings or synthetic risk history will be shown.</span></div>}
    {mode==="monitor" && connected && address && <RiskAlerts wallet={address} nado={{status:nado.isPending?"loading":nado.isError?"error":"success",data:nado.data}} tydro={{status:tydro.isPending?"loading":tydro.isError?"error":"success",data:tydro.data}} fetching={nado.isFetching||tydro.isFetching}/>}
    {mode==="monitor" && connected && address && <PersistentWatch key={address.toLowerCase()} wallet={address}/>}
    {mode==="rescue" && !connected && <div className="rescue-lab" id="portfolio-rescue" aria-labelledby="rescue-preview-title">
      <div className="rescue-head"><div><span className="eyebrow">M06 / PORTFOLIO RESCUE PREVIEW</span>
        <h2 id="rescue-preview-title">Explore risk scenarios, not automatic trades.</h2>
        <p>Connect an Ink wallet to compare your actual Nado position sensitivity and Tydro lending health in separate, non-executable models.</p>
      </div><span className="rescue-lock"><ShieldCheck size={16}/> READ-ONLY</span></div>
      <div className="nado-state nado-wallet-state"><Wallet size={22}/><strong>Connect on Ink to unlock account-based scenarios</strong>
        <span>No example holdings, generated trade plans or fabricated wallet data will be displayed.</span></div>
    </div>}
    {mode==="rescue" && connected && address && <RescueLab wallet={address} nado={nado.data} tydro={tydro.data}/>}
    {mode==="preflight" && !connected && <div className="preflight-panel" id="preflight" aria-labelledby="preflight-disconnected-title">
      <div className="preflight-heading"><div><span className="eyebrow">M06 / GUARDED PREFLIGHT PREVIEW</span>
        <h2 id="preflight-disconnected-title">Inspect permissions, not just positions.</h2>
        <p>Connect a wallet on Ink to inspect a real Tydro variable-debt asset and its existing allowance, price-independent approval diagnostic, gas screening and transaction simulation checks.</p>
      </div><span>READ-ONLY</span></div>
      <div className="nado-state nado-wallet-state"><Wallet size={22}/>
        <strong>Connect to view account-specific preflight checks</strong>
        <span>Live checking also requires its private backend security switch. No example approvals or invented costs are shown.</span>
      </div>
    </div>}
    {mode==="preflight" && connected && address && <PreflightPanel key={address.toLowerCase()} wallet={address} nado={nado.data} tydro={tydro.data}/>}
    {mode==="risk" && connected && nado.data && tydro.data && <ExposureOverview nado={nado.data} tydro={tydro.data}/>}
    {mode==="risk" && connected && nado.data && <NadoStress account={nado.data}/>}
    {mode==="risk" && connected && tydro.data && <TydroStress account={tydro.data}/>}
    {mode==="risk" && <div className="risk-warning"><ShieldAlert size={18}/><span>Risk status above reflects snapshots; the optional Nado and Tydro what-if models use bounded simplifying assumptions and are not guarantees. Nado maintenance health and Tydro health factor have different units and liquidation rules. A positive reading does not ensure safety during volatile markets or stale data.</span></div>}
  </section>;
}
