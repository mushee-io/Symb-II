import Link from "next/link";
import { ArrowRight, ArrowUpRight, BrainCircuit, ChartNoAxesCombined, LockKeyhole, Network, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TerminalPreview } from "@/components/terminal-preview";

const capabilities = [
  { icon: ChartNoAxesCombined, title: "One capital view", description: "A unified interface for trading exposure, collateral and lending health—once our protocol connectors are ready." },
  { icon: BrainCircuit, title: "Intelligence, not guesswork", description: "An AI operator designed to use verified account information and deterministic risk calculations." },
  { icon: LockKeyhole, title: "Your wallet. Your call.", description: "Non-custodial access. Future actions will require clear, user-controlled authorisation." },
];

export default function HomePage() {
  return (
    <div className="site">
      <SiteHeader/>
      <main>
        <section className="hero">
          <div className="hero-grid shell">
            <div className="hero-left">
              <div className="hero-kicker"><span className="kicker-dot"/> BUILT EXCLUSIVELY ON INK <span className="kicker-slash">/</span> MILESTONE 01</div>
              <h1>Your capital.<br/><span>Clearer than ever.</span></h1>
              <p className="hero-description">Meet Symb-II, the AI capital operator built for Ink. One intelligent workspace to understand your positions, protect your downside and act with confidence.</p>
              <div className="hero-actions">
                <Link href="/workspace" className="btn btn-primary btn-large">Enter workspace <ArrowRight size={17}/></Link>
                <a href="#how-it-works" className="btn btn-secondary btn-large">Explore the vision <ArrowUpRight size={16}/></a>
              </div>
              <div className="hero-assurance"><ShieldCheck size={16}/><span>Non-custodial foundation</span><span className="assurance-divider"/> <Network size={16}/><span>Ink mainnet · Chain 57073</span></div>
            </div>
            <div className="hero-right"><div className="hero-glow"/><TerminalPreview/></div>
          </div>
          <div className="hero-bottom-line shell"><span>01 / OUR FOUNDATION</span><span>INTELLIGENCE FOR ONCHAIN CAPITAL</span></div>
        </section>
        <section id="how-it-works" className="section section-intro shell">
          <div className="section-heading"><span className="eyebrow section-label">01 — THE IDEA</span><h2>Not another exchange.<br/><span>A better way to navigate DeFi.</span></h2><p>Symb-II will sit above existing Ink protocols, bringing your accounts and risk into one coherent experience. The platform does not operate its own exchange.</p></div>
          <div className="feature-grid">{capabilities.map(({icon:Icon,title,description},i)=><div className="feature-card" key={title}><div className="feature-number">0{i+1}</div><div className="feature-icon"><Icon size={24} strokeWidth={1.5}/></div><h3>{title}</h3><p>{description}</p></div>)}</div>
        </section>
        <section id="integrations" className="section integrations-section">
          <div className="shell">
            <div className="section-heading section-heading-split"><div><span className="eyebrow section-label">02 — NATIVE ECOSYSTEM</span><h2>Made for Ink.<br/><span>Connected by design.</span></h2></div><p>Nado market views and Tydro lending intelligence are integrated as read-only connections. Transaction execution is planned for later milestones.</p></div>
            <div className="integration-grid">
              <div className="integration-card"><div className="integration-icon nado-icon">N</div><div className="integration-meta">TRADING / READ-ONLY M2</div><h3>Nado</h3><p>Real Nado tickers, wallet-linked positions and order records, available in the Symb-II workspace without signing.</p><a href="https://nado.finance/" target="_blank" rel="noreferrer">Visit Nado <ArrowUpRight size={15}/></a></div>
              <div className="integration-card"><div className="integration-icon tydro-icon">T</div><div className="integration-meta">LENDING / READ-ONLY M3</div><h3>Tydro</h3><p>Live reserve rates, account supply and borrow balances, and health factors from Ink-native Tydro contracts. No lending execution yet.</p><a href="https://tydro.com/" target="_blank" rel="noreferrer">Visit Tydro <ArrowUpRight size={15}/></a></div>
            </div>
          </div>
        </section>
        <section className="section closing-section shell">
          <div className="closing-card">
            <div className="closing-orbit"><Sparkles size={31}/></div>
            <span className="eyebrow">EARLY FOUNDATION RELEASE</span>
            <h2>Built for how capital<br/><span>should move.</span></h2>
            <p>Wallet connection is live in the first milestone. AI analysis, risk calculations and protocol operations are scheduled for later builds.</p>
            <Link href="/workspace" className="btn btn-primary btn-large">Open the workspace <ArrowRight size={17}/></Link>
            <div className="closing-tags"><span><Smartphone size={13}/> Responsive web</span><span><ShieldCheck size={13}/> Explicit approvals</span><span><Network size={13}/> Ink only</span></div>
          </div>
        </section>
      </main>
      <SiteFooter/>
    </div>
  );
}
