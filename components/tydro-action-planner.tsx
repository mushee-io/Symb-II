"use client";

import {useState} from "react";
import Link from "next/link";
import {useAccount} from "wagmi";
import {useQuery} from "@tanstack/react-query";
import {AlertTriangle,ClipboardCheck,LockKeyhole,RefreshCw,ShieldCheck} from "lucide-react";
import {WalletButton} from "@/components/wallet-button";
import {ink} from "@/lib/ink";
import {parseWatchOnlyAddress} from "@/lib/wallet/watch-only";
import {previewTydroAction,type TydroDraftAction} from "@/lib/tydro/action-preview";
import type {TydroAccountResponse,TydroMarketsResponse} from "@/lib/tydro/types";
import {observeTydroHealth} from "@/lib/tydro/health-policy";
import type {TydroSimulationReport} from "@/lib/tydro/four-action-simulation";
import styles from "@/app/workspace/actions/actions.module.css";

async function read<T>(url:string,signal?:AbortSignal):Promise<T>{
 const response=await fetch(url,{cache:"no-store",signal});
 if(!response.ok)throw Error("Read-only Tydro data unavailable (HTTP "+response.status+").");
 return response.json() as Promise<T>;
}
const actions=[
 {id:"supply",name:"Supply"},{id:"withdraw",name:"Withdraw"},
 {id:"borrow",name:"Borrow"},{id:"repay",name:"Repay variable debt"},
] as const;

export function TydroActionPlanner(){
 const {address,isConnected,chainId}=useAccount();
 const [watchInput,setWatchInput]=useState("");
 const [watchAddress,setWatchAddress]=useState<string|null>(null);
 const [watchError,setWatchError]=useState("");
 const [asset,setAsset]=useState("");
 const [action,setAction]=useState<TydroDraftAction>("supply");
 const [amount,setAmount]=useState("");
 const [simulation,setSimulation]=useState<{key:string;report:TydroSimulationReport}|null>(null);
 const [simulationError,setSimulationError]=useState("");
 const [simulationLoading,setSimulationLoading]=useState(false);
 const onInk=Boolean(address&&isConnected&&chainId===ink.id);
 const observedWallet=onInk?address:watchAddress;
 const isWatchOnly=!onInk&&Boolean(observedWallet);
 const markets=useQuery({
  queryKey:["tydro-markets"],
  queryFn:({signal})=>read<TydroMarketsResponse>("/api/tydro/markets",signal),
  retry:1,staleTime:30000,refetchInterval:60000,
 });
 const account=useQuery({
  queryKey:["tydro-account",observedWallet?.toLowerCase()],
  queryFn:({signal})=>read<TydroAccountResponse>(
   "/api/tydro/account?address="+encodeURIComponent(observedWallet!),signal),
  enabled:Boolean(observedWallet),retry:1,staleTime:30000,
  refetchInterval:observedWallet?60000:false,
 });
 const protectedPreflight=useQuery({
  queryKey:["tydro-preflight-config"],
  queryFn:({signal})=>read<{enabled:boolean}>("/api/preflight/config",signal),
  staleTime:30000,retry:1,
 });
 const selected=markets.data?.reserves.find(r=>r.address===asset)??markets.data?.reserves[0]??null;
 const simulationKey=[observedWallet,selected?.address,action,amount].join(":");
 const draft=previewTydroAction({
  action,asset:selected?.address??"",amount,wallet:observedWallet??null,
  markets:markets.data??null,account:account.data??null,
 });
 const health=account.data?observeTydroHealth({
  debtBase:account.data.debtBase,healthFactor:account.data.healthFactor,
  incomplete:account.data.incomplete,warnings:account.data.warnings,
 }):null;
 async function runSimulation(){
  if(!observedWallet||!selected||!amount||!protectedPreflight.data?.enabled)return;
  const key=simulationKey;
  setSimulationLoading(true);setSimulationError("");setSimulation(null);
  try{
   const response=await fetch("/api/tydro/simulate",{
    method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({wallet:observedWallet,asset:selected.address,action,amount}),
   });
   const data=await response.json() as {report?:TydroSimulationReport;error?:string};
   if(!response.ok||!data.report)throw Error(data.error??"Read-only simulation unavailable.");
   setSimulation({key,report:data.report});
  }catch(e){setSimulationError(e instanceof Error?e.message:"No simulation available.");}
  finally{setSimulationLoading(false);}
 }
 function watch(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();
  const address=parseWatchOnlyAddress(watchInput);
  if(!address){setWatchError("Enter a valid public EVM address. Never enter a seed phrase or private key.");return;}
  setWatchAddress(address);setWatchError("");setWatchInput("");
 }
 return <div className={styles.planner}>
   <div className={styles.notice} role="status"><LockKeyhole size={19}/>
    <span><strong>All lending execution is disabled.</strong> These are read-only intentions and evidence checks, not firm quotes, safe-to-execute approvals, prepared transactions or actual Aave simulations.</span>
   </div>
   <div className={styles.layout}>
    <section className={styles.panel} aria-label="Tydro action settings">
     <div className={styles.panelTitle}><ClipboardCheck size={18}/> Action draft</div>
     <div className={styles.fields}>
      <label htmlFor="tydro-draft-wallet">Public Ink address</label>
      <WalletButton/>
      <form onSubmit={watch} className={styles.watchForm}>
       <input id="tydro-draft-wallet" value={watchInput}
        onChange={e=>{setWatchInput(e.target.value);setWatchError("");}}
        placeholder="0x… public wallet address" autoComplete="off" spellCheck={false} maxLength={42}/>
       <button type="submit">Watch</button>
      </form>
      {watchError&&<p role="alert" className={styles.warning}>{watchError}</p>}
      <p className={styles.hint}>{observedWallet?
       (isWatchOnly?"Watching public address; ownership not verified: ":"Connected on Ink: ")+observedWallet:
       "Connect an Ink wallet or enter a public watch-only address. No signatures are requested."}</p>
      {watchAddress&&<button type="button" className={styles.minorButton}
        onClick={()=>setWatchAddress(null)}>Clear watched address</button>}
      <label htmlFor="tydro-draft-action">Lending action</label>
      <select id="tydro-draft-action" value={action} onChange={e=>setAction(e.target.value as TydroDraftAction)}>
       {actions.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <label htmlFor="tydro-draft-reserve">Tydro reserve</label>
      <select id="tydro-draft-reserve" value={selected?.address??""} onChange={e=>setAsset(e.target.value)}
       disabled={!markets.data?.reserves.length}>
       {!markets.data?.reserves.length&&<option value="">No verified reserves</option>}
       {markets.data?.reserves.map(x=><option key={x.address} value={x.address}>
        {x.symbol} · {x.address.slice(0,10)}…
       </option>)}
      </select>
      <label htmlFor="tydro-draft-amount">Amount in native token units</label>
      <input id="tydro-draft-amount" value={amount} onChange={e=>setAmount(e.target.value)}
       inputMode="decimal" placeholder={selected?"e.g. 1.25 "+selected.symbol:"e.g. 1.25"}
       autoComplete="off"/>
      <p className={styles.hint}>Token amount is checked at the reserve's exact decimal precision. There is no rounding, margin calculation or lending execution.</p>
      <button type="button" className={styles.minorButton}
       disabled={markets.isFetching||account.isFetching}
       onClick={()=>{void markets.refetch();if(observedWallet)void account.refetch();}}>
       <RefreshCw size={14}/> Refresh public evidence
      </button>
      <button type="button" className={styles.minorButton}
       disabled={!protectedPreflight.data?.enabled||!observedWallet||!selected||!amount||simulationLoading}
       onClick={()=>{void runSimulation();}}>
       <ShieldCheck size={14}/> {simulationLoading?"Checking pinned Ink block…":"Run read-only Pool simulation"}
      </button>
      {!protectedPreflight.data?.enabled&&<p className={styles.hint}>
       Protected eth_call simulations are not activated. Configure and verify Redis,
       then independently enable SYMB_II_PREFLIGHT_ENABLED on Vercel.
      </p>}
      {simulationError&&<p role="alert" className={styles.warning}>{simulationError}</p>}
      {markets.isPending&&<p className={styles.hint}>Loading canonical Tydro reserves…</p>}
      {markets.error&&<p className={styles.warning} role="alert">{markets.error.message}</p>}
      {observedWallet&&account.isPending&&<p className={styles.hint}>Loading account-specific Pool evidence…</p>}
      {account.error&&<p className={styles.warning} role="alert">{account.error.message}</p>}
     </div>
    </section>
    <section className={styles.panel} aria-label="Tydro draft checks">
      <div className={styles.panelTitle}><LockKeyhole size={18}/> Read-only evidence review</div>
      <div className={styles.summary}>
       <strong>{selected?.symbol??"Unknown asset"} · {action.toUpperCase()}</strong>
       <span>INK 57073 · {draft.state.toUpperCase()} · NO TRANSACTION</span>
       <p>Exact amount: {draft.atomicUnits??"Not verified"} atomic units</p>
       <p>Account health: {health?.display??"Unavailable"} · {health?.label??"Not inspected"}</p>
       {isWatchOnly&&<p className={styles.warning}>This is someone’s public on-chain address, not a verified wallet connection or permission to transact.</p>}
      </div>
      <div className={styles.gates}>
       {draft.gates.map(g=><div className={styles.gate} key={g.name}>
        {g.status==="observed"?<ShieldCheck size={17} color="#99d6a6"/>:
         <AlertTriangle size={17} color="#e6c59b"/>}
        <div><strong>{g.name} · {g.status==="observed"?"Observed":g.status==="blocked"?"Blocked":"Not verified"}</strong>
          <p>{g.detail}</p>
        </div>
       </div>)}
      </div>
      {simulation?.key===simulationKey&&<div className={styles.gates} aria-label="Pinned-block simulation results">
       <p className={styles.hint}><strong>Read-only Pool simulation</strong> · Block {simulation.report.blockNumber??"unknown"}</p>
       <p className={styles.hint}>Eth_call: {simulation.report.simulated?"Succeeded":"Not verified"} ·
        Gas estimate: {simulation.report.gasEstimate??"Unavailable"} ·
        Action review: {simulation.report.readyForHumanReview?"Indicative only":"Blocked"}</p>
       {simulation.report.gates.map(g=><div className={styles.gate} key={g.name}>
        {g.passed?<ShieldCheck size={17}/>:<AlertTriangle size={17}/>}
        <div><strong>{g.name} · {g.passed?"Observed":"Blocked"}</strong><p>{g.detail}</p></div>
       </div>)}
       <p className={styles.warning}>{simulation.report.note}</p>
      </div>}
      <div className={styles.blocked}><LockKeyhole size={16}/> Approvals, wallet signing and execution are unavailable.</div>
      <p className={styles.hint}>{draft.note}</p>
      <p className={styles.hint}>For chain-specific tests, open the separate <Link href="/workspace/preflight">Preflight diagnostics</Link>. For genuine lending transactions, use the official Tydro interface independently after reviewing its current risks.</p>
    </section>
   </div>
 </div>;
}
