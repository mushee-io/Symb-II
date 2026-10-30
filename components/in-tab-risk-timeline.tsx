"use client";
import {useEffect,useState} from "react";
import {History,ShieldAlert,Trash2} from "lucide-react";
import type {AlertInput} from "@/lib/risk/alerts";
import {
  advanceInTabRiskTimeline,clearInTabRiskTimeline,emptyInTabRiskTimeline,
  type InTabRiskEvent,
} from "@/lib/risk/in-tab-timeline";

type Props=AlertInput&{now:number};
function eventTitle(e:InTabRiskEvent){
  if(e.kind==="recovery")return "Warning conditions cleared in the observed snapshots";
  if(e.kind==="initial")return "Initial risk observations";
  return "Risk warning set changed";
}
export function InTabRiskTimeline({wallet,nado,tydro,now}:Props){
  const [history,setHistory]=useState(()=>emptyInTabRiskTimeline(wallet));
  useEffect(()=>{
    setHistory(previous=>advanceInTabRiskTimeline(previous,{wallet,nado,tydro},now));
  },[wallet,nado.status,nado.data,tydro.status,tydro.data,now]);
  // On account switches the previous account's history must not flash in
  // the new account's render before the reset effect has run.
  const visible=history.wallet===wallet.toLowerCase()?
    history:emptyInTabRiskTimeline(wallet);
  return <section className="m11-timeline" aria-labelledby="m11-timeline-title">
    <div className="m11-timeline-top">
      <div>
        <span className="eyebrow">M11 / LIVE TAB DIAGNOSTICS</span>
        <h3 id="m11-timeline-title"><History size={19}/> Risk event timeline</h3>
        <p>Changes in Nado/Tydro warning conditions observed while this workspace tab is open. Events are retained only in browser memory for this tab.</p>
      </div>
      <button type="button" className="btn btn-secondary" disabled={!visible.events.length}
        onClick={()=>setHistory(previous=>clearInTabRiskTimeline(previous,wallet))}>
        <Trash2 size={14}/> Clear tab history
      </button>
    </div>
    {visible.events.length===0?
      <p className="m11-timeline-empty">No recorded changes in this tab. Both feeds must finish loading before an observation is recorded.</p>:
      <ol className="m11-timeline-list" aria-label="Recently observed risk changes">
        {visible.events.slice(0,12).map((event,index)=>
          <li key={event.at+"-"+index} className="m11-timeline-event">
            <div className="m11-timeline-dot"><ShieldAlert size={15}/></div>
            <div className="m11-timeline-details">
              <div className="m11-timeline-event-head">
                <strong>{eventTitle(event)}</strong>
                <time dateTime={event.at}>{new Date(event.at).toLocaleTimeString()}</time>
              </div>
              <p>{event.critical} critical · {event.warning} warnings · {event.kind==="recovery"?
                "Both latest account feeds were complete and recent; this is not a guarantee of safety.":
                "Current snapshots only; check the protocols directly."}</p>
              {event.details.length>0&&
                <div className="m11-timeline-sources">{event.details.map((a,i)=>
                  <span key={i}>{a.source} · {a.level} · {a.title}</span>)}</div>}
            </div>
          </li>)}
      </ol>}
    <p className="m11-timeline-disclaimer">Up to 40 changes are held in memory (12 displayed). Nothing is stored locally or uploaded by this timeline. History resets on disconnect, wallet change, reload or tab close; it is not an audit record, delivery receipt, 24/7 monitoring or liquidation protection.</p>
  </section>;
}
