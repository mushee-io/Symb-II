import type {ReactNode} from "react";
import {SiteHeader} from "@/components/site-header";
import {SiteFooter} from "@/components/site-footer";
import {WorkspaceNavigation} from "@/components/workspace-navigation";

export default function WorkspaceLayout({children}:{children:ReactNode}){
  return <div className="site workspace-site">
    <SiteHeader/>
    <div className="shell workspace-shell">
      <WorkspaceNavigation/>
      <main className="workspace-content" id="workspace-content">{children}</main>
    </div>
    <SiteFooter/>
  </div>;
}
