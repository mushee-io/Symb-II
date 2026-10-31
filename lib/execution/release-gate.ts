/** One-way public release barrier.
 * Code-level readiness metadata cannot replace a third-party audit, a
 * transaction simulation, verified wallet permissions or a signed release.
 *
 * This module has no wallet, provider, transaction, signing or broadcast APIs.
 */
export const EXECUTION_RELEASE_ENABLED=false as const;
export type IndependentAcceptance={
 externalAuditAccepted:boolean;
 criticalFindingsResolved:boolean;
 realWalletE2EAccepted:boolean;
 revocationVerified:boolean;
 perVenueSimulationAccepted:boolean;
 legalComplianceReviewed:boolean;
};
export function describeExecutionRelease(acceptance:Partial<IndependentAcceptance>={}){
 const criteria=[
  ["Independent external audit",acceptance.externalAuditAccepted===true],
  ["All critical and high security findings resolved",acceptance.criticalFindingsResolved===true],
  ["Independent wallet end-to-end tests",acceptance.realWalletE2EAccepted===true],
  ["Spending and delegation revocation verified",acceptance.revocationVerified===true],
  ["Nado/Tydro per-venue simulation and signing review",acceptance.perVenueSimulationAccepted===true],
  ["Legal and financial-service compliance reviewed",acceptance.legalComplianceReviewed===true],
 ] as const;
 return {
  executionEnabled:EXECUTION_RELEASE_ENABLED,
  releaseState:"blocked" as const,
  independentlyAudited:false as const,
  requirements:criteria.map(([name,supplied])=>({name,claimSupplied:supplied,verifiedLive:false})),
  note:"Even supplying checklists never unlocks execution. A separate reviewed release with independently validated proofs is required.",
 };
}
