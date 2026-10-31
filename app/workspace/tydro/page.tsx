import {WorkspacePageHeader} from "@/components/workspace-page-header";
import {TydroPanel} from "@/components/tydro-panel";

export default function TydroWorkspacePage(){
  return <>
    <WorkspacePageHeader eyebrow="TYDRO / LENDING" title="Tydro lending"
      description="See live Ink lending reserves, interest rates, collateral details and wallet-specific supply or borrowing records."/>
    <TydroPanel/>
  </>;
}
