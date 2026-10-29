/** A non-executable ERC-20 approval diagnostic. Never create approvals,
 * allowances or calldata here. All amounts are native-token atomic bigint.
 */
export type ApprovalDiagnosis =
 | {kind:"sufficient";remaining:bigint;required:bigint;current:bigint;missing:0n}
 | {kind:"missing";remaining:0n;required:bigint;current:bigint;missing:bigint}
 | {kind:"unknown";reason:string;required:bigint;current:null;missing:null}
 | {kind:"invalid";reason:string;required:bigint;current:bigint|null;missing:null};
export function diagnoseApproval(required:bigint,current:bigint|null):ApprovalDiagnosis{
 if(required<=0n)return {kind:"invalid",reason:"Positive exact atomic token amount required.",required,current,missing:null};
 if(current===null)return {kind:"unknown",reason:"ERC-20 allowance could not be read.",required,current:null,missing:null};
 if(current<0n)return {kind:"invalid",reason:"Invalid negative ERC-20 allowance.",required,current,missing:null};
 if(current>=required)return {kind:"sufficient",remaining:current-required,required,current,missing:0n};
 return {kind:"missing",remaining:0n,required,current,missing:required-current};
}
export type ApprovalSimulation =
 | {status:"not-required"|"unavailable"|"single-call-simulated"|"zero-reset-possible"|"blocked";
    detail:string;gasUnits:bigint|null;currentAllowance:bigint|null};
export function describeApprovalSimulation(args:{
  diagnosis:ApprovalDiagnosis;
  directSimulationPassed:boolean|null;
  zeroResetSimulationPassed:boolean|null;
  gasUnits:bigint|null;
}):ApprovalSimulation{
 const {diagnosis, directSimulationPassed, zeroResetSimulationPassed, gasUnits}=args;
 if(diagnosis.kind==="sufficient")return {status:"not-required",detail:"Existing allowance meets the inspected repayment amount; do not request additional allowance.",gasUnits:null,currentAllowance:diagnosis.current};
 if(diagnosis.kind!=="missing")return {status:"unavailable",detail:"Token allowance or debt amount is unknown; approval simulation is withheld.",gasUnits:null,currentAllowance:diagnosis.current};
 if(directSimulationPassed===true&&gasUnits!==null&&gasUnits>0n)
   return {status:"single-call-simulated",detail:"Read-only approve(pool, exactAmount) call and gas estimate succeeded at the observed state. No approval was sent.",gasUnits,currentAllowance:diagnosis.current};
 if(diagnosis.current>0n&&directSimulationPassed===false&&zeroResetSimulationPassed===true)
   return {status:"zero-reset-possible",detail:"Direct approval reverted and a read-only allowance reset-to-zero call simulated. A subsequent approval was NOT verified; never chain automatically.",gasUnits:null,currentAllowance:diagnosis.current};
 return {status:"blocked",detail:"An exact approval could not be simulated; do not assume the token supports this operation.",gasUnits:null,currentAllowance:diagnosis.current};
}
/** Screening buffer for a single gas estimate. The result excludes OP-stack
 * L1 data fees, changing base fees, wallet-specific fee handling and future
 * nonce conditions. Not a transaction quote or maximum payable gas cost.
 */
export function gasBudgetWei(gasUnits:bigint|null,maxFeePerGas:bigint|null):bigint|null{
 if(gasUnits===null||maxFeePerGas===null||gasUnits<=0n||maxFeePerGas<=0n)return null;
 return gasUnits*maxFeePerGas*150n/100n;
}
