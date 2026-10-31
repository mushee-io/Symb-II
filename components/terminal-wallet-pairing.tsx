"use client";

import {useAccount} from "wagmi";
import {Wallet,Smartphone,ShieldCheck,AlertTriangle} from "lucide-react";
import {WalletButton} from "@/components/wallet-button";
import {walletConnectConfigured} from "@/lib/wagmi";
import {classifyWalletConnection} from "@/lib/wallet/connect-policy";
import styles from "@/app/workspace/terminal/terminal.module.css";

/** The desktop app deliberately has no injected native signing bridge.
 * If WalletConnect is configured, QR pairing is initiated by an explicit
 * click using the standard browser-based wagmi connector.
 */
export function TerminalWalletPairing(){
 const {address,isConnected,chainId,connector}=useAccount();
 const status=classifyWalletConnection({isConnected,address,chainId});
 return <section className={styles.pairingPanel} aria-label="Desktop wallet pairing">
  <div className={styles.pairingHeading}><Wallet size={17}/>
   <div><strong>Desktop wallet connection</strong>
    <small>Ink Mainnet · public address access only</small></div>
  </div>
  <WalletButton/>
  {status==="read-only"?<p className={styles.pairingGood}><ShieldCheck size={15}/>
    Connected through {connector?.name??"a wallet"}: {address?.slice(0,6)}…{address?.slice(-4)} on chain 57073. This proves connectivity, not ownership or spending authority.
   </p>:status==="wrong-network"?<p className={styles.pairingWarning}><AlertTriangle size={15}/>
    A wallet is connected on the wrong network. Switch to Ink before inspecting account data.
   </p>:walletConnectConfigured?
    <p className={styles.pairingHelp}><Smartphone size={15}/>
      Select “WalletConnect (mobile / QR)” from Connect wallet, then scan the QR
      code with a compatible phone wallet. This requires a real pairing test in the native
      app before it can be marked verified.
    </p>:
    <p className={styles.pairingWarning}><AlertTriangle size={15}/>
      Desktop QR pairing is not configured: this deployment needs a valid public
      WalletConnect Project ID. No wallet connection will be simulated.
    </p>}
  <p className={styles.modelFootnote}><ShieldCheck size={14}/> This application never embeds wallet extensions, handles seed phrases or injects transaction-signing APIs. Native QR pairing remains unverified until tested with an independent wallet.</p>
 </section>;
}
