import {WorkspacePageHeader} from "@/components/workspace-page-header";
import {RiskPanel} from "@/components/risk-panel";

export default function MonitorWorkspacePage(){
  return <>
    <WorkspacePageHeader eyebrow="MONITORING / ACCOUNT WARNINGS" title="Risk alerts"
      description="View in-tab protocol warnings, a short-lived event timeline and the status of optional server-side monitoring."/>
    <RiskPanel mode="monitor"/>
  </>;
}
