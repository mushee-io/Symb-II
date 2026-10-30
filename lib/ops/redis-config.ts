/**
 * Shared TLS-only Upstash REST endpoint validation for both public
 * configuration readiness and private Redis command dispatch.
 * Never include the token in a URL, response, log or browser bundle.
 */
export function validatedUpstashOrigin(raw:unknown):string|null{
 if(typeof raw!=="string"||!raw||raw!==raw.trim())return null;
 try{
  const url=new URL(raw);
  if(url.protocol!=="https:"||!url.hostname.endsWith(".upstash.io")||
    url.hostname===".upstash.io"||url.username||url.password||url.port||
    (url.pathname!=="/"&&url.pathname!=="")||url.search||url.hash)
   return null;
  return url.origin;
 }catch{return null;}
}

export function hasValidRedisConfiguration(env:NodeJS.ProcessEnv=process.env):boolean{
 const token=env.UPSTASH_REDIS_REST_TOKEN;
 return validatedUpstashOrigin(env.UPSTASH_REDIS_REST_URL)!==null&&
  typeof token==="string"&&token.trim().length>0;
}
