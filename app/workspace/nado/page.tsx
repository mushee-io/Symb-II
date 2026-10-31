import {WorkspacePageHeader} from "@/components/workspace-page-header";
import {NadoPanel} from "@/components/nado-panel";

export default function NadoWorkspacePage(){
  return <>
    <WorkspacePageHeader eyebrow="NADO / TRADING MARKETS" title="Nado markets"
      description="Explore real Nado spot and perpetual markets, then inspect positions and order history belonging to your connected Ink wallet."/>
    <NadoPanel/>
  </>;
}
