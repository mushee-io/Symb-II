# M9 — Read-only release qualification and public-beta evidence

M9 is the next **proposed** milestone for Symb-II. The original README's M4 heading is legacy; the M7/M8 security and infrastructure code is newer. This milestone is deliberately a release/operational qualification layer **not** a new trading, borrowing or automated execution feature.

## M9 phase 1 (implemented in this PR)

A deterministic fail-closed public precheck assesses an **expected full Git commit** against independently fetched production `/api/health` and `/api/ops/readiness`, five safe route configs, public Nado markets, and canonical Tydro reserves. It detects contradictory claims such as execution, transaction permissions, reusable wallet sessions, or outbound watch delivery. It does not require keys or sign a wallet request.

From an up-to-date local checkout of the commit you want to release:

```sh
npm run typecheck
npm run test
npm run build
npm run verify:m9:public -- "$(git rev-parse HEAD)"
```

By default the precheck targets `https://symb-ii.vercel.app`. `SMOKE_URL` is accepted only as an HTTPS origin with no URL credentials, query, path or fragment. Reads use GET, disallow redirects and have finite timeouts and response-size bounds. No cookies, Upstash tokens, `CRON_SECRET`, keys, wallet signatures or user account data are sent. The CLI prints only generic gate results and the expected revision prefix.

The CLI exits with an error if any of its **three** public checks fail:

1. Exact production SHA as reported by both public responses, with Ink chain ID 57073.
2. Explicit non-execution contract of the readiness, preflight, proposal, agent, watch and wallet-verification responses.
3. Public Nado perpetual tickers and bounded, complete Tydro reserves from the canonical Ink Pool.

A passing CLI exit means **public precheck passed, not M9 or mainnet launch accepted**. Even a fully configured Redis is only `not-tested` without the authenticated live drill. All non-public checks remain `not-tested` or `blocked` in this public-only report. `releaseQualified`, `readyForPublicBeta`, and `executionEnabled` are **always false** by construction. This intentional limitation prevents a green build, spoofed evidence JSON, or an unauthenticated HTTP check from being promoted to a trading permission.

## M9 remaining acceptance gates

- **M7 private Redis:** provision valid Upstash credentials, run the existing protected one-use and service-structure probes on the *exact deployed revision*, then test services one by one. Leave private flags disabled until live acceptance.
- **M8 wallet and provider:** real EOA and ERC-1271 signatures, active Nado perpetual and Tydro borrower account reconciliations, independently controlled Ink RPC evidence, protected preflight/replay failure tests, and current block/timestamp checks.
- **Mobile:** prove standalone mobile wallet interoperability and disconnection/network-switch behavior on supported devices; injected desktop extension coverage alone is insufficient.
- **Notifications:** if outbound alerts are promised, implement tested opt-in delivery, revocation, idempotency, retries, abuse limits, operator paging and retention controls. Existing active-tab or daily watch snapshots are **not** delivery proof.
- **Security and incidents:** independent security review, finding remediation, scheduled-monitor failure/recovery exercise, credential rotation and incident response sign-off.

No single automated script can establish genuine wallet ownership, upstream financial state correctness, external auditor independence or production operational sign-off. Keep the product read-only until separate M6 permissioned execution design and audits are completed.

## Failure reporting

A failed precheck is never worked around by substituting the live SHA as the expected input. Resolve deployment lag/drift, invalid network, unexpected route permissions or upstream feed failure, then rerun against the genuine intended main-branch commit. Preserve only redacted output for incident follow-up; do not upload wallet exports or secrets to GitHub issues.
