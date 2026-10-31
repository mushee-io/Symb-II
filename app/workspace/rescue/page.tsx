import {WorkspacePageHeader} from "@/components/workspace-page-header";
import {RiskPanel} from "@/components/risk-panel";

export default function RescueWorkspacePage(){
  return <>
    <WorkspacePageHeader eyebrow="RESCUE / HYPOTHETICAL ANALYSIS" title="Portfolio Rescue Lab"
      description="Explore bounded, read-only Nado position and Tydro debt reduction scenarios. No transactions are constructed or executed."/>
    <RiskPanel mode="rescue"/>
  </>;
}
