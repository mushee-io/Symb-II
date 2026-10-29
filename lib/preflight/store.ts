import {hasValidRedisConfiguration} from "../ops/readiness";
import "server-only";
import {redis} from "@/lib/agent/redis";
import type {PreflightReport} from "./policy";

export function isPreflightConfigured(env:NodeJS.ProcessEnv=process.env):boolean{
 return env.SYMB_II_PREFLIGHT_ENABLED==="true"&&
  hasValidRedisConfiguration(env);
}
export async function storePreflight(id:string,report:PreflightReport):Promise<boolean>{
 return await redis(["SET","symb-ii:preflight:packet:"+id,JSON.stringify(report),"EX",90,"NX"])==="OK";
}
export async function consumePreflight(id:string):Promise<PreflightReport|null>{
 const raw=await redis(["GETDEL","symb-ii:preflight:packet:"+id]);
 if(typeof raw!=="string")return null;
 try{return JSON.parse(raw) as PreflightReport;}catch{return null;}
}
export async function recordPreflightAcknowledgement(wallet:string,data:{
 id:string;digest:string;createdAt:string;kind:string;
}):Promise<void>{
 const key="symb-ii:preflight:ack:"+wallet.toLowerCase();
 await redis(["LPUSH",key,JSON.stringify(data)]);
 await redis(["LTRIM",key,0,19]);
 await redis(["EXPIRE",key,60*60*24*30]);
}
