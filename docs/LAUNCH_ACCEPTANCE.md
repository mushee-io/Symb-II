# Symb-II — remaining live milestone acceptance (Ink 57073)

**Scope:** This document distinguishes merged source code and successful public
production smoke from **operational** or **security-accepted** functionality.
Run these steps only as an authorized project operator. Never ask anyone for a
seed phrase; never paste a private key or bearer token into chat or source.

## Current verified baseline

- Application: `https://symb-ii.vercel.app`, source: `mushee-io/Symb-II`.
- M1–M3: read-only wallet, Nado and Tydro integrations implemented.
- M4: protocol-specific risk views, read-only scenarios and alerts implemented.
  Real, independently reconciled account acceptance still required.
- M5: deterministic, source-grounded guided assistant implemented. Optional
  model path is fail-closed until its own private infrastructure is activated.
- M6: real permissioned transactions and audited execution **not ready**.
  Read-only rescue previews/preflight must never be called execution.
- M7: public incident detection, protected probes, monitoring/storage code and
  feature-level switches implemented. **Live Redis and protected service
  activation not verified.**
- M8: independent public block verification, time-bounded signatures and
  read-only wallet/protocol acceptance lab implemented. **Real Ink wallet,
  nonces, active positions, debt and external security audit remain.**
- M8+: native apps, expanded mobile support and developer-facing API not
  operational; they are separate future scope.

## Gate A — protected infrastructure and model activation (M5/M7)

Requires project-owner access and a reviewed billing/security plan.

1. Provision a private TLS Upstash Redis database and connect the encrypted,
   server-only `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
   environment variables to Vercel **production**. Verify the production
   deployment has picked up the values by redeploying.
2. With all protected feature flags disabled, use a locally checked-out,
   current production commit and a trusted process-secret injection method to
   run `npm run verify:m7:redis`. The CLI requires exact-release matching,
   live provider probes, one-use Redis nonce operations and Redis data-
   structure drills. Do not expose `CRON_SECRET` in shell history/logs.
3. Test *each* service privately before enabling its flag. Model activation
   additionally needs AI Gateway credentials or verified Vercel OIDC and
   bounded billing, request-cost monitoring and prompt-injection testing.
   Do not claim AI is live merely because the deterministic assistant works.
4. Watch activation needs a tested subscription, unsubscription, durable
   retention, cron iteration, failure/retry behavior and delivery solution.
   Browser notifications alone are **not reliable background alerting**.

**Acceptance evidence:** isolated live probe outcome with exact deployment SHA;
wallet-scoped rate-limit and replay drill; operator-reviewed logs; documented
cost controls; live response samples without secrets; incident recovery test.
A passed unit test is not equivalent.

## Gate B — real-wallet and protocol acceptance (M8)

Only use wallets you actually control or have permission to test.

1. Run the wallet verification lab with a genuine connected Ink EOA. Record a
   successful personal-sign challenge and *rejected replay* of the same
   challenge against the production server endpoint.
2. Repeat with a deployed ERC-1271 smart account and an authorized owner. Check
   invalid owner, wrong chain, wrong origin, concurrent replay, expiry during
   RPC verification, unavailable Redis, and no session/permission issuance.
3. Test an actual open Nado perpetual cross-margin account and compare product
   IDs, symbols, margin, position inventory and timestamp against the official
   interface. Distinguish account-associated public data from owner proof.
4. Test a real variable-debt Tydro wallet. Compare reserve-by-reserve debt,
   health and the pinned Pool read at a common block. Reject zero-debt or
   cross-network fixtures as a successful active-borrow acceptance.
5. Export a fresh public-block evidence JSON from the lab and run
   `npm run verify:m8:evidence -- <local-evidence-file>` with an
   operator-selected independent Ink RPC. Keep the report local because it
   includes a public wallet address and activity metadata.

**Acceptance evidence:** date, Ink wallet type, exact release SHA, sanitized
result for each challenge/negative test, independent provider name, matching
public block reference and recorded protocol comparison. No private keys,
raw signatures, secret tokens or balances in public CI artifacts.

## Gate C — preflight and protected scenarios (M7/M8)

Enable protected read-only preflight only after Gate A; use one-time human
acknowledgement and replay tests with current Ink wallet state. Verify failing
allowance/gas/chain/price/TTL/quota conditions reject positive review;
compare Nado SDK limits and Tydro Pool reads; re-run with expired snapshots.
Store only redacted, short-lived receipts with safe retention.

This gate **never** authorizes transaction payload construction or signing.

## Gate D — independent security review (M6/M8)

Obtain external, independent adversarial review of:
- ERC-1271/EOA verification, nonce TTLs, concurrency and Redis failures
- server auth, origin controls, rate limits, request sizes and secret handling
- Nado/Tydro provider provenance, stale data and calculation precision
- incident alert workflows and durable data deletion
- any future permissioned execution, approvals, revocations and fund controls

Fix and re-test findings, record sign-off and restore a known-good deployment.
Before implementing M6 execution, define risk limits, permitted transaction
scope, wallet user-approval flow, receipts, cancellation/revocation, and
deployment/contract audit boundaries. Automated order placement and debt
repayment remain out of scope until these are independently reviewed and
explicitly authorized.

## What code and public CI can certify today

TypeScript, automated adversarial fixtures, the production build and twelve
safe public production acceptance checks certify the deployed **read-only**
release only. They cannot certify a real wallet, proprietary provider behavior,
Upstash, AI cost/budget controls, actual portfolio positions or independent
security assurance. If a gate is not backed by contemporaneous live evidence,
its status is **not accepted**—do not relabel it complete.
