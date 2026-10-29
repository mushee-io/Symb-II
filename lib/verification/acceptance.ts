import type {VerificationState,WalletVerification} from "./account.ts";

/**
 * M8 acceptance is a strict operator checklist, NOT an execution authorization.
 * Public observations and client-side signatures cannot attest private protected
 * API workflows or an external security review.
 */
export type M8GateId="public-data"|"active-perp"|"active-borrow"|
 "local-wallet-signature"|"server-wallet-signature"|"protected-preflight"|"external-security-review";
export type M8AcceptanceGate={
 id:M8GateId;title:string;state:VerificationState;
 evidenceScope:"public-read"|"client-local"|"separate-operator-evidence";
 detail:string;
};
export type LocalSignatureEvidence={
 wallet:string;expiresAt:string;method:string;
};
export type ServerSignatureEvidence={wallet:string;expiresAt:string;verified:true};
export type M8Acceptance={
 kind:"m8-read-only-acceptance-matrix";wallet:string;checkedAt:string;
 gates:M8AcceptanceGate[];passed:number;failed:number;notTested:number;
 transactionEnabled:false;complete:false;
};

function requireChecks(report:WalletVerification,ids:string[]):VerificationState{
 const states=ids.map(id=>report.checks.find(x=>x.id===id)?.state??"not-tested");
 if(states.includes("fail"))return "fail";
 return states.every(s=>s==="pass")?"pass":"not-tested";
}
export function assessM8Acceptance(
 report:WalletVerification,
 proof:LocalSignatureEvidence|null=null,
 now=Date.now(),
 serverProof:ServerSignatureEvidence|null=null,
):M8Acceptance{
 const reportAt=Date.parse(report.checkedAt);
 const reportFresh=Number.isFinite(reportAt)&&reportAt<=now+5000&&now-reportAt<180000;
 const freshState=(ids:string[]):VerificationState=>
  reportFresh?requireChecks(report,ids):"fail";
 const proofExpiry=proof?Date.parse(proof.expiresAt):NaN;
 const localSigned=Boolean(proof&&proof.wallet.toLowerCase()===report.wallet.toLowerCase()&&
  Number.isFinite(proofExpiry)&&proofExpiry>now&&proofExpiry-now<=120000&&
  /^(EOA|ERC-1271)/.test(proof.method));
 const serverExpiry=serverProof?Date.parse(serverProof.expiresAt):NaN;
 const serverSigned=Boolean(serverProof&&serverProof.verified===true&&
  serverProof.wallet.toLowerCase()===report.wallet.toLowerCase()&&
  Number.isFinite(serverExpiry)&&serverExpiry>now&&serverExpiry-now<=120000);
 const gates:M8AcceptanceGate[]=[
  {id:"public-data",title:"Fresh Ink wallet and provider data",
   state:freshState(["connection","rpc","code","nado","tydro"]),
   evidenceScope:"public-read",
   detail:"Wallet address, chain and live data integrity. No ownership or trade execution is inferred."},
  {id:"active-perp",title:"Observed active Nado perpetual position",
   state:freshState(["nado-open-position","nado-position-market"]),
   evidenceScope:"public-read",
   detail:"Requires a real active position with matching product and subaccount health; not proof of executable orders."},
  {id:"active-borrow",title:"Observed Tydro variable debt and pinned Pool comparison",
   state:freshState(["tydro-variable-debt","tydro-independent-pool"]),
   evidenceScope:"public-read",
   detail:"Requires a real debt-bearing wallet and an independent block-pinned Pool/account reconciliation."},
  {id:"local-wallet-signature",title:"Optional local wallet-signature self-test",
   state:localSigned?"pass":"not-tested",
   evidenceScope:"client-local",
   detail:"A passing local EOA/ERC-1271 check is ephemeral, has no server nonce consumption, and grants no application permission."},
  {id:"server-wallet-signature",title:"One-use server-verified Ink wallet signature",
   state:serverSigned?"pass":"not-tested",evidenceScope:"client-local",
   detail:"The server returned a successful nonce-consumed EOA/deployed ERC-1271 signature check. This local display is not an independently signed receipt or reusable authenticated session."},
  {id:"protected-preflight",title:"Protected Nado/Tydro preflight acceptance",
   state:"not-tested",evidenceScope:"separate-operator-evidence",
   detail:"Operator must verify private credential-backed checks and acknowledgement replay resistance; this UI does not run those actions."},
  {id:"external-security-review",title:"Independent security review and incident drill",
   state:"not-tested",evidenceScope:"separate-operator-evidence",
   detail:"Requires independently recorded audit evidence and a controlled incident test."},
 ];
 const passed=gates.filter(x=>x.state==="pass").length;
 const failed=gates.filter(x=>x.state==="fail").length;
 return {kind:"m8-read-only-acceptance-matrix",wallet:report.wallet,checkedAt:report.checkedAt,
  gates,passed,failed,notTested:gates.length-passed-failed,
  transactionEnabled:false,complete:false};
}
