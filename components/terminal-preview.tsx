import { Activity, ArrowUpRight, ChartNoAxesCombined, Layers3, LockKeyhole, ShieldCheck } from "lucide-react";

export function TerminalPreview() {
  return (
    <div className="terminal-shell" aria-label="Symb-II product preview, integrations are not yet live">
      <div className="terminal-top">
        <span className="terminal-top-label"><span className="mini-symbol">✳</span> SYMB-II / WORKSPACE</span>
        <span className="terminal-preview-label">PRODUCT PREVIEW</span>
      </div>
      <div className="terminal-inside">
        <div className="terminal-headline">
          <div>
            <span className="eyebrow">YOUR CAPITAL AT A GLANCE</span>
            <h3>Everything in view.</h3>
          </div>
          <span className="preview-network">● INK</span>
        </div>
        <div className="preview-total">
          <span>Unified capital</span>
          <strong>Connect your wallet</strong>
          <small>We never display synthetic account balances.</small>
        </div>
        <div className="preview-chart">
          <div className="chart-grid" />
          <svg viewBox="0 0 500 160" role="img" aria-label="Decorative illustration, not real portfolio data">
            <defs><linearGradient id="line" x1="0" x2="1"><stop stopColor="#a5f5cd"/><stop offset="1" stopColor="#c5abff"/></linearGradient></defs>
            <path d="M0 141 C45 129 54 150 94 116 S161 121 190 89 S253 115 292 71 S352 94 401 42 S453 74 500 13" fill="none" stroke="url(#line)" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          <span className="chart-note">Illustration only · no live market data</span>
        </div>
        <div className="terminal-three">
          <div><ChartNoAxesCombined size={18}/><span>Nado positions</span><b>View in workspace</b></div>
          <div><Layers3 size={18}/><span>Tydro lending</span><b>View in workspace</b></div>
          <div><ShieldCheck size={18}/><span>Portfolio risk</span><b>Planned</b></div>
        </div>
        <div className="terminal-agent"><Activity size={17}/><span>Live Nado account data is in the workspace; agent and execution are not yet available.</span><ArrowUpRight size={16}/></div>
      </div>
    </div>
  );
}
