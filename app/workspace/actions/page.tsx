import {WorkspacePageHeader} from "@/components/workspace-page-header";
import {TydroActionPlanner} from "@/components/tydro-action-planner";
export const metadata={
 title:"Lending Action Lab | Symb-II",
 description:"Read-only Tydro supply, withdraw, borrow and repay action planning on Ink.",
};
export default function LendingActionsPage(){
 return <>
  <WorkspacePageHeader eyebrow="TYDRO / RESTRICTED" title="Lending Action Lab"
   description="Inspect an action against live Ink reserves and wallet-associated Pool data. This page cannot approve, sign or send transactions."/>
  <TydroActionPlanner/>
 </>;
}
