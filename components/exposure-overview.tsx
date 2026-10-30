"use client";
import { Layers3, ShieldAlert } from "lucide-react";
import type { NadoAccountResponse } from "@/lib/nado/types";
import type { TydroAccountResponse } from "@/lib/tydro/types";
import { buildExposureInventory } from "@/lib/risk/exposures";

export function ExposureOverview({nado,tydro}:{nado:NadoAccountResponse;tydro:TydroAccountResponse}){
  const inventory=buildExposureInventory(nado,tydro);
  return <div className="exposures-panel">
    <div className="stress-heading"><span className="stress-emblem"><Layers3 size={20}/></span>
      <div><span className="eyebrow">INK / CROSS-PROTOCOL EXPOSURE INVENTORY</span>
        <h3>One view. Separate risk systems.</h3>
        <p>Both sources must identify the same Ink wallet. This view does not prove ownership. Quantities remain in native units and Nado margin is not treated as Tydro collateral.</p>
      </div>
    </div>
    <div className="exposure-summary">
      <div><span>Nado open positions</span><strong>{inventory.nadoPositions}</strong><small>Perpetual legs in queried subaccounts</small></div>
      <div><span>Tydro supplied assets</span><strong>{inventory.tydroSuppliedAssets}</strong><small>Number of supplied token balances</small></div>
      <div><span>Tydro borrowed assets</span><strong>{inventory.tydroBorrowedAssets}</strong><small>Number of debt-bearing token balances</small></div>
    </div>
    {inventory.warnings.length>0&&<div className="nado-warning"><ShieldAlert size={17}/><div><strong>Exposure data incomplete or unverified</strong>{inventory.warnings.map((w,i)=><p key={i}>{w}</p>)}</div></div>}
    {inventory.rows.length===0?<div className="nado-state">{inventory.complete?"No positions or lending balances in the complete, current records.":"No verified cross-protocol inventory is available. Refresh the account data and review the warnings above."}</div>:
      <div className="nado-scroll"><table className="nado-table"><thead><tr><th>Protocol</th><th>Market / token</th><th>Exposure type</th><th>Quantity</th><th>Unit</th></tr></thead>
        <tbody>{inventory.rows.map((r,i)=><tr key={r.protocol+r.market+r.kind+i}><td><strong>{r.protocol}</strong></td><td>{r.market}</td><td>{r.kind}</td><td title={r.amount} className="exposure-amount">{r.amount}</td><td>{r.units}</td></tr>)}</tbody>
      </table></div>}
    <p className="nado-source">Snapshot inventory only · No combined USD total, inferred correlations, exchangeable collateral or portfolio-wide liquidation threshold · Partial account coverage is explicitly reported.</p>
  </div>;
}
