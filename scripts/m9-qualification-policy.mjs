/**
 * M9 read-only public release qualification policy.
 *
 * The observations passed here are UNTRUSTED responses from public routes.
 * Only the separate CLI fetches them. Passing this policy is a public precheck,
 * NEVER wallet/Redis verification, security approval or trading permission.
 */
import {releaseMatches} from "./release-policy.mjs";

const INK=57073;
const POOL="0x2816cf15f6d2a220e789aa011d5ee4eb6c47feba";
const address=/^0x[a-f0-9]{40}$/i;
const record=value=>Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
const gate=(id,state,note)=>({id,state,note});

function validNado(snapshot){
 if(!record(snapshot)||snapshot.chainId!==INK||snapshot.source!=="Nado indexer"||
    !Array.isArray(snapshot.markets)||snapshot.markets.length<1||snapshot.markets.length>2000)return false;
 const ids=new Set();
 for(const market of snapshot.markets){
  if(!record(market)||!Number.isSafeInteger(market.productId)||market.productId<0||
     ids.has(market.productId)||!Number.isFinite(market.lastPrice)||market.lastPrice<=0)return false;
  ids.add(market.productId);
 }
 return snapshot.markets.some(m=>m.type==="perp");
}
function validTydro(snapshot){
 if(!record(snapshot)||snapshot.chainId!==INK||
    (typeof snapshot.pool!=="string"||snapshot.pool.toLowerCase()!==POOL)||snapshot.incomplete!==false||
    !Array.isArray(snapshot.warnings)||snapshot.warnings.length!==0||
    !Array.isArray(snapshot.reserves)||snapshot.reserves.length<1||
    snapshot.reserves.length>32)return false;
 const ids=new Set();
 for(const reserve of snapshot.reserves){
  if(!record(reserve)||typeof reserve.address!=="string"||
     !address.test(reserve.address)||ids.has(reserve.address.toLowerCase())||
     !Number.isInteger(reserve.decimals)||reserve.decimals<0||reserve.decimals>36)return false;
  ids.add(reserve.address.toLowerCase());
 }
 return true;
}
function safeConfigs(c){
 if(!record(c))return false;
 const {preflight,proposals,agent,watch,verification}=c;
 return record(preflight)&&preflight.supportsExecution===false&&
  record(proposals)&&proposals.supportsExecution===false&&proposals.supportsBroadcast===false&&
  record(agent)&&agent.chainId===INK&&agent.tradingEnabled===false&&
  record(watch)&&watch.executionEnabled===false&&watch.notificationsDelivered===false&&
  record(verification)&&verification.chainId===INK&&verification.executionEnabled===false&&
   verification.permissionGranted===false&&verification.serverSessionIssued===false&&
   verification.redisOneUseNonce===true;
}

export function assessM9PublicQualification(input){
 const {expectedSha,health,readiness,configs,nado,tydro}=record(input)?input:{};
 const revision=typeof expectedSha==="string"&&/^[a-f0-9]{40}$/i.test(expectedSha)&&
  record(health)&&health.product==="Symb-II"&&health.network?.chainId===INK&&
  record(readiness)&&readiness.network==="Ink"&&readiness.chainId===INK&&
  releaseMatches(health.release,expectedSha)&&releaseMatches(readiness.release,expectedSha);
 const nonExecutable=record(readiness)&&readiness.executionEnabled===false&&
  readiness.liveCredentialsValidated===false&&safeConfigs(configs);
 const providers=validNado(nado)&&validTydro(tydro);
 const configuredRedis=record(readiness)&&Array.isArray(readiness.services)&&
  readiness.services.filter(s=>s?.id==="redis").length===1&&
  readiness.services.find(s=>s?.id==="redis")?.status==="configured";
 const gates=[
  gate("exact-production-revision",revision?"pass":"blocked",
   "Exact expected main-branch SHA must match both production health and readiness responses."),
  gate("non-executable-route-contracts",nonExecutable?"pass":"blocked",
   "Public response contracts must deny execution, spending, reusable sessions and claimed live credential verification."),
  gate("public-nado-tydro-snapshots",providers?"pass":"blocked",
   "Ink Nado tickers and canonical Tydro reserves must be structurally consistent; this does not verify wallet data."),
  gate("private-redis-one-use-drill",configuredRedis?"not-tested":"blocked",
   "A configured Redis status is NOT live proof. Requires authenticated protected one-use and replay drill."),
  gate("real-nado-position-reconciliation","not-tested",
   "Requires a real active wallet and independently recorded Nado position evidence."),
  gate("real-tydro-borrow-reconciliation","not-tested",
   "Requires real variable debt and independent pinned Pool verification."),
  gate("eoa-and-erc1271-wallet-proof","not-tested",
   "Requires real one-time signatures and contract-wallet trials, not mocked CI results."),
  gate("independent-ink-rpc-evidence","not-tested",
   "Run M8 independent RPC block verification and retain time-limited operator evidence."),
  gate("protected-preflight-and-replay","not-tested",
   "Requires live private preflight, strict expiry, replay resistance and negative-case drills."),
  gate("mobile-wallet-interoperability","not-tested",
   "Independent mobile wallet connectivity is not established by injected-browser support."),
  gate("external-notification-delivery","not-tested",
   "Real opt-in delivery, retries, unsubscribe, failure alarms and abuse controls must be tested separately."),
  gate("independent-security-and-incident-review","not-tested",
   "Requires third-party findings closure, controlled failure drill and signed operator sign-off."),
 ];
 const publicPrecheckPassed=gates.slice(0,3).every(g=>g.state==="pass");
 return {
  kind:"symb-ii-m9-read-only-qualification",milestone:"M9",chainId:INK,
  release:revision?expectedSha.slice(0,12):null,
  publicPrecheckPassed,manualAcceptanceRequired:true,
  releaseQualified:false,readyForPublicBeta:false,executionEnabled:false,
  gates,
  note:"Public-only, point-in-time precheck. It cannot activate Redis, prove account ownership, attest external audits or authorize any trade.",
 };
}
