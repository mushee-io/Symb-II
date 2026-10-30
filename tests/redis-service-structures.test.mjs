import {test} from "node:test";
import assert from "node:assert/strict";
import {verifyRedisServiceStructures} from "../lib/ops/redis-service-structures.ts";

function fakeRedis(options={}){
 const lists=new Map(),sets=new Map(),ttl=new Map(),calls=[];
 const run=async cmd=>{
  const [verb,key,...args]=cmd;
  calls.push({verb,key,cmd});
  if(options.failOn===verb)throw Error("private-provider-error");
  if(verb==="LPUSH"){
   const current=lists.get(key)||[];
   lists.set(key,[...args].reverse().concat(current));
   return lists.get(key).length;
  }
  if(verb==="LTRIM"){
   lists.set(key,(lists.get(key)||[]).slice(args[0],args[1]+1));
   return options.corruptOn===verb?"BROKEN":"OK";
  }
  if(verb==="LRANGE"){
   const result=(lists.get(key)||[]).slice(args[0],args[1]+1);
   return options.corruptOn===verb?["altered"]:result;
  }
  if(verb==="EXPIRE"){
   if(!lists.has(key)&&!sets.has(key))return 0;
   ttl.set(key,args[0]);
   return options.corruptOn===verb?0:1;
  }
  if(verb==="TTL")return options.corruptOn===verb?-1:(ttl.get(key)??-2);
  if(verb==="ZADD"){
   const data=sets.get(key)||new Map();
   for(let i=0;i<args.length;i+=2)data.set(args[i+1],args[i]);
   sets.set(key,data);
   return options.corruptOn===verb?0:args.length/2;
  }
  if(verb==="ZSCORE")return options.corruptOn===verb?"999":
    (sets.get(key)?.has(args[0])?String(sets.get(key).get(args[0])):null);
  if(verb==="ZRANGE"){
   const data=sets.get(key)||new Map();
   const rows=[...data.entries()].sort((a,b)=>a[1]-b[1])
    .map(([name])=>name).slice(args[0],args[1]+1);
   return options.corruptOn===verb?[...rows].reverse():rows;
  }
  if(verb==="ZREM"){
   const existed=sets.get(key)?.delete(args[0])?1:0;
   return options.corruptOn===verb?0:existed;
  }
  if(verb==="DEL"){
   if(options.badCleanup)return -1;
   let count=0;
   for(const entry of [key,...args]){
    if(lists.delete(entry))count++;
    if(sets.delete(entry))count++;
    ttl.delete(entry);
   }
   return count;
  }
  throw Error("Unsupported test command.");
 };
 return {run,lists,sets,ttl,calls};
}
test("synthetic M7 receipts and Watch Redis structures verify storage and clean up",async()=>{
 const f=fakeRedis(),result=await verifyRedisServiceStructures(f.run);
 assert.equal(result.ok,true);
 assert.equal(result.stage,"complete");
 assert.equal(result.detail.includes("private-provider-error"),false);
 assert.equal(f.lists.size,0);
 assert.equal(f.sets.size,0);
 assert.equal(f.ttl.size,0);
 assert.deepEqual(f.calls.map(x=>x.verb),[
  "LPUSH","LTRIM","LRANGE","EXPIRE","TTL",
  "ZADD","EXPIRE","TTL","ZSCORE","ZRANGE","ZREM","ZSCORE","DEL",
 ]);
 const keys=f.calls.flatMap(c=>[c.key]);
 assert.equal(keys.every(k=>k.startsWith("symb-ii:ops:")),true);
 assert.equal(keys.some(k=>k.includes("watch:members")||k.includes("proposal:receipts:")),false);
 assert.equal(JSON.stringify(result).includes(keys[0]),false);
});
test("corrupt or unsupported list and sorted-set commands never pass readiness",async()=>{
 for(const stage of ["LPUSH","LTRIM","LRANGE","EXPIRE","TTL","ZADD","ZSCORE","ZRANGE","ZREM"]){
  const f=fakeRedis({failOn:stage});
  const result=await verifyRedisServiceStructures(f.run);
  assert.equal(result.ok,false,stage);
  assert.equal(f.lists.size,0,stage);
  assert.equal(f.sets.size,0,stage);
  assert.equal(JSON.stringify(result).includes("private-provider-error"),false);
 }
});
test("Redis responses that claim success but break list retention or watch sorting fail",async()=>{
 for(const stage of ["LTRIM","LRANGE","EXPIRE","TTL","ZADD","ZSCORE","ZRANGE","ZREM"]){
  const f=fakeRedis({corruptOn:stage});
  const result=await verifyRedisServiceStructures(f.run);
  assert.equal(result.ok,false,stage);
  assert.equal(f.lists.size,0);
  assert.equal(f.sets.size,0);
 }
});
test("a failed synthetic-key cleanup prevents accepting a live service drill",async()=>{
 const f=fakeRedis({badCleanup:true});
 const result=await verifyRedisServiceStructures(f.run);
 assert.deepEqual({ok:result.ok,stage:result.stage},{ok:false,stage:"cleanup"});
 assert.equal(result.detail.includes("synthetic-first"),false);
});
