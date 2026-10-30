# M8 — Clipboard evidence and independently pinned Ink blocks

This companion runbook covers the exact browser export consumed by
`npm run verify:m8:evidence`. It does **not** require Redis, a transaction or
private wallet key; it is not a wallet ownership or protocol-position audit.

## Export schema compatibility

`components/wallet-verification.tsx` uses the read-only
`assessWalletVerification` assessment and attaches
`assessM8Acceptance` plus optional local/server self-test metadata.

`tests/m8-browser-export-compat.test.mjs` generates a report with that
**same assessor and matrix**, serializes it as clipboard JSON, and passes it
through `validateM8PublicEvidence` and the independent block verifier.
This prevents a hand-written JSON test fixture from masking a broken
browser-to-operator workflow.

The offline validator requires exact Ink 57073, public wallet address, a
recent timestamp, a passing independently observed RPC check, matching
source-labelled block references, explicit non-executability and an
incomplete M8 acceptance matrix. When browser summary counters are present,
they must match actual check states. Optional self-test metadata cannot
claim permission, reusable server sessions or independently signed
receipts; the matrix wallet and timestamp must match the export.

## Same-height reorg and expiration checks

For every public Ink reference, the operator tool:

1. Reads chain ID 57073 using an **operator-selected independent provider**.
2. Retrieves the reported block height and checks its full hash, height
   and recent timestamp.
3. Re-reads the **same** height and requires the same hash and freshness.
   If the provider observed a reorg between reads, acceptance is rejected.
4. Rechecks chain ID after all references.
5. Samples the clock again and rejects an evidence report that expired
   during RPC reads, including clock rollback/nonfinite-time failures.

The CLI does not include wallet addresses, private keys, raw protocol
balances or signature bytes in its output. Do not publish saved reports
to a public issue tracker: a redacted report still includes the public
wallet address and contextual metadata.

Comparing two RPC reads at one height is an extra consistency check,
**not a consensus-finality guarantee** or a signature that ties the wallet
or Nado/Tydro balance data to the block. A malicious provider can still
lie; the operator must assess independent provider control and relevance.

## Outstanding live evidence

- Actual connected Ink EOA and deployed ERC-1271 signatures
- Fresh active Nado perpetual account cross-check
- Real Tydro variable debt and independent pinned Pool reconciliation
- Live protected Redis-backed preflight and replay test
- External adversarial security assessment

No step here enables wallet sessions, gas spending, order execution,
approvals or token transfers.

## Nado position data-integrity hardening

The account reconciliation now requires **both** the market product ID and
its engine/indexer ticker label to agree for every reported open cross-margin
perpetual position. Unknown `Product #...` fallback labels cannot pass.
The position's entry price must be a positive finite decimal, and the unique
subaccount health observation must contain finite maintenance/initial health,
nonnegative finite assets and nonnegative finite liabilities.

Negative maintenance/initial health is permitted: an underwater account is
risky but should not be discarded as malformed. These checks are designed to
distinguish a *complete reported data set* from missing or contradictory
source fields. They do not declare that any position is safe or liquidatable.

**Source limitation:** Nado positions and tickers are queried from Nado's
indexer/engine API family. Comparing them is an internal consistency check,
not an independently verified settlement record or permission to trade.
Active position results still require a genuine connected account and a
separate operator acceptance test before being treated as production-proof
evidence. No execution or wallet authorization is enabled.

## Tydro reserve inventory and snapshot skew

The read-only active-borrow assessment now validates every returned Tydro
user reserve before accepting account completeness or a positive
variable-debt observation. Addresses must be valid, nonduplicated Ink
asset addresses; decimal precision and liquidation parameters must remain
within reviewed bounds; underlying balance/debt amounts, oracle prices
and collateral flags must have their expected safe types. More than
32 reserve entries fails closed rather than silently truncating exposure.

Independently queried Tydro adapter and pinned Pool observations are
also checked for **timestamp skew**. Even if each observation is younger
than 180 seconds, two reads that are more than 60 seconds apart cannot
be called reconciled. The browser makes these inspections in parallel;
a delayed or unavailable endpoint must not be disguised as a live
match.

A failing reserve row is classified as failed data integrity, not a
live-borrow acceptance. Empty reserves remain structurally valid but
do not prove active borrowing. This is snapshot consistency, not
repayment, transaction execution, wallet ownership or consensus finality.
