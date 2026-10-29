"use client";
import {useEffect,useRef,useState} from "react";
import {useAccount,usePublicClient,useSignMessage} from "wagmi";
import {Activity,ClipboardCopy,ShieldCheck,AlertCircle,KeyRound} from "lucide-react";
import {ink} from "@/lib/ink";
import {TYDRO,providerAbi,poolAbi,oracleAbi} from "@/lib/tydro/contracts";
import type {TydroDirectObservation} from "@/lib/verification/tydro-direct";
import {isFreshOwnershipProof,ownershipMessage,type OwnershipChallenge} from "@/lib/verification/ownership";
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
 const {signMessageAsync}=useSignMessage();
 const [proof,setProof]=useState<{wallet:string;verifiedAt:string;expiry:string;method:string}|null>(null);
 const [signing,setSigning]=useState(false);
 useEffect(()=>{setProof(null);setResult(null);setError("");},[address,chainId]);
 const identityRef=useRef("");
 identityRef.current=(address?.toLowerCase()??"disconnected")+":"+(chainId??"none");
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<WalletVerification|null>(null);
 const [error,setError]=useState("");
 const [copied,setCopied]=useState(false);
 async function run(){
  if(!address||!isConnected||busy)return;
  setBusy(true);setResult(null);setError("");setCopied(false);
  const currentAddress=address;
  const currentIdentity=identityRef.current;
  try{
   const nadoUrl="/api/nado/account?address="+encodeURIComponent(currentAddress);
   const tydroUrl="/api/tydro/account?address="+encodeURIComponent(currentAddress);
   // A user-initiated, read-only inspection. No background polling, writes
   // or signatures. The independent RPC and protocol reads can fail separately.
   const [nado,tydro,rpc,tydroDirect]=await Promise.all([
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
    (async():Promise<Source<TydroDirectObservation>>=>{
      if(!client)return {status:"error"};
      try{
       const block=await client.getBlock();
       const number=block.number;
       const [chain,pool,accountData,unit,emode]=await Promise.all([
         client.getChainId(),
         client.readContract({address:TYDRO.poolAddressesProvider,abi:providerAbi,
           functionName:"getPool",blockNumber:number}),
         client.readContract({address:TYDRO.pool,abi:poolAbi,
           functionName:"getUserAccountData",args:[currentAddress],blockNumber:number}),
         client.readContract({address:TYDRO.oracle,abi:oracleAbi,
           functionName:"BASE_CURRENCY_UNIT",blockNumber:number}),
         client.readContract({address:TYDRO.pool,abi:poolAbi,
           functionName:"getUserEMode",args:[currentAddress],blockNumber:number}),
       ]);
       const again=await client.getBlock({blockNumber:number});
       if(block.hash!==again.hash)throw Error("Pinned Ink block reorganized");
       return {status:"success",data:{
         observedAt:new Date().toISOString(),
         blockTimestamp:new Date(Number(block.timestamp)*1000).toISOString(),
         blockNumber:number.toString(),chainId:chain,
         verifiedProviderPool:pool,oracleBaseUnit:unit.toString(),
         collateralBaseRaw:accountData[0].toString(),
         debtBaseRaw:accountData[1].toString(),
         availableBorrowsBaseRaw:accountData[2].toString(),
         healthFactorRaw:accountData[5].toString(),
         emodeCategory:emode.toString(),
       }};
      }catch{return {status:"error"};}
    })(),
   ]);
   if(identityRef.current!==currentIdentity)return;
   setResult(assessWalletVerification({
    wallet:currentAddress,connectionChainId:chainId??null,
    rpc,nado,tydro,tydroDirect,
   }));
  }catch{setError("Wallet inspection failed. No account result is treated as verified.");}
  finally{setBusy(false);}
 }
 async function verifyControl(){
  if(!address||!client||chainId!==ink.id||signing||busy)return;
  setSigning(true);setError("");setProof(null);
  try{
   const identityAtStart=identityRef.current;
   const challenge:OwnershipChallenge={
    wallet:address,origin:window.location.origin,nonce:crypto.randomUUID(),
    issuedAt:new Date().toISOString(),chainId:57073,
   };
   const message=ownershipMessage(challenge);
   // The only wallet action is personal_sign. No calldata, permit, order or
   // delegated permission is requested. We do not persist the signature.
   const signature=await signMessageAsync({message});
   if(identityRef.current!==identityAtStart)throw Error("Connected wallet changed during signature check.");
   if(!isFreshOwnershipProof(challenge,Date.now()))throw Error("Wallet proof expired. Try again.");
   if(await client.getChainId()!==57073)throw Error("Ink RPC mismatch.");
   const valid=await client.verifyMessage({address,message,signature});
   if(!valid)throw Error("Signature verification failed for this wallet.");
   if(identityRef.current!==identityAtStart)throw Error("Connected wallet changed.");
   setProof({
    wallet:address,verifiedAt:new Date().toISOString(),
    expiry:new Date(Date.parse(challenge.issuedAt)+120000).toISOString(),
    method:"Ink RPC personal-sign verification (EOA, deployed ERC-1271 or supported smart-account scheme)",
   });
  }catch(e){setError(e instanceof Error?e.message:"Wallet ownership check failed.");}
  finally{setSigning(false);}
 }
 async function copy(){
  if(!result||!address||result.wallet.toLowerCase()!==address.toLowerCase()||chainId!==57073)return;
  try{
    const validProof=proof&&proof.wallet.toLowerCase()===result.wallet.toLowerCase()&&
      Date.parse(proof.expiry)>Date.now()?proof:null;
    await navigator.clipboard.writeText(JSON.stringify({
      ...result,
      clientSideOwnershipSelfTest:validProof?{
        verifiedAt:validProof.verifiedAt,expiresAt:validProof.expiry,
        verificationMethod:validProof.method,serverAuthenticated:false,
        permissionGranted:false,
      }:{status:"not-tested"},
    },null,2));
    setCopied(true);
  }catch{setError("Clipboard permission unavailable. The results remain visible below.");}
 }
 const activeReport=address&&chainId===57073&&result?.wallet.toLowerCase()===address.toLowerCase()?result:null;
 const statuses=activeReport?.checks??[];
 return <section className="ops-panel" id="wallet-verification" aria-label="Milestone eight real wallet verification">
  <div className="ops-panel-heading"><div>
    <span className="eyebrow">M08 / REAL INK WALLET RECONCILIATION</span>
    <h2>Wallet verification lab.</h2>
    <p>Run independent public RPC, Nado and Tydro account checks against the wallet you actually connected. Reconcile reported Tydro debt, collateral, borrow availability and health factor with separate block-pinned Pool reads. Missing positions and loans remain explicitly untested.</p>
   </div><div className="ops-readonly"><ShieldCheck size={15}/> READ ONLY</div></div>
  {!isConnected||!address?<div className="ops-alert">Connect a wallet on Ink to inspect its live account data. This does not require a signature.</div>:
   <>
    <p className="ops-note">Connected wallet: <code>{address}</code>. Connector chain: {chainId??"unknown"}.
      Connecting does not prove signing control. Use the separate signature self-test only if you choose to; it creates no server login or transaction permission.</p>
    <div className="ops-toolbar">
     <button className="btn btn-primary" type="button" disabled={busy||chainId!==57073}
       onClick={()=>void run()}><Activity size={15}/>{busy?"Inspecting live wallet…":"Run wallet verification"}</button>
     <button className="btn btn-secondary" type="button" disabled={busy||signing||chainId!==57073}
       onClick={()=>void verifyControl()}><KeyRound size={15}/>
       {signing?"Checking signature…":"Test wallet signing control"}</button>
     {activeReport&&<button className="btn btn-secondary" type="button" onClick={()=>void copy()}>
       <ClipboardCopy size={15}/>{copied?"Report copied":"Copy evidence report"}</button>}
    </div>
    {chainId!==57073&&<p className="ops-alert">Switch the wallet to Ink mainnet (57073) before running this inspection.</p>}
    {proof&&proof.wallet.toLowerCase()===address.toLowerCase()&&Date.parse(proof.expiry)>Date.now()&&
      <p className="preflight-success" role="status">
       Ink wallet signature verified locally on the connected RPC at {new Date(proof.verifiedAt).toLocaleTimeString()}.
       This self-test expires at {new Date(proof.expiry).toLocaleTimeString()} and is NOT a server session, transaction approval or production end-to-end certification.
      </p>}
    {activeReport&&<div className="ops-verification">
     <div className="ops-scores">
      <div><strong>{activeReport.passed}</strong><span>Passed</span></div>
      <div><strong>{activeReport.failed}</strong><span>Failed</span></div>
      <div><strong>{activeReport.notTested}</strong><span>Not tested</span></div>
     </div>
     <p className="ops-note">Observed {new Date(activeReport.checkedAt).toLocaleString()}. This report is not a wallet ownership certificate or an approval to transact.</p>
     {statuses.map(c=><div className="ops-check" key={c.id}>
      <span className={"ops-check-state "+c.state}>{c.state==="pass"?"PASS":c.state==="fail"?"FAIL":"NOT TESTED"}</span>
      <div><strong>{c.name}</strong><p>{c.detail}</p></div>
     </div>)}
     <div className="ops-note">{activeReport.notes.map((n,i)=><p key={i}>{n}</p>)}</div>
    </div>}
   </>}
  {error&&<p className="ops-alert" role="alert"><AlertCircle size={16}/>{error}</p>}
  <p className="ops-note">No wallet transactions or protocol actions are submitted, and results are not saved to a database. A successful public account read does not prove that active trading, repayment or protected API workflows have been tested. The optional signature self-test is verified client-side, not authenticated by the server.</p>
 </section>;
}
