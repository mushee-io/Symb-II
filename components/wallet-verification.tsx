"use client";
import {useState} from "react";
import {useAccount,usePublicClient} from "wagmi";
import {Activity,ClipboardCopy,ShieldCheck,AlertCircle} from "lucide-react";
import {ink} from "@/lib/ink";
import type {NadoAccountResponse} from "@/lib/nado/types";
import type {TydroAccountResponse} from "@/lib/tydro/types";
import {assessWalletVerification,type InkRpcObservation,type WalletVerification,type Source} from "@/lib/verification/account";

async function inspectAccount<T>(url:string):Promise<Source<T>>{
 try{
  const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(35000)});
  if(!response.ok)return {status:"error"};
  return {status:"success",data:await response.json() as T};
 }catch{return {status:"error"};}
}
export function WalletVerification(){
 const {address,chainId,isConnected}=useAccount();
 const client=usePublicClient({chainId:ink.id});
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<WalletVerification|null>(null);
 const [error,setError]=useState("");
 const [copied,setCopied]=useState(false);
 async function run(){
  if(!address||!isConnected||busy)return;
  setBusy(true);setResult(null);setError("");setCopied(false);
  const currentAddress=address;
  try{
   const nadoUrl="/api/nado/account?address="+encodeURIComponent(currentAddress);
   const tydroUrl="/api/tydro/account?address="+encodeURIComponent(currentAddress);
   // A user-initiated, read-only inspection. No background polling, writes
   // or signatures. The independent RPC and protocol reads can fail separately.
   const [nado,tydro,rpc]=await Promise.all([
    inspectAccount<NadoAccountResponse>(nadoUrl),
    inspectAccount<TydroAccountResponse>(tydroUrl),
    (async():Promise<Source<InkRpcObservation>>=>{
      if(!client)return {status:"error"};
      try{
       const [chain,block,code,balance]=await Promise.all([
        client.getChainId(),client.getBlock(),
        client.getCode({address:currentAddress}),
        client.getBalance({address:currentAddress}),
       ]);
       return {status:"success",data:{
        chainId:chain,blockNumber:block.number.toString(),
        blockTimestamp:new Date(Number(block.timestamp)*1000).toISOString(),
        code:code??"",nativeBalanceWei:balance.toString(),observedAt:new Date().toISOString(),
       }};
      }catch{return {status:"error"};}
    })(),
   ]);
   setResult(assessWalletVerification({
    wallet:currentAddress,connectionChainId:chainId??null,
    rpc,nado,tydro,
   }));
  }catch{setError("Wallet inspection failed. No account result is treated as verified.");}
  finally{setBusy(false);}
 }
 async function copy(){
  if(!result)return;
  try{
    await navigator.clipboard.writeText(JSON.stringify(result,null,2));
    setCopied(true);
  }catch{setError("Clipboard permission unavailable. The results remain visible below.");}
 }
 const statuses=result?.checks??[];
 return <section className="ops-panel" id="wallet-verification" aria-label="Milestone eight real wallet verification">
  <div className="ops-panel-heading"><div>
    <span className="eyebrow">M08 / REAL INK WALLET RECONCILIATION</span>
    <h2>Wallet verification lab.</h2>
    <p>Run independent public RPC, Nado and Tydro account checks against the wallet you actually connected. Missing positions and loans remain explicitly untested.</p>
   </div><div className="ops-readonly"><ShieldCheck size={15}/> READ ONLY</div></div>
  {!isConnected||!address?<div className="ops-alert">Connect a wallet on Ink to inspect its live account data. This does not require a signature.</div>:
   <>
    <p className="ops-note">Connected wallet: <code>{address}</code>. Connector chain: {chainId??"unknown"}.
      A wallet connection does not prove signing control; owner authentication requires a separate explicit challenge.</p>
    <div className="ops-toolbar">
     <button className="btn btn-primary" type="button" disabled={busy||chainId!==57073}
       onClick={()=>void run()}><Activity size={15}/>{busy?"Inspecting live wallet…":"Run wallet verification"}</button>
     {result&&<button className="btn btn-secondary" type="button" onClick={()=>void copy()}>
       <ClipboardCopy size={15}/>{copied?"Report copied":"Copy evidence report"}</button>}
    </div>
    {chainId!==57073&&<p className="ops-alert">Switch the wallet to Ink mainnet (57073) before running this inspection.</p>}
    {result&&<div className="ops-verification">
     <div className="ops-scores">
      <div><strong>{result.passed}</strong><span>Passed</span></div>
      <div><strong>{result.failed}</strong><span>Failed</span></div>
      <div><strong>{result.notTested}</strong><span>Not tested</span></div>
     </div>
     <p className="ops-note">Observed {new Date(result.checkedAt).toLocaleString()}. This report is not a wallet ownership certificate or an approval to transact.</p>
     {statuses.map(c=><div className="ops-check" key={c.id}>
      <span className={"ops-check-state "+c.state}>{c.state==="pass"?"PASS":c.state==="fail"?"FAIL":"NOT TESTED"}</span>
      <div><strong>{c.name}</strong><p>{c.detail}</p></div>
     </div>)}
     <div className="ops-note">{result.notes.map((n,i)=><p key={i}>{n}</p>)}</div>
    </div>}
   </>}
  {error&&<p className="ops-alert" role="alert"><AlertCircle size={16}/>{error}</p>}
  <p className="ops-note">No wallet transactions or protocol actions are submitted, and results are not saved to a database. A successful public account read does not prove that active trading, repayment, smart-wallet signing or protected API workflows have been tested.</p>
 </section>;
}
