/** Pure fail-closed incident classification. Called by operator-only probe. */
export type ProbeSummary={healthy:boolean;requiredFailures:string[];unconfigured:string[]};
export type ProbeSignal={id:string;state:"pass"|"fail"|"not-configured"};
export function summariseProbes(results:ProbeSignal[]):ProbeSummary{
 // Redis may be intentionally unconfigured, but its diagnostic record must exist.
 // An omitted record must never silently become a healthy probe.
 const required=["rpc","nado","tydro"];
 const expected=["redis","redis-services",...required];
 const byId=new Map<string,ProbeSignal>();
 for(const r of results)byId.set(r.id,r);
 const requiredFailures=results.filter(x=>x.state==="fail").map(x=>x.id);
 for(const id of required){
  if(byId.get(id)?.state!=="pass"&&!requiredFailures.includes(id))requiredFailures.push(id);
 }
 for(const id of expected){
  if(!byId.has(id)&&!requiredFailures.includes(id))requiredFailures.push(id);
 }
 // A configured Redis may not advertise healthy M7 watch/receipt storage
 // until the independent live structural drill also passed.
 if(byId.get("redis")?.state==="pass"&&byId.get("redis-services")?.state!=="pass"&&
    !requiredFailures.includes("redis-services"))
  requiredFailures.push("redis-services");
 const unconfigured=results.filter(x=>x.state==="not-configured").map(x=>x.id);
 return {healthy:requiredFailures.length===0,requiredFailures,unconfigured};
}
