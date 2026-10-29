import "server-only";

type RedisResponse = { result?: unknown; error?: string };
function config() {
  const raw=process.env.UPSTASH_REDIS_REST_URL;
  const token=process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!raw||!token)throw Error("AI security store is not configured.");
  const url=new URL(raw);
  // Bound the service to an intentional TLS-only Upstash credential destination.
  if(url.protocol!=="https:"||!url.hostname.endsWith(".upstash.io")||
    url.username||url.password||url.port||url.pathname!=="/")
    throw Error("Invalid Upstash security-store endpoint.");
  return {url:url.origin,token};
}
export async function redis(command:(string|number)[]):Promise<unknown>{
  const {url,token}=config();
  const response=await fetch(url,{
    method:"POST",
    headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify(command),
    cache:"no-store",
    signal:AbortSignal.timeout(5000),
  });
  if(!response.ok)throw Error("Security store request failed.");
  const result=await response.json() as RedisResponse;
  if(result.error)throw Error("Security store command failed.");
  return result.result;
}
export async function acquireLimit(key:string,seconds:number):Promise<boolean>{
  return await redis(["SET","symb-ii:limit:"+key,"1","EX",seconds,"NX"])==="OK";
}
export async function createNonce(id:string,value:string):Promise<void>{
  if(await redis(["SET","symb-ii:nonce:"+id,value,"EX",120,"NX"])!=="OK")
    throw Error("Could not create challenge.");
}
export async function consumeNonce(id:string):Promise<string|null>{
  const value=await redis(["GETDEL","symb-ii:nonce:"+id]);
  return typeof value==="string"?value:null;
}
