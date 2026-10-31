import {WorkspacePageHeader} from "@/components/workspace-page-header";
import {RiskPanel} from "@/components/risk-panel";

export default function PreflightWorkspacePage(){
  return <>
    <WorkspacePageHeader eyebrow="PREFLIGHT / INK DIAGNOSTICS" title="Transaction preflight"
      description="Inspect the existing pre-execution safeguards, protected checks and limitations for your real Ink account. Execution remains disabled."/>
    <RiskPanel mode="preflight"/>
  </>;
}
