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
