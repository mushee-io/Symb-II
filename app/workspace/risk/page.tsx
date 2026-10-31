import {WorkspacePageHeader} from "@/components/workspace-page-header";
import {RiskPanel} from "@/components/risk-panel";

export default function RiskWorkspacePage(){
  return <>
    <WorkspacePageHeader eyebrow="RISK / PORTFOLIO HEALTH" title="Risk intelligence"
      description="Nado margin health and Tydro lending health calculated separately from actual wallet account readings. Missing data is never treated as safe."/>
    <RiskPanel mode="risk"/>
  </>;
}
