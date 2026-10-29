"use client";

import { useState } from "react";
import { AlertTriangle, ArrowDownUp, ChartNoAxesCombined } from "lucide-react";
import type { TydroAccountResponse } from "@/lib/tydro/types";
import { simulateTydroShock } from "@/lib/risk/stress";

const fmt = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(3) : "Unavailable";
};

export function TydroStress({ account }: { account: TydroAccountResponse }) {
  const [shock, setShock] = useState(-20);
  const [assetChoice, setAssetChoice] = useState("");
  const reserves = account.userReserves;
  const selected = reserves.some(r => r.address.toLowerCase() === assetChoice.toLowerCase())
    ? assetChoice : (reserves[0]?.address ?? "");
  const result = simulateTydroShock(account, selected, shock);

  return (
    <div className="stress-panel" aria-labelledby="stress-title">
      <div className="stress-heading">
        <span className="stress-emblem"><ChartNoAxesCombined size={19}/></span>
        <div>
          <span className="eyebrow">TYDRO ONLY / WHAT-IF MODEL</span>
          <h3 id="stress-title">Price shock simulator</h3>
          <p>Estimate how a simultaneous price change in one asset affects your existing Tydro lending health. This does not simulate Nado margin.</p>
        </div>
      </div>
      <div className="stress-controls">
        <label className="stress-field">
          <span>Asset to stress</span>
          <select value={selected} onChange={(e) => setAssetChoice(e.target.value)} disabled={!reserves.length}>
            {reserves.map(r => <option key={r.address} value={r.address}>{r.symbol} · {r.address.slice(0, 8)}</option>)}
          </select>
        </label>
        <div className="stress-field">
          <span>Price move</span>
          <div className="stress-range">
            <input type="range" aria-label="Hypothetical asset price change" min={-50} max={50} step={1} value={shock} onChange={e => setShock(Number(e.target.value))}/>
            <strong className={shock < 0 ? "negative" : "positive"}>{shock > 0 ? "+" : ""}{shock}%</strong>
          </div>
          <div className="stress-presets">{[-40, -20, -10, 10, 20].map(p => <button type="button" key={p} aria-pressed={shock === p} className={shock === p ? "selected" : ""} onClick={() => setShock(p)}>{p > 0 ? "+" : ""}{p}%</button>)}</div>
        </div>
      </div>
      {result.ok ? (
        <>
          <div className="stress-result">
            <div><span>Protocol-reported health factor</span><strong>{fmt(result.currentHealthFactor)}×</strong></div>
            <ArrowDownUp size={18} aria-hidden="true" />
            <div><span>Estimated health after shock</span><strong className={result.state === "urgent" ? "stress-urgent" : result.state === "caution" ? "stress-caution" : ""}>{fmt(result.projectedHealthFactor)}×</strong></div>
          </div>
          <p className="stress-status" role="status">{result.state === "urgent" ? "Model indicates potential liquidation vulnerability under this scenario." : result.state === "caution" ? "Model indicates reduced distance to Tydro's liquidation threshold." : "Estimated health factor is above the display caution threshold."}</p>
          <p className="stress-footnote">Baseline reconciliation difference: {(result.baselineDeviationBps / 100).toFixed(2)}%. The calculation assumes other asset prices, interest accrual, balances, liquidation parameters and wallet actions do not change.</p>
        </>
      ) : (
        <div className="stress-unavailable" role="status"><AlertTriangle size={17}/><span>Scenario unavailable: {result.reason}</span></div>
      )}
      <div className="stress-disclaimer">
        This is an illustrative deterministic sensitivity calculation—not an execution quote, liquidation forecast, oracle update prediction or financial advice. EMode, inconsistent balances, missing prices and partial protocol responses disable the model.
      </div>
    </div>
  );
}
