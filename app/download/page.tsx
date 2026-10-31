import Link from "next/link";
import {
  ArrowDownToLine,ArrowRight,ArrowUpRight,Check,Download,
  HardDriveDownload,Laptop,LockKeyhole,Monitor,ShieldAlert,
  Smartphone,TerminalSquare,
} from "lucide-react";
import {SiteHeader} from "@/components/site-header";
import {SiteFooter} from "@/components/site-footer";
import styles from "./download.module.css";

export const metadata={
 title:"Download Symb-II | Windows Beta",
 description:"Download the Symb-II Windows desktop beta. macOS, iOS and Linux versions are coming soon.",
};

const WINDOWS_TAG="v0.1.0-windows-beta";
const ASSET_BASE="https://github.com/mushee-io/Symb-II/releases/download/"+WINDOWS_TAG;
const WINDOWS_INSTALLER_URL=ASSET_BASE+"/Symb-II-Setup-0.1.0-x64.exe";
const WINDOWS_CHECKSUM_URL=ASSET_BASE+"/SHA256SUMS.txt";

const upcoming=[
 {name:"macOS",platform:"Apple silicon / Intel",icon:Laptop,description:"Native macOS desktop experience.",short:"MAC"},
 {name:"iOS",platform:"iPhone",icon:Smartphone,description:"Mobile-first portfolio and market intelligence.",short:"iOS"},
 {name:"Linux",platform:"Desktop Linux",icon:TerminalSquare,description:"Native Linux desktop experience.",short:"LNX"},
];

export default function DownloadPage(){
 return <div className={"site "+styles.downloadSite}>
  <SiteHeader/>
  <main>
   <section className={styles.hero} aria-labelledby="download-title">
    <div className={styles.frame}>
     <div className={styles.overline}><span><span className={styles.square}/> SYMB-II / GET THE APP</span><span>DESKTOP FIRST · INK 57073</span></div>
     <div className={styles.heroContent}>
      <div>
       <span className={styles.eyebrow}>01 / DOWNLOADS</span>
       <h1 id="download-title">TAKE THE<br/><span>TERMINAL.</span></h1>
      </div>
      <div className={styles.heroAside}>
       <span className={styles.sideIndex}>// SYMB-II DESKTOP</span>
       <p>A precision-built interface for Nado perpetuals, Tydro lending intelligence and capital risk — now available as a Windows beta.</p>
       <p className={styles.readonly}><LockKeyhole size={14}/> CURRENT BUILD: READ-ONLY</p>
      </div>
     </div>
    </div>
   </section>
   <section className={styles.options} aria-labelledby="platforms-title">
    <div className={styles.frame}>
     <div className={styles.sectionHeader}><h2 id="platforms-title">CHOOSE YOUR PLATFORM</h2><span>01 AVAILABLE / 03 COMING SOON</span></div>
     <div className={styles.platformGrid}>
      <article className={styles.windowsCard}>
       <div className={styles.windowsTop}>
        <span className={styles.available}><span/> AVAILABLE NOW · BETA</span>
        <span className={styles.cardIndex}>01 / WIN</span>
       </div>
       <Monitor className={styles.windowsIcon} size={75} strokeWidth={1}/>
       <div className={styles.windowsMiddle}>
        <h3>WINDOWS<span>®</span></h3>
        <p>Symb-II Desktop</p>
        <span className={styles.details}>WINDOWS 10/11 · 64-BIT · VERSION 0.1.0</span>
       </div>
       <div className={styles.windowsBottom}>
        <a href={WINDOWS_INSTALLER_URL} className={styles.primaryDownload} aria-label="Download unsigned Windows beta installer EXE from GitHub Releases">
         <Download size={20}/> DOWNLOAD FOR WINDOWS <ArrowDownToLine size={19}/>
        </a>
        <span className={styles.fileDetail}>EXE INSTALLER · APPROX. 116 MB</span>
       </div>
      </article>
      <div className={styles.upcomingGrid}>
       {upcoming.map((item,i)=><article key={item.name} className={styles.upcomingCard}>
        <div className={styles.upcomingTop}><span>0{i+2} / {item.short}</span><span className={styles.coming}>COMING SOON</span></div>
        <div className={styles.upcomingMain}>
         <item.icon size={37} strokeWidth={1.35} aria-hidden="true"/>
         <div><h3>{item.name}</h3><p>{item.platform}</p></div>
        </div>
        <div className={styles.upcomingFooter}><span>{item.description}</span><ArrowRight size={16}/></div>
       </article>)}
      </div>
     </div>
     <div className={styles.betaNotice} role="note">
      <ShieldAlert size={21}/>
      <div><strong>WINDOWS BETA — UNSIGNED TEST BUILD</strong>
       <p>This installer is not code-signed or independently approved for public financial use. Verify the checksum, use it only for controlled testing, and keep your OS security protections enabled. Live order submission, lending transactions and autonomous spending remain disabled.</p>
      </div>
     </div>
    </div>
   </section>
   <section className={styles.installSection} aria-labelledby="instructions-title">
    <div className={styles.frame}>
     <div className={styles.sectionHeader}><h2 id="instructions-title">INSTALLATION / SECURITY</h2><span>VERIFY BEFORE RUNNING</span></div>
     <div className={styles.steps}>
      <div><span>01</span><strong>DOWNLOAD</strong><p>Get the versioned Windows installer from the Symb-II GitHub Release.</p></div>
      <div><span>02</span><strong>VERIFY</strong><p>Compare its SHA-256 hash with the official release checksum before installing.</p></div>
      <div><span>03</span><strong>TEST</strong><p>Check the terminal, account observations and connectivity. No live trading is enabled.</p></div>
     </div>
     <div className={styles.bottomLinks}>
      <a href={WINDOWS_CHECKSUM_URL}><Check size={16}/> VIEW SHA-256 CHECKSUM <ArrowUpRight size={17}/></a>
      <Link href="/workspace/terminal"><HardDriveDownload size={17}/> USE WEB TERMINAL <ArrowUpRight size={17}/></Link>
      <a href={"https://github.com/mushee-io/Symb-II/releases/tag/"+WINDOWS_TAG}>RELEASE DETAILS <ArrowUpRight size={17}/></a>
     </div>
    </div>
   </section>
  </main>
  <SiteFooter/>
 </div>;
}
