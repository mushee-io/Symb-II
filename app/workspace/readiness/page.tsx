import {WorkspacePageHeader} from "@/components/workspace-page-header";
import {LaunchReadiness} from "@/components/launch-readiness";

export default function ReadinessWorkspacePage(){
  return <>
    <WorkspacePageHeader eyebrow="SERVICES / PRODUCTION" title="Launch readiness"
      description="Understand which backend features are configured, disabled or blocked. Configuration alone is not proof of successful live validation."/>
    <LaunchReadiness/>
  </>;
}
