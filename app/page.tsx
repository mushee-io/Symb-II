import Link from "next/link";
import {Activity,ArrowRight,ArrowUpRight,Bot,ChartNoAxesCombined,Crosshair,Layers3,LockKeyhole,ShieldCheck} from "lucide-react";
import {SiteHeader} from "@/components/site-header";
import {SiteFooter} from "@/components/site-footer";
import {TerminalPreview} from "@/components/terminal-preview";
import styles from "./home-redesign.module.css";

const systems=[
 {index:"01",name:"NADO",detail:"Perpetual markets",note:"Market prices, real candles, position records and order research"},
 {index:"02",name:"TYDRO",detail:"Lending intelligence",note:"Live reserves, supply, borrowing and protocol risk observations"},
 {index:"03",name:"SYMB AI",detail:"Your command layer",note:"Evidence-based research and restricted local trading drafts"},
];

function OrbitalInstrument(){
 return <div className={styles.instrument} aria-label="Decorative Symb-II orbital market graphic, not financial data">
  <div className={styles.instrumentHeading}><span>SYMB / SIGNAL FIELD</span><span>57073 · INK</span></div>
  <svg className={styles.orbitalSvg} viewBox="0 0 620 500" fill="none" role="img" aria-label="Decorative geometric orbital lines">
   <defs>
    <radialGradient id="symbOrbitalCore"><stop offset="0" stopColor="#B8F1BF" stopOpacity=".84"/><stop offset=".62" stopColor="#B2A0E9" stopOpacity=".18"/><stop offset="1" stopColor="#B2A0E9" stopOpacity="0"/></radialGradient>
    <linearGradient id="symbOrbitStroke" x1="0" y1="0" x2="620" y2="500"><stop stopColor="#8A8F8A" stopOpacity=".18"/><stop offset=".52" stopColor="#4B5654" stopOpacity=".35"/><stop offset="1" stopColor="#8A8F8A" stopOpacity=".08"/></linearGradient>
    <linearGradient id="symbSignalLine" x1="80" y1="460" x2="500" y2="25"><stop stopColor="#83D5A1"/><stop offset=".56" stopColor="#8E78E8"/><stop offset="1" stopColor="#65A6A5"/></linearGradient>
   </defs>
   <circle cx="310" cy="248" r="188" fill="url(#symbOrbitalCore)"/>
   {Array.from({length:14},(_,i)=><ellipse key={i} cx="310" cy="248" rx={226-i*4.1} ry={63+i*3.4}
    stroke="url(#symbOrbitStroke)" strokeWidth=".85" transform={"rotate("+(i*16+8)+" 310 248)"}/>)}
   <circle cx="310" cy="248" r="197" stroke="#B8BEB7" strokeWidth=".8" strokeDasharray="3 8" opacity=".5"/>
   <circle cx="310" cy="248" r="117" stroke="#A7ADA6" strokeWidth=".7" strokeDasharray="2 6" opacity=".45"/>
   <path d="M79 334 C165 314 198 215 280 245 C354 267 417 128 547 140" stroke="url(#symbSignalLine)" strokeWidth="2.5" strokeLinecap="round"/>
   <path d="M89 354 C184 331 221 220 299 260 C370 282 425 140 536 165" stroke="#B6AFEB" strokeWidth=".9" strokeDasharray="3 7"/>
   <circle cx="280" cy="245" r="5" fill="#111514"/><circle cx="280" cy="245" r="12" stroke="#111514" strokeOpacity=".5"/>
   <circle cx="547" cy="140" r="4" fill="#111514"/>
   <path d="M280 232V219M280 271V258M267 245H254M306 245H293" stroke="#111514" strokeWidth=".8"/>
  </svg>
  <span className={styles.instrumentCoordinate}>51°30&apos;06&quot;N / TECHNICAL RESEARCH</span>
  <span className={styles.instrumentBottom}>SIGNAL VISUALISATION · DECORATIVE ONLY</span>
 </div>;
}

export default function HomePage(){
 return <div className={"site "+styles.landing}>
  <SiteHeader/>
  <main>
   <section className={styles.hero} aria-labelledby="home-title">
    <div className={styles.heroInner}>
     <div className={styles.eyebrowBar}><span><span className={styles.square}/> THE INTELLIGENCE LAYER FOR INK</span><span>EST. 2026 / DESKTOP FIRST</span></div>
     <div className={styles.wordmark} aria-hidden="true">SYMB<span>—II</span><sup>®</sup></div>
     <div className={styles.heroBody}>
      <div className={styles.heroStory}>
       <span className={styles.indexLabel}>01 / THE FUTURE OF ONCHAIN CAPITAL</span>
       <h1 id="home-title">MARKETS.<br/>MARGIN.<br/><span>INTELLIGENCE.</span></h1>
       <p>One precision-built terminal for Ink. Follow Nado perps, understand Tydro lending and inspect portfolio risk from a single command desk.</p>
       <div className={styles.heroCtas}>
        <Link href="/workspace/terminal" className={styles.greenCta}>OPEN TRADING TERMINAL <ArrowUpRight size={19}/></Link>
        <Link href="#inside" className={styles.textCta}>EXPLORE PLATFORM <ArrowRight size={16}/></Link>
       </div>
       <div className={styles.securityNote}><LockKeyhole size={14}/> READ-ONLY RELEASE · NO LIVE ORDERS OR BORROWING</div>
      </div>
      <div className={styles.heroRight}>
       <div className={styles.statusBoard}>
        <Link href="/workspace/terminal" className={styles.launchLink}>LAUNCH APP <ArrowUpRight size={20}/></Link>
        <div className={styles.statRow}><span>NETWORK</span><strong>INK / 57073</strong></div>
        <div className={styles.statRow}><span>TRADING VENUE</span><strong>NADO PERPETUALS</strong></div>
        <div className={styles.statRow}><span>LENDING VENUE</span><strong>TYDRO / AAVE V3</strong></div>
        <div className={styles.statRow}><span>EXECUTION</span><strong className={styles.readOnly}><span/> READ-ONLY</strong></div>
       </div>
       <OrbitalInstrument/>
      </div>
     </div>
     <div className={styles.heroFooter}><span>SYMB-II / INK MAINNET</span><span><Crosshair size={14}/> SYSTEMS / NADO · TYDRO · RISK</span><Link href="#inside">SCROLL TO EXPLORE ↓</Link></div>
    </div>
   </section>
   <section className={styles.manifesto} id="inside">
    <div className={styles.sectionFrame}>
     <div className={styles.sectionMarker}><span>02 / INSIDE THE TERMINAL</span><span>ONE PLATFORM. MULTIPLE PROTOCOLS.</span></div>
     <div className={styles.manifestoHeading}>
      <h2>THE MARKET<br/><em>DOESN&apos;T WAIT.</em></h2>
      <div><p>Professional tools shouldn&apos;t mean a dozen disconnected tabs. Symb-II brings market context, positions, research and risk observations into one purpose-built Ink interface.</p><Link href="/workspace/terminal">SEE THE TERMINAL <ArrowUpRight size={17}/></Link></div>
     </div>
     <div className={styles.systemGrid}>
      {systems.map(system=><div className={styles.systemCard} key={system.index}>
       <div className={styles.systemTop}><span>{system.index} / MODULE</span><ArrowUpRight size={19}/></div>
       <h3>{system.name}</h3><strong>{system.detail}</strong><p>{system.note}</p>
      </div>)}
     </div>
    </div>
   </section>
   <section className={styles.terminalSection} aria-labelledby="terminal-view-heading">
    <div className={styles.sectionFrame}>
     <div className={styles.terminalSectionHead}>
      <div><span className={styles.terminalEyebrow}>03 / THE INTERFACE</span><h2 id="terminal-view-heading">A BETTER VIEW.<br/><span>BEFORE EVERY MOVE.</span></h2></div>
      <div className={styles.terminalSectionSide}><span><Activity size={14}/> NADO + TYDRO / INK</span><p>Real indexed market observations. Clear position context. No fabricated balances or execution claims.</p></div>
     </div>
     <div className={styles.previewWrap}><TerminalPreview/></div>
     <div className={styles.previewFooter}>
      <span><ChartNoAxesCombined size={17}/> MARKETS</span><span><Layers3 size={17}/> LENDING</span><span><Bot size={17}/> ASSISTED RESEARCH</span><span><ShieldCheck size={17}/> EXPLICIT PERMISSIONS</span>
     </div>
    </div>
   </section>
   <section className={styles.finalSection}>
    <div className={styles.sectionFrame}>
     <span className={styles.indexLabel}>04 / BUILT FOR CLARITY</span>
     <h2>CONTROL IS<br/><span>THE ADVANTAGE.</span></h2>
     <div className={styles.finalBottom}>
      <p>Symb-II is an intelligence interface, not an exchange. Nado market and Tydro lending observations are available today. Trade execution and autonomous spending remain disabled until independently accepted.</p>
      <div className={styles.finalCtas}><Link href="/workspace/terminal" className={styles.greenCta}>EXPLORE TERMINAL <ArrowUpRight size={17}/></Link><Link href="/workspace/rescue" className={styles.textCta}>RISK &amp; RESCUE LAB <ArrowRight size={15}/></Link></div>
     </div>
    </div>
   </section>
  </main>
  <SiteFooter/>
 </div>;
}
