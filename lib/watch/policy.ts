import type { RiskAlert } from "../risk/alerts.ts";

export type WatchAction = "subscribe" | "unsubscribe" | "status";
export function isWatchAction(value:unknown):value is WatchAction {
  return value==="subscribe"||value==="unsubscribe"||value==="status";
}
export function watchChallengeMessage(args:{
  address:string;action:WatchAction;id:string;origin:string;issuedAt:string;
}):string {
  const url=new URL(args.origin);
  if((url.protocol!=="https:"&&url.hostname!=="localhost")||
    !/^0x[0-9a-f]{40}$/i.test(args.address)||
    !/^[0-9a-f-]{36}$/i.test(args.id)||
    !isWatchAction(args.action))throw Error("Invalid watch challenge parameters");
  return [
    "Symb-II read-only background watch consent",
    "Domain: "+url.host,
    "Wallet: "+args.address.toLowerCase(),
    "Chain ID: 57073",
    "Action: "+args.action,
    "Nonce: "+args.id,
    "Issued At: "+args.issuedAt,
    "Expires In: 120 seconds",
    "This signature authorizes only the stated watch action, not a trade, transfer, lending transaction or spending approval.",
    "A subscription stores a public wallet address and monitored risk-alert status until revoked."
  ].join("\n");
}
export function validActionMessage(message:string,action:WatchAction,wallet:string,origin:string):boolean {
  let hostname:string;
  try{hostname=new URL(origin).host;}catch{return false;}
  return message.startsWith("Symb-II read-only background watch consent\n")&&
    message.includes("\nDomain: "+hostname+"\n")&&
    message.includes("\nWallet: "+wallet.toLowerCase()+"\n")&&
    message.includes("\nChain ID: 57073\n")&&
    message.includes("\nAction: "+action+"\n");
}

export type WatchEvent = {
  at:string;
  kind:"alert-change"|"recovery"|"initial";
  critical:number;
  warning:number;
  details:{source:"Nado"|"Tydro";level:"critical"|"warning"|"info";id:string;title:string}[];
};
/** Changes in alert IDs or severity result in a single event. Never store account
 * balances, private keys, collateral amounts, health numbers or raw protocol payloads. */
export function createWatchEvent(alerts:RiskAlert[],previous:string|null,at:string):{
  fingerprint:string;event:WatchEvent|null
} {
  const details=alerts.map(a=>({source:a.source,level:a.level,id:a.id,title:a.title}))
    .sort((a,b)=>a.id.localeCompare(b.id));
  const fingerprint=JSON.stringify(details.map(a=>a.id+":"+a.level));
  if(previous===fingerprint)return {fingerprint,event:null};
  const kind:WatchEvent["kind"]=previous===null?"initial":details.length===0?"recovery":"alert-change";
  return {fingerprint,event:{at,kind,
    critical:details.filter(a=>a.level==="critical").length,
    warning:details.filter(a=>a.level==="warning").length,details,
  }};
}
export function isWatchConfigured(env:NodeJS.ProcessEnv=process.env):boolean {
  return env.SYMB_II_WATCH_ENABLED==="true" &&
    Boolean(env.UPSTASH_REDIS_REST_URL) &&
    Boolean(env.UPSTASH_REDIS_REST_TOKEN) &&
    typeof env.CRON_SECRET==="string" &&
    env.CRON_SECRET.length>=16;
}
