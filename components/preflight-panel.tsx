"use client";
import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {useSignMessage} from "wagmi";
import {ShieldCheck,ShieldAlert,LockKeyhole} from "lucide-react";
import type {NadoAccountResponse} from "@/lib/nado/types";
import type {TydroAccountResponse} from "@/lib/tydro/types";
import type {PreflightReport,PreflightRequest} from "@/lib/preflight/policy";
import {preflightApprovalMessage} from "@/lib/preflight/policy";
import {nadoPositionKey} from "@/lib/risk/nado-stress";

async function post<T>(url:string,payload:unknown):Promise<T>{
 const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify(payload)});
 const data=await r.json().catch(()=>({})) as {error?:string};
 if(!r.ok)throw Error(data.error??"Preflight service is unavailable");
 return data as T;
}
export function PreflightPanel({wallet,tydro,nado}:{wallet:string;tydro?:TydroAccountResponse;nado?:NadoAccountResponse}){
 const [protocol,setProtocol]=useState<"Tydro"|"Nado">("Tydro");
 const [token,setToken]=useState("");
 const [position,setPosition]=useState("");
 const [percent,setPercent]=useState<10|25|50|75>(25);
 const [response,setResponse]=useState<{report:PreflightReport;reviewId:string|null}|null>(null);
 const [consent,setConsent]=useState(false);
 const [acknowledged,setAcknowledged]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const {signMessageAsync}=useSignMessage();
 const {data:config}=useQuery({
  queryKey:["preflight-config"],staleTime:60000,retry:1,
  queryFn:async()=>{const r=await fetch("/api/preflight/config",{cache:"no-store"});
   if(!r.ok)throw Error("Unavailable");return r.json() as Promise<{enabled:boolean}>;}
 });
 const debts=(tydro?.address.toLowerCase()===wallet.toLowerCase()?tydro.userReserves:[])
  .filter(r=>Number(r.variableDebt)>0);
 const positions=(nado?.address.toLowerCase()===wallet.toLowerCase()?nado.positions:[]);
 const asset=debts.some(x=>x.address===token)?token:debts[0]?.address;
 const selected=positions.some(x=>nadoPositionKey(x)===position)?position:
  (positions[0]?nadoPositionKey(positions[0]):undefined);
 function reset(){setResponse(null);setConsent(false);setAcknowledged(false);setError("");}
 async function inspect(){
  const request:PreflightRequest|undefined=protocol==="Tydro"?
   asset?{kind:"tydro-variable-repay",wallet,asset,percent}:undefined:
   selected?{kind:"nado-position-reduce",wallet,positionKey:selected,percent}:undefined;
  if(!request||busy)return;
  reset();setBusy(true);
  try{setResponse(await post("/api/preflight/check",request));}
  catch(e){setError(e instanceof Error?e.message:"Unable to inspect live protocol state");}
  finally{setBusy(false);}
 }
 async function signReview(){
  if(!response?.reviewId||!response.report.readyForHumanReview||!consent||busy)return;
  setBusy(true);setError("");
  try{
   const signature=await signMessageAsync({message:preflightApprovalMessage(response.report,window.location.origin)});
   await post("/api/preflight/acknowledge",{wallet,reviewId:response.reviewId,signature});
   setResponse(null);setAcknowledged(true);
  }catch(e){setResponse(null);setError((e instanceof Error?e.message:"Review failed")+". Obtain a fresh check to retry.");}
  finally{setBusy(false);}
 }
 return <section id="preflight" className="preflight-panel">
  <div className="preflight-heading"><div><span className="eyebrow">M06 / INK PRE-EXECUTION DIAGNOSTICS</span>
   <h2>Transaction Preflight</h2><p>On-chain read and simulation checks only. No orders, repayments, approvals or transaction payloads are issued.</p></div>
   <span><LockKeyhole size={14}/> EXECUTION OFF</span></div>
  <div className="preflight-tabs">{(["Tydro","Nado"] as const).map(name=>
   <button type="button" key={name} className={protocol===name?"active":""}
    onClick={()=>{setProtocol(name);reset();}}>{name}</button>)}</div>
  <p className="preflight-explainer">{protocol==="Tydro"?
   "This checks ONE existing variable-rate debt token, not an aggregate debt repayment. The verified Pool, token balance, allowance, simulated repay and gas are read where possible.":
   "Nado now checks the exact subaccount, engine reduce-only maximum, raw SDK size bounds, bid/ask, oracle reference and product metadata. These checks cannot create signed orders; margin, fill validity and execution remain blocked."}</p>
  <div className="preflight-fields"><label>{protocol==="Tydro"?"Variable-debt asset":"Open Nado position"}
   <select value={protocol==="Tydro"?asset??"":selected??""}
    onChange={e=>{protocol==="Tydro"?setToken(e.target.value):setPosition(e.target.value);reset();}}>
    {protocol==="Tydro"?debts.map(r=><option key={r.address} value={r.address}>{r.symbol} — {r.variableDebt}</option>):
     positions.map(p=><option key={nadoPositionKey(p)} value={nadoPositionKey(p)}>{p.symbol} · {p.side}</option>)}
   </select></label>
   <div><span>{protocol==="Tydro"?"Percentage of this variable debt":"Illustrative position reduction"}</span>
    <div className="preflight-percents">{([10,25,50,75] as const).map(n=>
     <button type="button" key={n} className={percent===n?"active":""}
      onClick={()=>{setPercent(n);reset();}}>{n}%</button>)}</div></div>
  </div>
  {!config?.enabled?<p className="preflight-availability"><ShieldAlert size={16}/> Protected on-chain preflight is disabled until its private Redis security store and feature switch are configured.</p>:
   <button type="button" className="btn btn-secondary" disabled={busy||(protocol==="Tydro"?!asset:!selected)}
    onClick={()=>void inspect()}>{busy?"Checking current Ink state…":"Run read-only preflight"}</button>}
  {response&&<div className="preflight-report">
   <strong>{response.report.target.protocol} · {response.report.readyForHumanReview?"Checks passed":"Blocked / incomplete"}</strong>
   <p>Checked {new Date(response.report.createdAt).toLocaleTimeString()} · Block {response.report.blockNumber??"Unavailable"}</p>
   {response.report.amount&&<p>Exact underlying amount: {response.report.amount.value} {response.report.amount.symbol}</p>}
   {response.report.gates.map(g=><div className="preflight-gate" key={g.name}>
    <span className={g.state}>{g.state.toUpperCase()}</span><div><strong>{g.name}</strong><p>{g.detail}</p></div></div>)}
   {response.report.nadoReduceOnly&&<div className="preflight-approval">
     <strong>NADO REDUCE-ONLY SIZE CHECK · READ ONLY</strong>
     <p>For this exact wallet subaccount, the Nado engine was queried with <code>reduceOnly=true</code> and the opposite side of the existing position. No signing request or order was created.</p>
     <div className="preflight-facts">
       <span>Selected reduction: {response.report.nadoReduceOnly.requestedPercent}%</span>
       <span>Existing position (SDK units): {response.report.nadoReduceOnly.currentPositionSize}</span>
       <span>Conservative increment-rounded portion (SDK units): {response.report.nadoReduceOnly.floorToIncrement??"Unavailable"}</span>
       <span>Engine reduce-only maximum (SDK units): {response.report.nadoReduceOnly.engineMaxReduceOnly??"Unavailable"}</span>
       <span>SDK resting minimum size: {response.report.nadoReduceOnly.minimumSize??"Unavailable"}</span>
       <span>SDK size increment: {response.report.nadoReduceOnly.sizeIncrement??"Unavailable"}</span>
       <span>Opposite side: {response.report.nadoReduceOnly.side??"Unknown"}</span>
       <span>Engine-side reference price: {response.report.nadoReduceOnly.priceReference??"Unavailable"}</span>
       <span>Indicative size boundaries: {response.report.nadoReduceOnly.feasibleBySize?"Within observed bounds":"Not verified / outside bounds"}</span>
     </div>
     <p>{response.report.nadoReduceOnly.reason}</p>
     {response.report.nadoReduceOnly.warnings.map((w,i)=><p key={i}>{w}</p>)}
     <p><strong>Execution still blocked.</strong> These raw SDK units are not an executable order size or a quote. Matching an engine size limit does not validate margin, fill price, fee costs, order-signing permission or actual liquidity.</p>
   </div>}
   {response.report.nadoMarketEvidence&&<div className="preflight-approval">
     <strong>NADO ENGINE EVIDENCE · NO ORDER SIGNED</strong>
     <p>Product configuration and prices are read independently from the official Nado engine and indexer. These are not fill quotes, liquidation marks or permission to trade.</p>
     <div className="preflight-facts">
       <span>Position: {response.report.nadoMarketEvidence.symbol} · {response.report.nadoMarketEvidence.side} · {response.report.nadoMarketEvidence.subaccount}</span>
       <span>Product ID: {response.report.nadoMarketEvidence.productId}</span>
       <span>Indexer last-trade reference: {response.report.nadoMarketEvidence.tickerLast}</span>
       <span>Engine oracle reference: {response.report.nadoMarketEvidence.engineOracle??"Unavailable"}</span>
       <span>Best bid: {response.report.nadoMarketEvidence.bestBid??"Unavailable"}</span>
       <span>Best ask: {response.report.nadoMarketEvidence.bestAsk??"Unavailable"}</span>
       <span>Top-of-book spread: {response.report.nadoMarketEvidence.spreadPercent??"Unavailable"}%</span>
       <span>Last trade/oracle divergence: {response.report.nadoMarketEvidence.tickerOracleDivergencePercent??"Unavailable"}%</span>
       <span>Engine price increment (SDK): {response.report.nadoMarketEvidence.priceIncrement??"Unavailable"}</span>
       <span>Engine size increment (SDK): {response.report.nadoMarketEvidence.sizeIncrement??"Unavailable"}</span>
       <span>Minimum resting-order size (SDK): {response.report.nadoMarketEvidence.minimumBookSize??"Unavailable"}</span>
       <span>Engine endpoint: {response.report.nadoMarketEvidence.engineEndpoint??"Unavailable"}</span>
     </div>
     {response.report.nadoMarketEvidence.limitations.map((reason,i)=><p key={i}>{reason}</p>)}
     <p>**Trading remains blocked:** no signed order, order-size simulation, margin-after-trade validation or guaranteed execution price is produced.</p>
   </div>}
   {response.report.snapshotEvidence&&<div className="preflight-approval">
     <strong>PINNED INK BLOCK EVIDENCE</strong>
     <p>Read-only token and Pool queries are bound to a single recorded block; reorg detection, formatted debt reconciliation, and latest-block freshness are checked independently.</p>
     <div className="preflight-facts">
       <span>Reference block: {response.report.snapshotEvidence.number}</span>
       <span>Block hash: {response.report.snapshotEvidence.hash??"Unavailable"}</span>
       <span>Reorg & freshness: {response.report.snapshotEvidence.verified?"Verified in snapshot":"Failed or unknown"}</span>
       <span>Variable debt (atomic units): {response.report.snapshotEvidence.variableDebtAtomic}</span>
       <span>Debt deviation (atomic units): {response.report.snapshotEvidence.accountDebtDeviationAtomic}</span>
       <span>Verified token decimals: {response.report.snapshotEvidence.tokenDecimals??"Unavailable"}</span>
     </div>
     <p>{response.report.snapshotEvidence.explanation}</p>
     <p>Simulation remains a momentary, read-only estimate; it does not represent settlement proof or guarantee transaction success.</p>
   </div>}
   {response.report.approvalDiagnostics&&<div className="preflight-approval">
     <strong>ERC-20 approval diagnostics — NO APPROVAL REQUESTED</strong>
     <p>{response.report.approvalDiagnostics.description}</p>
     <div className="preflight-facts">
       <span>Pool: {response.report.approvalDiagnostics.spender}</span>
       <span>Underlying: {response.report.approvalDiagnostics.tokenAddress}</span>
       <span>Exact allowance required: {response.report.approvalDiagnostics.required??"Unknown"}</span>
       <span>Current allowance: {response.report.approvalDiagnostics.existing??"Unknown"}</span>
       <span>Missing allowance: {response.report.approvalDiagnostics.shortfall??"Unknown"}</span>
       <span>Read-only approval simulation: {response.report.approvalDiagnostics.status}</span>
     </div>
     {response.report.approvalDiagnostics.status==="zero-reset-possible"&&
       <p className="preflight-approval-warning">The token may require a separate allowance reset before a later approval. The two transactions have not been simulated together, and Symb-II will not submit either one.</p>}
     {response.report.approvalDiagnostics.status!=="not-required"&&
       <p>To change allowance in the future, use a trusted wallet and independently verified protocol interface. This app does not request or broadcast approvals.</p>}
   </div>}
   <div className="preflight-facts">
     <span>Current Pool allowance: {response.report.allowance.current??"Unavailable"}</span>
     <span>Repay gas estimate: {response.report.gas.estimatedUnits??"Unavailable"} units</span>
     <span>Repay fee screen*: {response.report.gas.maxEstimatedNativeFee??"Unavailable"} ETH</span>
     <span>Wallet ETH: {response.report.gas.nativeBalance??"Unavailable"} ETH</span>
     <span>EIP-1559 maxFeePerGas: {response.report.gas.maxFeePerGasGwei??"Unavailable"} Gwei</span>
     <span>Approval simulation gas: {response.report.gas.approvalEstimatedGasUnits??"Unavailable"} units</span>
     <span>Approval fee screen*: {response.report.gas.approvalFeeScreeningEth??"Unavailable"} ETH</span>
   </div>
   <small>*EIP-1559 maxFeePerGas estimate × simulated gas × 1.5. Excludes OP Stack L1 data costs, changing fees and wallet-specific conditions. Not a guaranteed total fee or spending recommendation.</small>
   {response.report.readyForHumanReview&&response.reviewId&&
    <div className="preflight-consent"><label><input type="checkbox" checked={consent}
     onChange={e=>setConsent(e.target.checked)}/> This is a review acknowledgement only, not authorization to spend tokens.</label>
     <button type="button" className="btn btn-secondary" disabled={!consent||busy}
      onClick={()=>void signReview()}><ShieldCheck size={15}/> Sign check acknowledgement</button></div>}
  </div>}
  {acknowledged&&<p className="preflight-success">Preflight review acknowledged. No transaction was approved or broadcast.</p>}
  {error&&<p className="preflight-availability" role="alert">{error}</p>}
  <p className="preflight-disclaimer">Unlike scenario receipts, preflight acknowledgements use their own one-use digest and cannot authorize execution. A successful read-only simulation does not guarantee a future transaction.</p>
 </section>;
}
