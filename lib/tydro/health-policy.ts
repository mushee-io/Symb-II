/** The Aave Pool reports a null health factor when no debt exists, but
 * missing or inconsistent account evidence must NEVER be labelled safe.
 */
export type HealthObservation={
  state:"unknown"|"no-debt"|"critical"|"elevated"|"observed";
  label:string;
  display:string;
};
const decimal=/^(?:0|[1-9]\d*)(?:\.\d+)?$/;
export function observeTydroHealth(args:{
  debtBase:unknown;healthFactor:unknown;incomplete:boolean;warnings?:readonly string[];
}):HealthObservation{
 const unknown={state:"unknown",label:"Health unknown",display:"Unavailable"} as const;
 if(args.incomplete||!Array.isArray(args.warnings)||args.warnings.length>0||
    typeof args.debtBase!=="string"||!decimal.test(args.debtBase))return unknown;
 const debt=Number(args.debtBase);
 if(!Number.isFinite(debt)||debt<0)return unknown;
 if(args.healthFactor===null){
   return debt===0?{state:"no-debt",label:"No reported debt",display:"No active debt"}:unknown;
 }
 if(typeof args.healthFactor!=="string"||!decimal.test(args.healthFactor))return unknown;
 const health=Number(args.healthFactor);
 if(!Number.isFinite(health)||health<=0||debt===0)return unknown;
 return {state:health<1?"critical":health<1.5?"elevated":"observed",
  label:health<1?"Liquidation threshold breached":health<1.5?"Elevated liquidation risk":"Observed health factor",
  display:health.toFixed(3)+"×"};
}
