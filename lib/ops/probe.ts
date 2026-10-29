import "server-only";
import {createPublicClient,http} from "viem";
import {ink} from "../ink";
import {redis} from "../agent/redis";
import {getNadoMarkets} from "../nado/queries";
import {getTydroMarkets} from "../tydro/queries";
import {describeReadiness,type ServiceId} from "./readiness";

export type ProbeResult={id:ServiceId|"nado"|"tydro";state:"pass"|"fail"|"not-configured";detail:string};
async function probe(label:ProbeResult["id"],f:()=>Promise<boolean>):Promise<ProbeResult>{
 try{return {id:label,state:(await f())?"pass":"fail",detail:"Verified at request time (snapshot only)."};}
 catch{return {id:label,state:"fail",detail:"Connectivity or integrity check failed; no secrets exposed."};}
}
export async function probeServices():Promise<{checkedAt:string;results:ProbeResult[];executionEnabled:false}>{
 const r=describeReadiness();
 const enabledRedis=r.services.find(x=>x.id==="redis")?.status==="configured";
 const checks=await Promise.all([
  enabledRedis?probe("redis",async()=>await redis(["PING"])==="PONG"):
   Promise.resolve({id:"redis",state:"not-configured",detail:"Redis credentials missing."} as ProbeResult),
  probe("rpc",async()=>{
   const c=createPublicClient({chain:ink,transport:http(process.env.INK_RPC_URL||
     ink.rpcUrls.default.http[0],{timeout:10000,retryCount:0})});
   const [id,block]=await Promise.all([c.getChainId(),c.getBlock()]);
   return id===57073&&typeof block.number==="bigint"&&
     Number(block.timestamp)>Math.floor(Date.now()/1000)-180;
  }),
  probe("nado",async()=>{
   const data=await getNadoMarkets();
   const t=Date.parse(data.updatedAt);
   return data.chainId===57073&&data.markets.length>0&&Number.isFinite(t)&&
     t<=Date.now()+5000&&Date.now()-t<180000;
  }),
  probe("tydro",async()=>{
   const data=await getTydroMarkets();
   const t=Date.parse(data.updatedAt);
   return data.chainId===57073&&!data.incomplete&&data.reserves.length>0&&
     t<=Date.now()+5000&&Date.now()-t<180000;
  }),
 ]);
 return {checkedAt:new Date().toISOString(),results:checks,executionEnabled:false};
}
