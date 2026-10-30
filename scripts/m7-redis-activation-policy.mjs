/**
 * M7 production Redis acceptance policy (pure, no network or secrets).
 *
 * "accepted" means that the current exact deployed revision successfully ran
 * the *protected* one-use Redis drill and confirmed public read-only safety.
 * It does NOT mean M7 AI/Watch/Proposals/Preflight or M8 wallet acceptance.
 */
const isObject=value=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const sha40=/^[0-9a-f]{40}$/i;
const checkedRecently=(date,now)=>{
 if(typeof date!=="string")return false;
 const ms=Date.parse(date);
 return Number.isFinite(ms)&&ms<=now+5000&&now-ms>=0&&now-ms<=90000;
};
const gate=(id,valid,detail)=>({id,status:valid?"pass":"blocked",detail});

export function assessM7RedisActivation(args,now=Date.now()){
 const expectedSha=args?.expectedSha;
 const health=args?.health,readiness=args?.readiness;
 const verification=args?.verification,probe=args?.probe;
 const signals=[];
 const expectedValid=typeof expectedSha==="string"&&sha40.test(expectedSha);
 signals.push(gate("exact-release",expectedValid&&
   isObject(health)&&health.release===expectedSha.slice(0,12)&&
   health.product==="Symb-II"&&health.network?.chainId===57073,
   "Production /api/health must match this exact Git revision on Ink 57073."));
 signals.push(gate("read-only-deployment",isObject(readiness)&&
   readiness.release===expectedSha?.slice(0,12)&&
   readiness.chainId===57073&&readiness.executionEnabled===false&&
   readiness.liveCredentialsValidated===false,
   "Deployment readiness must match the release and never grant execution or claim live credentials."));
 const services=Array.isArray(readiness?.services)?readiness.services:[];
 const redis=services.filter(s=>isObject(s)&&s.id==="redis");
 const walletProof=services.filter(s=>isObject(s)&&s.id==="wallet-proof");
 signals.push(gate("redis-configuration",redis.length===1&&redis[0].status==="configured"&&
   redis[0].verifiedLive===false,
   "Server-only Upstash URL and token must be configured; readiness alone is not a live test."));
 signals.push(gate("wallet-proof-not-prematurely-enabled",walletProof.length===1&&
   walletProof[0].status==="disabled"&&
   isObject(verification)&&verification.enabled===false&&
   verification.executionEnabled===false&&verification.permissionGranted===false&&
   verification.serverSessionIssued===false,
   "Leave M8 wallet proof OFF until a separately accepted genuine wallet test."));
 const results=Array.isArray(probe?.results)?probe.results:[];
 const byId=new Map();
 let validShape=results.length>=5&&results.length<=16;
 for(const r of results){
  if(!isObject(r)||typeof r.id!=="string"||
     !["pass","fail","not-configured"].includes(r.state)||byId.has(r.id))
   validShape=false;
  else byId.set(r.id,r.state);
 }
 const hasAll=["redis","redis-services","rpc","nado","tydro"].every(id=>byId.get(id)==="pass");
 const noOtherFailures=[...byId.values()].every(state=>state==="pass");
 signals.push(gate("protected-live-redis-and-providers",
   args?.probeStatus===200&&
   isObject(probe)&&probe.executionEnabled===false&&
   checkedRecently(probe.checkedAt,now)&&
   isObject(probe.summary)&&probe.summary.healthy===true&&
   Array.isArray(probe.summary.requiredFailures)&&probe.summary.requiredFailures.length===0&&
   Array.isArray(probe.summary.unconfigured)&&!probe.summary.unconfigured.includes("redis")&&
   validShape&&hasAll&&noOtherFailures,
   "Protected probe must confirm live Redis one-use nonce integrity AND list/sorted-set storage operations, plus Ink RPC/Nado/Tydro integrity."));
 return {
  accepted:signals.every(s=>s.status==="pass"),
  scope:"m7-redis-one-use-and-public-provider-activation-only",
  checks:signals,executionEnabled:false,
  walletOwnershipVerified:false,realPositionsVerified:false,
  modelServiceValidated:false,preflightValidated:false,
 };
}
