import {WorkspacePageHeader} from "@/components/workspace-page-header";
import {WalletVerification} from "@/components/wallet-verification";

export default function VerifyWorkspacePage(){
  return <>
    <WorkspacePageHeader eyebrow="WALLET / INDEPENDENT EVIDENCE" title="Wallet verification lab"
      description="Inspect real Ink RPC, Nado and Tydro observations and run optional wallet-control verification. No spending permissions are requested."/>
    <WalletVerification/>
  </>;
}
