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
const decimal=/^\d+(?:\.\d+)?$/;
const REQUIRED_SERVICES=["redis","ai","watch","proposals","preflight","wallet-proof","cron","rpc"];
const record=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const text=x=>typeof x==="string"&&x.length>0&&x.length<=128&&x.trim().length>0;
const gate=(id,state,note)=>({id,state,note});
const fresh=(value,now)=>{
 if(typeof value!=="string"||!Number.isFinite(now))return false;
 const ms=Date.parse(value);
 return Number.isFinite(ms)&&ms<=now+5000&&now-ms<180000;
};

/** A recent API observation is not proof of a fresh underlying trade/oracle. */
function validNado(snapshot,now){
 if(!record(snapshot)||snapshot.chainId!==INK||snapshot.source!=="Nado indexer"||
    !fresh(snapshot.updatedAt,now)||!Array.isArray(snapshot.markets)||
    snapshot.markets.length<1||snapshot.markets.length>512)return false;
 const ids=new Set();let perps=0;
 for(const m of snapshot.markets){
  if(!record(m)||!Number.isSafeInteger(m.productId)||m.productId<0||ids.has(m.productId)||
     !["spot","perp"].includes(m.type)||!text(m.symbol)||!text(m.base)||!text(m.quote)||
     !Number.isFinite(m.lastPrice)||m.lastPrice<=0||
     !Number.isFinite(m.volume24h)||m.volume24h<0||!Number.isFinite(m.change24h))return false;
  ids.add(m.productId);if(m.type==="perp")perps++;
 }
 return perps>0;
}
function validTydro(snapshot,now){
 if(!record(snapshot)||snapshot.chainId!==INK||
    snapshot.source!=="Tydro (Aave V3 Ink) contracts"||!fresh(snapshot.updatedAt,now)||
    typeof snapshot.pool!=="string"||snapshot.pool.toLowerCase()!==POOL||
    snapshot.incomplete!==false||!Array.isArray(snapshot.warnings)||snapshot.warnings.length!==0||
    !Array.isArray(snapshot.reserves)||snapshot.reserves.length<1||
    snapshot.reserves.length>32)return false;
 const ids=new Set();let active=0;
 for(const r of snapshot.reserves){
  if(!record(r)||typeof r.address!=="string"||!address.test(r.address)||
     ids.has(r.address.toLowerCase())||!text(r.symbol)||
     !Number.isInteger(r.decimals)||r.decimals<0||r.decimals>36||
     typeof r.supplied!=="string"||!decimal.test(r.supplied)||
     typeof r.borrowed!=="string"||!decimal.test(r.borrowed)||
     !Number.isFinite(r.supplyAprPct)||r.supplyAprPct<0||
     !Number.isFinite(r.borrowAprPct)||r.borrowAprPct<0||
     !Number.isFinite(r.ltvPct)||r.ltvPct<0||r.ltvPct>100||
     !Number.isFinite(r.liquidationThresholdPct)||r.liquidationThresholdPct<0||
     r.liquidationThresholdPct>100||
     [r.collateralEligible,r.borrowEnabled,r.active,r.frozen].some(v=>typeof v!=="boolean"))
    return false;
  ids.add(r.address.toLowerCase());if(r.active)active++;
 }
 return active>0;
}
function validServiceConfiguration(r){
 if(!record(r)||r.executionEnabled!==false||r.liveCredentialsValidated!==false||
    !Array.isArray(r.services)||r.services.length!==REQUIRED_SERVICES.length)return false;
 const ids=new Set();
 for(const service of r.services){
  if(!record(service)||!REQUIRED_SERVICES.includes(service.id)||ids.has(service.id)||
     !["configured","disabled","blocked"].includes(service.status)||
     service.verifiedLive!==false)return false;
  ids.add(service.id);
 }
 return REQUIRED_SERVICES.every(id=>ids.has(id));
}
function validRelease(health,readiness,sha){
 return record(health)&&health.product==="Symb-II"&&record(health.network)&&
    health.network.chainId===INK&&record(readiness)&&
    readiness.network==="Ink"&&readiness.chainId===INK&&
    releaseMatches(health.release,sha)&&releaseMatches(readiness.release,sha);
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

export function assessM9PublicQualification(input,now=Date.now()){
 const {expectedSha,health,readiness,recheckHealth,recheckReadiness,configs,nado,tydro}=
  record(input)?input:{};
 const hasSha=typeof expectedSha==="string"&&/^[a-f0-9]{40}$/i.test(expectedSha);
 const revision=hasSha&&validRelease(health,readiness,expectedSha)&&
  validRelease(recheckHealth,recheckReadiness,expectedSha)&&
  validServiceConfiguration(readiness)&&validServiceConfiguration(recheckReadiness);
 const nonExecutable=validServiceConfiguration(readiness)&&
  validServiceConfiguration(recheckReadiness)&&safeConfigs(configs);
 const providers=validNado(nado,now)&&validTydro(tydro,now);
 const configuredRedis=validServiceConfiguration(readiness)&&
  readiness.services.find(s=>s.id==="redis")?.status==="configured";
 const gates=[
  gate("exact-production-revision",revision?"pass":"blocked",
   "Expected main SHA prefix must match health/readiness both before and after provider reads; not a deployment attestation."),
  gate("non-executable-route-contracts",nonExecutable?"pass":"blocked",
   "Public response contracts must deny execution, spending, reusable sessions and claimed live credential verification."),
  gate("public-nado-tydro-snapshots",providers?"pass":"blocked",
   "Fresh Ink Nado and canonical Tydro snapshot metadata must be coherent; underlying trade/oracle freshness is unproven."),
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
  note:"Public-only short-lived precheck. It cannot certify Redis, wallet control, upstream positions, external review or trading permission.",
 };
}
