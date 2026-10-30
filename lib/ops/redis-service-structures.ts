import {randomUUID} from "node:crypto";
import type {RedisCommand} from "./redis-one-use.ts";

/**
 * M7 synthetic storage drill for REAL commands used by Watch, Proposals and
 * Preflight. Only the protected operator probe calls this. The keys are unique,
 * expire quickly, never contain a wallet or private account information and
 * are cleaned up even after failure.
 *
 * This is not an acceptance of actual wallet signatures, worker delivery,
 * protocol account results or AI model responses.
 */
export type RedisStructuresStage=
 "list-write"|"list-trim"|"list-read"|"list-retention"|
 "sorted-write"|"sorted-retention"|"sorted-score"|"sorted-order"|"sorted-remove"|
 "cleanup"|"complete";
export type RedisStructuresResult={
 ok:boolean;stage:RedisStructuresStage;detail:string;
};
const outcome=(ok:boolean,stage:RedisStructuresStage):RedisStructuresResult=>({
 ok,stage,
 detail:ok?
  "Live private Redis list/receipt retention and watch sorted-set primitives verified.":
  "Configured Redis did not satisfy the private receipt/watch storage integrity drill.",
});

export async function verifyRedisServiceStructures(command:RedisCommand):Promise<RedisStructuresResult>{
 const id=randomUUID();
 const list="symb-ii:ops:receipt-test:"+id;
 const sorted="symb-ii:ops:watch-order-test:"+id;
 const one="synthetic-first-"+id;
 const two="synthetic-second-"+id;
 let stage:RedisStructuresStage="list-write";
 let passed=false,cleaned=false;
 try{
  // LPUSH/LTRIM/LRANGE/EXPIRE are used for short retention of review
  // receipts and non-sensitive risk-alert history. No live user key is used.
  if(await command(["LPUSH",list,"synthetic-older","synthetic-newer"])!==2)
   throw Error("Synthetic LPUSH failed.");
  stage="list-trim";
  if(await command(["LTRIM",list,0,0])!=="OK")throw Error("Synthetic LTRIM failed.");
  stage="list-read";
  const items=await command(["LRANGE",list,0,9]);
  if(!Array.isArray(items)||items.length!==1||items[0]!=="synthetic-newer")
   throw Error("Synthetic bounded LRANGE failed.");
  stage="list-retention";
  if(await command(["EXPIRE",list,30])!==1)throw Error("Synthetic list retention failed.");
  const ttl=await command(["TTL",list]);
  if(!Number.isInteger(ttl)||(ttl as number)<1||(ttl as number)>30)
   throw Error("Synthetic list expiry was not bounded.");

  // ZADD/ZSCORE/ZRANGE/ZREM are used by the watch subscription worker.
  // Do NOT mutate symb-ii:watch:members or add real wallets.
  stage="sorted-write";
  if(await command(["ZADD",sorted,10,one,20,two])!==2)
   throw Error("Synthetic watch ZADD failed.");
  stage="sorted-retention";
  if(await command(["EXPIRE",sorted,30])!==1)
   throw Error("Synthetic watch retention failed.");
  const sortedTtl=await command(["TTL",sorted]);
  if(!Number.isInteger(sortedTtl)||(sortedTtl as number)<1||(sortedTtl as number)>30)
   throw Error("Synthetic watch expiry was not bounded.");
  stage="sorted-score";
  const score=await command(["ZSCORE",sorted,one]);
  if(score!=="10"&&score!==10)throw Error("Synthetic watch ZSCORE failed.");
  stage="sorted-order";
  const ordered=await command(["ZRANGE",sorted,0,1]);
  if(!Array.isArray(ordered)||ordered.length!==2||ordered[0]!==one||ordered[1]!==two)
   throw Error("Synthetic watch ordering failed.");
  stage="sorted-remove";
  if(await command(["ZREM",sorted,one])!==1||
      await command(["ZSCORE",sorted,one])!==null)
   throw Error("Synthetic watch member removal failed.");
  passed=true;
 }catch{/* Sanitised failure is reported without keys, values or upstream details. */}
 finally{
  try{
   // Time-bounded keys are checked before accepting the drill. Early
   // Redis failures still trigger best-effort deletion. Never claim
   // acceptance if cleanup fails.
   const deleted=await command(["DEL",list,sorted]);
   cleaned=Number.isInteger(deleted)&&(deleted as number)>=0;
  }catch{cleaned=false;}
 }
 if(!cleaned)return outcome(false,"cleanup");
 return passed?outcome(true,"complete"):outcome(false,stage);
}
