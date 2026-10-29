/** Pure fail-closed incident classification. Called by operator-only probe. */
export type ProbeSummary={healthy:boolean;requiredFailures:string[];unconfigured:string[]};
export type ProbeSignal={id:string;state:"pass"|"fail"|"not-configured"};
export function summariseProbes(results:ProbeSignal[]):ProbeSummary{
 const required=["rpc","nado","tydro"];
 const byId=new Map<string,ProbeSignal>();
 for(const r of results)byId.set(r.id,r);
 const requiredFailures=results.filter(x=>x.state==="fail").map(x=>x.id);
 for(const id of required){
  if(byId.get(id)?.state!=="pass"&&!requiredFailures.includes(id))requiredFailures.push(id);
 }
 const unconfigured=results.filter(x=>x.state==="not-configured").map(x=>x.id);
 return {healthy:requiredFailures.length===0,requiredFailures,unconfigured};
}
