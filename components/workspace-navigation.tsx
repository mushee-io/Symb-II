"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {
  Activity, BellRing, Bot, ChartNoAxesCombined, ClipboardCheck,
  Droplets, KeyRound, LayoutDashboard, Monitor, ShieldAlert, SlidersHorizontal, TrendingUp,
} from "lucide-react";

const sections=[
  {href:"/workspace",label:"Overview",hint:"Your wallet",icon:LayoutDashboard},
  {href:"/workspace/terminal",label:"Trading Terminal",hint:"Agent desk & live quotes",icon:Monitor},
  {href:"/workspace/nado",label:"Nado Markets",hint:"Perpetuals & positions",icon:TrendingUp},
  {href:"/workspace/tydro",label:"Tydro Lending",hint:"Supply & borrow",icon:Droplets},
  {href:"/workspace/risk",label:"Risk Monitor",hint:"Health & exposures",icon:ShieldAlert},
  {href:"/workspace/rescue",label:"Rescue Lab",hint:"What-if scenarios",icon:SlidersHorizontal},
  {href:"/workspace/preflight",label:"Preflight",hint:"Safety diagnostics",icon:ClipboardCheck},
  {href:"/workspace/monitor",label:"Risk Alerts",hint:"In-tab monitoring",icon:BellRing},
  {href:"/workspace/verify",label:"Wallet Lab",hint:"Independent checks",icon:KeyRound},
  {href:"/workspace/readiness",label:"Readiness",hint:"Service status",icon:Activity},
  {href:"/agent",label:"AI Assistant",hint:"Guided analysis",icon:Bot},
] as const;

export function WorkspaceNavigation(){
  const pathname=usePathname();
  return <aside className="workspace-sidenav" aria-label="Workspace navigation">
    <div className="workspace-sidenav-label"><ChartNoAxesCombined size={15}/> SYMB-II / WORKSPACE</div>
    <nav className="workspace-sidenav-links" aria-label="Workspace sections">
      {sections.map(({href,label,hint,icon:Icon})=>{
        const active=pathname===href;
        return <Link key={href} href={href} aria-current={active?"page":undefined}
          className={"workspace-nav-link"+(active?" workspace-nav-active":"")}>
          <Icon size={18} aria-hidden="true" strokeWidth={1.8}/>
          <span className="workspace-nav-copy"><strong>{label}</strong><small>{hint}</small></span>
        </Link>;
      })}
    </nav>
    <div className="workspace-sidenav-foot"><span className="connected-dot"/> INK MAINNET · READ ONLY</div>
  </aside>;
}
