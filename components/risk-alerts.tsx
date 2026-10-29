"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, ShieldAlert, RefreshCw, Info } from "lucide-react";
import type { NadoAccountResponse } from "@/lib/nado/types";
import type { TydroAccountResponse } from "@/lib/tydro/types";
import { evaluateRiskAlerts, type FeedState } from "@/lib/risk/alerts";

export function RiskAlerts({
  wallet,nado,tydro,fetching,
}:{
  wallet:string;
  nado:FeedState<NadoAccountResponse>;
  tydro:FeedState<TydroAccountResponse>;
  fetching:boolean;
}){
  const [notify,setNotify]=useState(false);
  const [permission,setPermission]=useState<"default"|"granted"|"denied"|"unsupported">("default");
  const [now,setNow]=useState(()=>Date.now());
  const previouslyNotified=useRef(new Set<string>());
  useEffect(()=>{
    const timer=window.setInterval(()=>setNow(Date.now()),30000);
    return ()=>window.clearInterval(timer);
  },[]);
  useEffect(()=>{
    previouslyNotified.current.clear();
    setNotify(false);
    setPermission("default");
  },[wallet]);
  const alerts=evaluateRiskAlerts({wallet,nado,tydro},now);
  const keys=alerts.map(a=>a.id+":"+a.level).join("|");
  useEffect(()=>{
    if(!notify||typeof window==="undefined"||!("Notification" in window)||Notification.permission!=="granted")return;
    const current=new Set(alerts.map(a=>a.id+":"+a.level));
    for(const alert of alerts){
      const key=alert.id+":"+alert.level;
      if(previouslyNotified.current.has(key))continue;
      previouslyNotified.current.add(key);
      try{new Notification("Symb-II • "+alert.title,{body:alert.detail,tag:"symb-ii-"+alert.id});}
      catch{/* in-app alerts stay visible even if system notifications are blocked */}
    }
    for(const key of previouslyNotified.current){
      if(!current.has(key))previouslyNotified.current.delete(key);
    }
  // The key string changes only when severity/id changes; do not repeatedly notify on refreshed timestamps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[notify,keys,wallet]);

  async function enableNotifications(){
    if(typeof window==="undefined"||!("Notification" in window)){
      setPermission("unsupported");return;
    }
    const result=await Notification.requestPermission();
    setPermission(result);
    setNotify(result==="granted");
  }
  function turnOff(){setNotify(false);previouslyNotified.current.clear();}
  return <div className="risk-alert-panel" aria-labelledby="risk-alert-title">
    <div className="risk-alert-header">
      <div><span className="eyebrow">M04 / ACTIVE-TAB MONITORING</span>
        <h3 id="risk-alert-title">Risk watch</h3>
        <p>Refreshes as account feeds update while this page is open. Browser notifications are optional and permission-controlled.</p>
      </div>
      <div className="alert-actions">
        {fetching&&<span className="alert-refresh"><RefreshCw size={13}/> Syncing</span>}
        {!notify?<button type="button" className="btn btn-secondary" onClick={()=>void enableNotifications()}><Bell size={15}/> Enable browser alerts</button>
          :<button type="button" className="btn btn-secondary" onClick={turnOff}><BellOff size={15}/> Disable notifications</button>}
      </div>
    </div>
    <div className="alert-summary">
      <span className="alert-dot"/>
      {alerts.length===0?
        <span>No warning conditions in the currently available snapshots. This does not prove safety.</span>:
        <span>{alerts.filter(a=>a.level==="critical").length} critical · {alerts.filter(a=>a.level==="warning").length} warnings detected. Check source records before taking action.</span>}
    </div>
    {alerts.length>0&&<div className="alert-list" aria-live="polite">{alerts.map(a=>
      <div className={"alert-line alert-"+a.level} key={a.id}>
        <ShieldAlert size={17}/><div><strong>{a.title}</strong><p>{a.detail}</p><small>{a.source} · Observed {Number.isFinite(Date.parse(a.observedAt))?new Date(a.observedAt).toLocaleTimeString():"timestamp unavailable"}</small></div>
      </div>)}</div>}
    {permission==="denied"&&<p className="alert-note">Your browser blocked notifications. In-app warnings remain visible; change notification permissions in your browser settings to enable them.</p>}
    {permission==="unsupported"&&<p className="alert-note">This browser cannot issue system notifications. In-app warnings remain available.</p>}
    <div className="alert-boundary"><Info size={15}/><span>Not a 24/7 monitoring service. Alerts are evaluated only while the workspace stays open and receiving fresh data. Closing the tab, browser throttling, device sleep, network outages or RPC errors can delay or stop them. No server-side watchlist, persistent subscriptions, email/push worker, or liquidation rescue is active.</span></div>
  </div>;
}
