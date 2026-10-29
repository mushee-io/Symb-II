import {randomBytes,randomUUID} from "node:crypto";

/**
 * Protected M7 runtime diagnostic for the exact Redis primitives used by M8
 * one-use authentication. Never returns the challenge key, value or token.
 * Inject a command executor so tests cannot be mistaken for live checks.
 */
export type RedisCommand=(args:(string|number)[])=>Promise<unknown>;
export type RedisOneUseResult={
  ok:boolean;
  stage:"set"|"ttl"|"consume"|"replay"|"cleanup"|"complete";
  detail:string;
};
const report=(ok:boolean,stage:RedisOneUseResult["stage"]):RedisOneUseResult=>({
  ok,stage,
  detail:ok?
    "Live Redis one-use SET NX EX, TTL and atomic GETDEL replay rejection confirmed.":
    "Configured Redis did not satisfy the one-use challenge integrity check.",
});

/** Only use inside a credential-protected operator route. */
export async function verifyRedisOneUse(
 command:RedisCommand,
):Promise<RedisOneUseResult>{
 const key="symb-ii:ops:one-use:"+randomUUID();
 const nonce=randomBytes(32).toString("hex");
 let stage:RedisOneUseResult["stage"]="set";
 let good=false;
 try{
  // NX ensures the synthetic challenge was newly created; EX bounds cleanup.
  if(await command(["SET",key,nonce,"EX",30,"NX"])!=="OK")
    return report(false,stage);
  stage="ttl";
  const ttl=await command(["TTL",key]);
  if(typeof ttl!=="number"||!Number.isInteger(ttl)||ttl<1||ttl>30)
    return report(false,stage);
  stage="consume";
  if(await command(["GETDEL",key])!==nonce)
    return report(false,stage);
  stage="replay";
  if(await command(["GETDEL",key])!==null)
    return report(false,stage);
  good=true;
 }catch{return report(false,stage);}
 finally{
  // Failures must never leave an unbounded value in the private store. TTL
  // provides a second line of defence if even cleanup cannot reach Redis.
  try{await command(["DEL",key]);}
  catch{good=false;stage="cleanup";}
 }
 return good?report(true,"complete"):report(false,stage);
}
