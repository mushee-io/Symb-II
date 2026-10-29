import "server-only";
import {redis} from "../agent/redis";
import type { WatchEvent } from "./policy";

const MEMBERS="symb-ii:watch:members";
const key=(wallet:string,suffix:string)=>"symb-ii:watch:"+suffix+":"+wallet.toLowerCase();
export async function watchSubscribe(wallet:string):Promise<void>{
  await redis(["ZADD",MEMBERS,0,wallet.toLowerCase()]);
}
export async function watchUnsubscribe(wallet:string):Promise<void>{
  const w=wallet.toLowerCase();
  await redis(["ZREM",MEMBERS,w]);
  await redis(["DEL",key(w,"fingerprint"),key(w,"events"),key(w,"last")]);
}
export async function watchEnabledFor(wallet:string):Promise<boolean>{
  return (await redis(["ZSCORE",MEMBERS,wallet.toLowerCase()]))!==null;
}
export async function watchStatus(wallet:string){
  const w=wallet.toLowerCase();
  const [score,last,raw]=await Promise.all([
    redis(["ZSCORE",MEMBERS,w]),
    redis(["GET",key(w,"last")]),
    redis(["LRANGE",key(w,"events"),0,19]),
  ]);
  let events:WatchEvent[]=[];
  if(Array.isArray(raw)){
    for(const item of raw){
      try{
        const event=JSON.parse(String(item)) as WatchEvent;
        if(typeof event.at==="string"&&Array.isArray(event.details))events.push(event);
      }catch{/* corrupted prior event is never shown */}
    }
  }
  return {subscribed:score!==null,lastChecked:typeof last==="string"?last:null,events};
}
export async function leastRecentlyChecked(limit:number):Promise<string[]>{
  const result=await redis(["ZRANGE",MEMBERS,0,Math.max(0,limit-1)]);
  return Array.isArray(result)?result.filter((x):x is string=>typeof x==="string"&&/^0x[a-f0-9]{40}$/.test(x)): [];
}
export async function recordWatchCheck(wallet:string,now:string,alerts:import("../risk/alerts").RiskAlert[]){
  const w=wallet.toLowerCase();
  if(!await watchEnabledFor(w))return false;
  const previous=await redis(["GET",key(w,"fingerprint")]);
  const {createWatchEvent}=await import("./policy");
  const {event,fingerprint}=createWatchEvent(alerts,typeof previous==="string"?previous:null,now);
  // Check again to reduce writes if a subscription was revoked while a remote
  // provider was being fetched. Do not store raw portfolio or identity secrets.
  if(!await watchEnabledFor(w))return false;
  if(event){
    await redis(["LPUSH",key(w,"events"),JSON.stringify(event)]);
    await redis(["LTRIM",key(w,"events"),0,39]);
    await redis(["EXPIRE",key(w,"events"),60*60*24*90]);
  }
  await redis(["SET",key(w,"fingerprint"),fingerprint,"EX",60*60*24*90]);
  await redis(["SET",key(w,"last"),now,"EX",60*60*24*90]);
  await redis(["ZADD",MEMBERS,Date.parse(now),w]);
  return true;
}
