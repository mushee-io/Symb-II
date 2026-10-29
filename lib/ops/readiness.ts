/**
 * M7 launch readiness is a transparent, non-sensitive configuration check.
 * Never return env variable values, tokens, Redis endpoints or backend errors.
 * Configured != connected, tested or production-ready.
 */
export type ServiceId="redis"|"ai"|"watch"|"proposals"|"preflight"|"wallet-proof"|"cron"|"rpc";
export type GateState="configured"|"disabled"|"blocked";
export type LaunchGate={
 id:ServiceId;title:string;status:GateState;
 requirements:string[];issues:string[];verifiedLive:false;
};
const set=(value:string|undefined)=>typeof value==="string"&&value.trim().length>0;
const secureUrl=(value:string|undefined)=>{
 if(!set(value))return false;
 try{
  const url=new URL(value!);
  return url.protocol==="https:"&&url.hostname.endsWith(".upstash.io")&&
    !url.username&&!url.password&&!url.port&&(url.pathname==="/"||url.pathname==="");
 }catch{return false;}
};
export function hasValidRedisConfiguration(env:NodeJS.ProcessEnv=process.env):boolean{
 return secureUrl(env.UPSTASH_REDIS_REST_URL)&&set(env.UPSTASH_REDIS_REST_TOKEN);
}
export function possibleGatewayAuthentication(env:NodeJS.ProcessEnv=process.env):boolean{
 return Boolean(env.AI_GATEWAY_API_KEY)||Boolean(env.VERCEL_OIDC_TOKEN)||env.VERCEL==="1";
}
export function describeReadiness(env:NodeJS.ProcessEnv=process.env):{
 network:"Ink";chainId:57073;services:LaunchGate[];allServicesConfigured:boolean;
 liveCredentialsValidated:false;executionEnabled:false;
}{
 const redisUrl=secureUrl(env.UPSTASH_REDIS_REST_URL);
 const redisToken=set(env.UPSTASH_REDIS_REST_TOKEN);
 const redis=hasValidRedisConfiguration(env);
 const cron=set(env.CRON_SECRET)&&(env.CRON_SECRET?.length??0)>=32;
 const rows:LaunchGate[]=[];
 const add=(id:ServiceId,title:string,enabled:boolean,requirements:string[],missing:string[])=>{
   rows.push({
     id,title,
     status:enabled?(missing.length?"blocked":"configured"):"disabled",
     requirements,issues:missing,verifiedLive:false,
   });
 };
 add("redis","Private shared security store",true,["Upstash Redis TLS endpoint","Redis REST access token"],[
  ...(!redisUrl?["A valid HTTPS *.upstash.io endpoint is required."]:[]),
  ...(!redisToken?["Redis access token missing."]:[]),
 ]);
 add("cron","Protected scheduled worker secret",true,["CRON_SECRET of at least 32 characters"],[
   ...(!cron?["Strong CRON_SECRET missing."]:[])
 ]);
 const dependent=(id:ServiceId,title:string,flag:string,needs:{ok:boolean;label:string}[])=>{
   add(id,title,env[flag]==="true",[flag+"=true",...needs.map(x=>x.label)],
    needs.filter(x=>!x.ok).map(x=>x.label+" missing or invalid."));
 };
 dependent("ai","Model-generated account explanations","SYMB_II_AI_ENABLED",[
   {ok:redis,label:"Private Redis credentials"},
   {ok:possibleGatewayAuthentication(env),label:"AI Gateway key or Vercel OIDC runtime (live verification and budget required)"},
 ]);
 dependent("watch","Opt-in background risk snapshots","SYMB_II_WATCH_ENABLED",[
   {ok:redis,label:"Private Redis credentials"},
   {ok:Boolean(cron),label:"CRON_SECRET (32+ characters)"},
 ]);
 dependent("proposals","One-use signed scenario receipts","SYMB_II_PROPOSALS_ENABLED",[
   {ok:redis,label:"Private Redis credentials"},
 ]);
 dependent("preflight","Signed read-only chain preflight","SYMB_II_PREFLIGHT_ENABLED",[
   {ok:redis,label:"Private Redis credentials"},
 ]);
 dependent("wallet-proof","One-use server wallet ownership self-test","SYMB_II_WALLET_PROOF_ENABLED",[
   {ok:redis,label:"Private Redis credentials"},
 ]);
 add("rpc","Ink public RPC",true,["Ink chain ID 57073 (runtime verification required)"],[]);
 return {
   network:"Ink",chainId:57073,services:rows,
   allServicesConfigured:rows.every(row=>row.status==="configured"),
   liveCredentialsValidated:false,executionEnabled:false,
 };
}
