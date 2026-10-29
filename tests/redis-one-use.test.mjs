import {test} from "node:test";
import assert from "node:assert/strict";
import {verifyRedisOneUse} from "../lib/ops/redis-one-use.ts";

function fakeRedis(options={}){
 const records=new Map();
 const calls=[];
 const execute=async cmd=>{
  const [verb,key,...args]=cmd;calls.push(verb);
  if(options.errorOn===verb)throw Error("private-upstream-error");
  if(verb==="SET"){
   if(records.has(key))return null;
   records.set(key,{value:args[0],ttl:options.badTtl??30});
   return options.badSet?null:"OK";
  }
  if(verb==="TTL")return records.get(key)?.ttl??-2;
  if(verb==="GETDEL"){
   if(options.badConsume)return "altered-value";
   if(options.replayReturnsValue&&!records.has(key))return options.replayReturnsValue;
   const value=records.get(key)?.value??null;
   records.delete(key);
   return value;
  }
  if(verb==="DEL"){records.delete(key);return 1;}
  throw Error("unexpected-command");
 };
 return {execute,calls,records};
}
test("one-use Redis probe validates SET NX EX, bounded TTL, GETDEL and replay prevention",async()=>{
 const x=fakeRedis();
 const result=await verifyRedisOneUse(x.execute);
 assert.equal(result.ok,true);
 assert.equal(result.stage,"complete");
 assert.deepEqual(x.calls,["SET","TTL","GETDEL","GETDEL","DEL"]);
 assert.equal(x.records.size,0);
 assert.equal(JSON.stringify(result).includes("symb-ii:ops:one-use:"),false);
});
test("replay returning stale value fails closed",async()=>{
 const x=fakeRedis({replayReturnsValue:"non-null-replay"});
 const result=await verifyRedisOneUse(x.execute);
 assert.equal(result.ok,false);
 assert.equal(result.stage,"replay");
 assert.equal(x.records.size,0);
});
test("rejected SET NX, unhealthy TTL and inconsistent consumption never pass",async()=>{
 for(const [opt,expected] of [
  [{badSet:true},"set"],
  [{badTtl:-1},"ttl"],
  [{badTtl:0},"ttl"],
  [{badTtl:31},"ttl"],
  [{badConsume:true},"consume"],
 ]){
  const x=fakeRedis(opt);
  const result=await verifyRedisOneUse(x.execute);
  assert.equal(result.ok,false,JSON.stringify(opt));
  assert.equal(result.stage,expected);
  assert.equal(x.records.size,0);
 }
});
test("Redis command unavailability never pretends to be a successful probe",async()=>{
 for(const step of ["SET","TTL","GETDEL","DEL"]){
  const x=fakeRedis({errorOn:step});
  const result=await verifyRedisOneUse(x.execute);
  assert.equal(result.ok,false,step);
  assert.equal(JSON.stringify(result).includes("private-upstream-error"),false);
 }
});
