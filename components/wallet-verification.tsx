"use client";
import {useEffect,useRef,useState} from "react";
import {useAccount,usePublicClient,useSignMessage} from "wagmi";
import {Activity,ClipboardCopy,ShieldCheck,AlertCircle,KeyRound} from "lucide-react";
import {ink} from "@/lib/ink";
import {TYDRO,providerAbi,poolAbi,oracleAbi} from "@/lib/tydro/contracts";
import type {TydroDirectObservation} from "@/lib/verification/tydro-direct";
import {isFreshOwnershipProof,ownershipMessage,type OwnershipChallenge} from "@/lib/verification/ownership";
import type {NadoAccountResponse,NadoMarketsResponse} from "@/lib/nado/types";
import type {TydroAccountResponse} from "@/lib/tydro/types";
import {assessWalletVerification,type InkRpcObservation,type WalletVerification,type Source} from "@/lib/verification/account";
import {assessM8Acceptance} from "@/lib/verification/acceptance";

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
 const [serverProof,setServerProof]=useState<{wallet:string;verifiedAt:string;expiresAt:string}|null>(null);
 const [serverReady,setServerReady]=useState(false);
 const [serverPending,setServerPending]=useState(false);
 const [clock,setClock]=useState(()=>Date.now());
 const [signing,setSigning]=useState(false);
 useEffect(()=>{setProof(null);setServerProof(null);setResult(null);setError("");},[address,chainId]);
 useEffect(()=>{
  let active=true;
  void fetch("/api/verification/config",{cache:"no-store",signal:AbortSignal.timeout(10000)})
   .then(r=>r.ok?r.json():Promise.reject(Error("Config unavailable")))
   .then((v:{enabled?:boolean})=>{if(active)setServerReady(v.enabled===true);})
   .catch(()=>{if(active)setServerReady(false);});
  return ()=>{active=false;};
 },[]);
 const identityRef=useRef("");
 identityRef.current=(address?.toLowerCase()??"disconnected")+":"+(chainId??"none");
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<WalletVerification|null>(null);
 const [error,setError]=useState("");
 const [copied,setCopied]=useState(false);
 useEffect(()=>{
  if(!result&&!proof&&!serverProof)return;
  const id=window.setInterval(()=>setClock(Date.now()),15000);
  return ()=>window.clearInterval(id);
 },[result,proof,serverProof]);
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
   const [nado,nadoMarkets,tydro,rpc,tydroDirect]=await Promise.all([
    inspectAccount<NadoAccountResponse>(nadoUrl),
    inspectAccount<NadoMarketsResponse>("/api/nado/markets"),
    inspectAccount<TydroAccountResponse>(tydroUrl),
    (async():Promise<Source<InkRpcObservation>>=>{
      if(!client)return {status:"error"};
      try{
       const block=await client.getBlock();
       const pinnedBlock=block.number;
       const [chain,code,balance,confirmation]=await Promise.all([
        client.getChainId(),
        client.getCode({address:currentAddress,blockNumber:pinnedBlock}),
        client.getBalance({address:currentAddress,blockNumber:pinnedBlock}),
        client.getBlock({blockNumber:pinnedBlock}),
       ]);
       if(!block.hash||confirmation.hash!==block.hash)
        throw Error("Ink RPC reference block changed during inspection.");
       return {status:"success",data:{
        chainId:chain,blockNumber:pinnedBlock.toString(),blockHash:block.hash,
        blockTimestamp:new Date(Number(block.timestamp)*1000).toISOString(),
        code:code??"0x",nativeBalanceWei:balance.toString(),observedAt:new Date().toISOString(),
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
       if(!block.hash||block.hash!==again.hash)throw Error("Pinned Ink block reorganized");
       return {status:"success",data:{
         observedAt:new Date().toISOString(),
         blockTimestamp:new Date(Number(block.timestamp)*1000).toISOString(),
         blockNumber:number.toString(),blockHash:block.hash,chainId:chain,
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
   setClock(Date.now());
   setResult(assessWalletVerification({
    wallet:currentAddress,connectionChainId:chainId??null,
    rpc,nado,nadoMarkets,tydro,tydroDirect,
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
   // Classify the observed account at verification time; never claim that
   // an arbitrary smart-wallet signature is an EOA signature.
   const bytecode=await client.getCode({address});
   if(identityRef.current!==identityAtStart)throw Error("Connected wallet changed.");
   setClock(Date.now());
   setProof({
    wallet:address,verifiedAt:new Date().toISOString(),
    expiry:new Date(Date.parse(challenge.issuedAt)+120000).toISOString(),
    method:bytecode&&bytecode!=="0x"?
     "ERC-1271-compatible deployed contract, locally verified via Ink RPC":
     "EOA or supported counterfactual smart account, locally verified via Ink RPC",
   });
  }catch(e){setError(e instanceof Error?e.message:"Wallet ownership check failed.");}
  finally{setSigning(false);}
 }
 async function verifyServerControl(){
  if(!address||chainId!==57073||!serverReady||busy||signing||serverPending)return;
  setServerPending(true);setServerProof(null);setError("");
  const currentAddress=address;const currentIdentity=identityRef.current;
  try{
   const request=await fetch("/api/verification/challenge",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({wallet:currentAddress}),cache:"no-store",
    signal:AbortSignal.timeout(20000),
   });
   if(!request.ok)throw Error("Server wallet challenge unavailable or rate limited.");
   const challenge=await request.json() as {challengeId:string;message:string;expiresInSeconds:number};
   if(!/^[0-9a-f-]{36}$/i.test(challenge.challengeId)||
      typeof challenge.message!=="string"||challenge.expiresInSeconds!==120)
     throw Error("Invalid server challenge response.");
   if(identityRef.current!==currentIdentity)throw Error("Wallet changed during server verification.");
   const signature=await signMessageAsync({message:challenge.message});
   if(identityRef.current!==currentIdentity)throw Error("Wallet changed during signature request.");
   const response=await fetch("/api/verification/verify",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({wallet:currentAddress,challengeId:challenge.challengeId,signature}),
    cache:"no-store",signal:AbortSignal.timeout(25000),
   });
   if(!response.ok)throw Error("Server rejected the signed challenge or it expired. Retry with a new challenge.");
   const verified=await response.json() as {
    verified:boolean;wallet:string;verifiedAt:string;expiresAt:string;
    serverSessionIssued:boolean;permissionGranted:boolean;executionEnabled:boolean;
   };
   if(verified.verified!==true||verified.wallet.toLowerCase()!==currentAddress.toLowerCase()||
     verified.serverSessionIssued!==false||verified.permissionGranted!==false||
     verified.executionEnabled!==false||!Number.isFinite(Date.parse(verified.expiresAt))||
     Date.parse(verified.expiresAt)<=Date.now()||
     identityRef.current!==currentIdentity)
     throw Error("Server returned an invalid ownership response.");
   setClock(Date.now());
   setServerProof({wallet:verified.wallet,verifiedAt:verified.verifiedAt,
    expiresAt:verified.expiresAt});
  }catch(e){setError(e instanceof Error?e.message:"Server verification failed.");}
  finally{setServerPending(false);}
 }
 async function copy(){
  if(!result||!address||result.wallet.toLowerCase()!==address.toLowerCase()||chainId!==57073)return;
  const now=Date.now();
  const age=now-Date.parse(result.checkedAt);
  if(!Number.isFinite(age)||age< -5000||age>=180000){
   setError("Wallet evidence has expired. Run a new live inspection before copying.");
   return;
  }
  try{
    const validProof=proof&&proof.wallet.toLowerCase()===result.wallet.toLowerCase()&&
      Date.parse(proof.expiry)>Date.now()?proof:null;
    await navigator.clipboard.writeText(JSON.stringify({
      ...result,
      m8Acceptance:assessM8Acceptance(result,validProof?{
        wallet:validProof.wallet,expiresAt:validProof.expiry,method:validProof.method,
      }:null,now,serverProof&&serverProof.wallet.toLowerCase()===result.wallet.toLowerCase()&&
       Date.parse(serverProof.expiresAt)>now?{
        wallet:serverProof.wallet,expiresAt:serverProof.expiresAt,verified:true,
       }:null),
      serverOwnershipResponse:serverProof&&Date.parse(serverProof.expiresAt)>now?{
        verifiedAt:serverProof.verifiedAt,expiresAt:serverProof.expiresAt,
        serverReportedVerified:true,reusableSession:false,
        independentlySignedReceipt:false,permissionGranted:false,
      }:{status:"not-tested"},
      clientSideOwnershipSelfTest:validProof?{
        verifiedAt:validProof.verifiedAt,expiresAt:validProof.expiry,
        verificationMethod:validProof.method,serverAuthenticated:false,
        permissionGranted:false,
      }:{status:"not-tested"},
    },null,2));
    setCopied(true);
  }catch{setError("Clipboard permission unavailable. The results remain visible below.");}
 }
 const reportTime=result?Date.parse(result.checkedAt):NaN;
 const reportFresh=Number.isFinite(reportTime)&&reportTime<=clock+5000&&clock-reportTime<180000;
 const activeReport=address&&chainId===57073&&
  result?.wallet.toLowerCase()===address.toLowerCase()&&reportFresh?result:null;
 const validProof=proof&&address&&proof.wallet.toLowerCase()===address.toLowerCase()&&
  Date.parse(proof.expiry)>clock?proof:null;
 const validServerProof=serverProof&&address&&
  serverProof.wallet.toLowerCase()===address.toLowerCase()&&
  Date.parse(serverProof.expiresAt)>clock?serverProof:null;
 const matrix=activeReport?assessM8Acceptance(activeReport,validProof?{
  wallet:validProof.wallet,expiresAt:validProof.expiry,method:validProof.method,
 }:null,clock,validServerProof?{
  wallet:validServerProof.wallet,expiresAt:validServerProof.expiresAt,verified:true,
 }:null):null;
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
     <button className="btn btn-secondary" type="button"
      disabled={!serverReady||busy||signing||serverPending||chainId!==57073}
      onClick={()=>void verifyServerControl()}><KeyRound size={15}/>
      {serverPending?"Checking one-use server proof…":"Verify with server"}</button>
     {activeReport&&<button className="btn btn-secondary" type="button" onClick={()=>void copy()}>
       <ClipboardCopy size={15}/>{copied?"Report copied":"Copy evidence report"}</button>}
    </div>
    {chainId!==57073&&<p className="ops-alert">Switch the wallet to Ink mainnet (57073) before running this inspection.</p>}
    {!serverReady&&<p className="ops-note">Server-verified ownership is disabled until private Redis and the explicit M8 enable flag are configured. Local signing checks remain separate and do not grant access.</p>}
    {validServerProof&&<p className="preflight-success" role="status">
      One-use server signature verification succeeded at {new Date(validServerProof.verifiedAt).toLocaleTimeString()}.
      The server consumed the challenge nonce. No server session, transaction privilege or durable certificate was created.
     </p>}
    {proof&&proof.wallet.toLowerCase()===address.toLowerCase()&&Date.parse(proof.expiry)>Date.now()&&
      <p className="preflight-success" role="status">
       Ink wallet signature verified locally on the connected RPC at {new Date(proof.verifiedAt).toLocaleTimeString()}.
       This self-test expires at {new Date(proof.expiry).toLocaleTimeString()} and is NOT a server session, transaction approval or production end-to-end certification.
      </p>}
    {result&&!activeReport&&chainId===57073&&<p className="ops-alert" role="alert">
      The previous report is stale or belongs to another wallet. Run a fresh inspection.
     </p>}
    {activeReport&&<div className="ops-verification">
     <div className="ops-scores">
      <div><strong>{activeReport.passed}</strong><span>Passed</span></div>
      <div><strong>{activeReport.failed}</strong><span>Failed</span></div>
      <div><strong>{activeReport.notTested}</strong><span>Not tested</span></div>
     </div>
     <p className="ops-note">Observed {new Date(activeReport.checkedAt).toLocaleString()}. Reports expire after three minutes. This is not a wallet ownership certificate or permission to transact.</p>
     {activeReport.referenceBlocks.length>0&&<div aria-label="Public Ink reference blocks">
      <h3>Inspectable block evidence</h3>
      <p className="ops-note">These public Ink block references can be compared against an independent explorer or RPC. They do not prove a wallet signature or settlement.</p>
      {activeReport.referenceBlocks.map(b=><div className="ops-check" key={b.source}>
       <span className="ops-check-state pass">INK</span>
       <div><strong>{b.source==="tydro-pool"?"Pinned Tydro Pool block":"Independent wallet RPC block"} #{b.blockNumber}</strong>
        <p><code>{b.blockHash}</code></p></div>
      </div>)}
     </div>}
     {matrix&&<div aria-label="M8 real-wallet acceptance gates">
      <h3>M8 acceptance gates — read-only</h3>
      <p className="ops-note">An active Nado position and genuine Tydro debt must be independently reconciled. Local and optional one-use server signature tests are separate; neither creates a trading permission, and no audit or protected preflight is asserted by this lab.</p>
      {matrix.gates.map(g=><div className="ops-check" key={g.id}>
       <span className={"ops-check-state "+g.state}>{g.state==="pass"?"PASS":g.state==="fail"?"FAIL":"NOT TESTED"}</span>
       <div><strong>{g.title}</strong><p>{g.detail}</p></div>
      </div>)}
      <p className="ops-note">Transaction-enabled: no · Full M8 acceptance: not complete.</p>
     </div>}
     {statuses.map(c=><div className="ops-check" key={c.id}>
      <span className={"ops-check-state "+c.state}>{c.state==="pass"?"PASS":c.state==="fail"?"FAIL":"NOT TESTED"}</span>
      <div><strong>{c.name}</strong><p>{c.detail}</p></div>
     </div>)}
     <div className="ops-note">{activeReport.notes.map((n,i)=><p key={i}>{n}</p>)}</div>
    </div>}
   </>}
  {error&&<p className="ops-alert" role="alert"><AlertCircle size={16}/>{error}</p>}
  <p className="ops-note">No wallet transactions or protocol actions are submitted, and reports are not persisted. Public account reads cannot prove successful trading or repayment. Local signature checks are browser-only. The optional separate server check consumes one Redis nonce, but grants no authenticated session or API execution permissions.</p>
 </section>;
}
