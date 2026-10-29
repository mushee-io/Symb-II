import "server-only";
import {createPublicClient,http} from "viem";
import {ink} from "../ink";
import {redis} from "../agent/redis";
import {verifyRedisOneUse} from "./redis-one-use";
import {getNadoMarkets} from "../nado/queries";
import {getTydroMarkets} from "../tydro/queries";
import {assessNadoMarketIntegrity,assessTydroMarketIntegrity} from "./provider-integrity";
import {describeReadiness,type ServiceId} from "./readiness";

export type ProbeResult={id:ServiceId|"nado"|"tydro";state:"pass"|"fail"|"not-configured";detail:string};
async function probe(label:ProbeResult["id"],f:()=>Promise<boolean>):Promise<ProbeResult>{
 try{return {id:label,state:(await f())?"pass":"fail",detail:"Verified at request time (snapshot only)."};}
 catch{return {id:label,state:"fail",detail:"Connectivity or integrity check failed; no secrets exposed."};}
}
import {summariseProbes,type ProbeSummary} from "./probe-summary";

export async function probeServices():Promise<{checkedAt:string;results:ProbeResult[];summary:ProbeSummary;executionEnabled:false}>{
 const r=describeReadiness();
 const enabledRedis=r.services.find(x=>x.id==="redis")?.status==="configured";
 const checks=await Promise.all([
  enabledRedis?probe("redis",async()=>{
   // A PING is not enough for production one-use signatures. These commands
   // exercise the same Redis atomic nonce primitives used by M8.
   if(await redis(["PING"])!=="PONG")return false;
   return (await verifyRedisOneUse(redis)).ok;
  }):
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
   return assessNadoMarketIntegrity(data).valid;
  }),
  probe("tydro",async()=>{
   const data=await getTydroMarkets();
   return assessTydroMarketIntegrity(data).valid;
  }),
 ]);
 return {checkedAt:new Date().toISOString(),results:checks,summary:summariseProbes(checks),executionEnabled:false};
}
