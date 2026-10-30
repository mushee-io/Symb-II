import {createConfig,http} from "wagmi";
import {injected} from "wagmi";
import {walletConnect} from "@walletconnect/wagmi-connector";
import {ink} from "@/lib/ink";
import {validWalletConnectProjectId} from "@/lib/wallet/connect-policy";

// WalletConnect Project ID is public, optional browser config. It is not a
// private key or a signature authority. Invalid/missing IDs do not enable it.
const projectId=process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
export const walletConnectConfigured=validWalletConnectProjectId(projectId);

export const config=createConfig({
 chains:[ink],
 connectors:[
  injected({shimDisconnect:true}),
  ...(walletConnectConfigured&&projectId?[walletConnect({
    projectId,
    showQrModal:true,
    isNewChainsStale:true,
    metadata:{
      name:"Symb-II",
      description:"Read-only Ink portfolio workspace",
      url:"https://symb-ii.vercel.app",
      icons:["https://symb-ii.vercel.app/icon.svg"],
    },
  })]:[]),
 ],
 transports:{
  [ink.id]:http(process.env.NEXT_PUBLIC_INK_RPC_URL||"https://rpc-gel.inkonchain.com"),
 },
 ssr:true,
});
