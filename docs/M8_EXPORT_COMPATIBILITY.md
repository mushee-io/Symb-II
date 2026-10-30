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

## Protected Tydro preflight source integrity and end-of-RPC freshness

The read-only preflight previously compared a pinned contract variable debt
against an account adapter response, but its source gates did not explicitly
reject a market feed reporting another Pool/chain, duplicated target asset,
mismatched market/user-reserve decimals, or independently fresh source reads
that were too far apart in time.

`assessTydroPreflightSources` now fails closed unless the inspected wallet,
Ink chain 57073, pinned Tydro Pool, unique user/market reserve inventory,
asset symbol and precision, coverage and snapshot timestamps agree. User and
market reads must each be under 90 seconds old and at most 60 seconds apart.
No real balance is accepted merely because the request names a valid token.

A separate final check repeats source freshness **after** the potentially slow
eth_call and gas-estimation work, and the RPC chain ID is rechecked at that
point. Both checks are mandatory gates before
`readyForHumanReview` can ever become true. This remains only a review
snapshot, not proof of an executable repayment or spend authorization.

`blockEvidence` now requires actual 32-byte hexadecimal start/recheck block
hashes, ordered positive block timestamps, and a bounded monotonic block span.
Arbitrary nonempty hash strings no longer satisfy pinned-block integrity.
Adversarial unit tests cover wrong wallet, Pool/chain, duplicated target
assets, stale reads, malformed reserve metadata, and invalid block headers.

No Redis-dependent service has been enabled. This work does not replace
real-wallet validation, independently operated live-RPC checks, transaction
simulation acceptance, or external security audit.

## M8 risk-alert failure modes: no silent healthy readings

The read-only risk feed now detects conflicting Nado subaccount-health
inventories. Duplicate names, unrelated health records, missing
`exists:true` readings and warnings from the Nado adapter become explicit
warnings. Every duplicate observation is still checked for adverse maintenance
health; the most severe alert is retained rather than letting the first
positive record suppress a later negative one.

For Tydro, a missing health factor is expected for an account with **zero**
debt. If the account reports positive debt (or debt cannot be decoded), a
missing health factor instead emits an **unknown borrower health** warning.
Malformed debt amounts, contradictions between zero debt and a populated
health factor, and invalid reserve inventory rows emit diagnostic warnings
even when another field appears reassuring.

These are display-only alerts on short-lived provider snapshots. They do
not change a position, borrow, repay, set permissions, send a notification,
or establish that an account is liquidatable. Live operator testing and
upstream provider provenance still matter; no Upstash credentials are needed
to test the pure alert policy.

## Nado preflight now shares wallet position integrity gates

The Nado read-only preflight now uses `crosscheckNadoPositions`, the same
position/ticker/subaccount health policy used by the Wallet Verification Lab.
The earlier diagnostic could report an exact product mapping merely because
the product ID agreed, and could call the engine's hypothetical reduce-only
maximum even when the associated position symbol or health figures disagreed.

To request **only a read-only engine maximum**, the wallet, chain, position
coverage, unique position, complete portfolio reconciliation, ticker symbol,
health fields, engine chain/endpoint, market increments, bid/ask spread,
price divergence, engine warnings and all source timestamps must be
consistent. Account/indexer/engine observations must be under 90 seconds old
and no more than 60 seconds apart.

When the separate engine size query completes, preflight recalculates
source freshness. If the original account, market or engine snapshot has
expired during the asynchronous query, the hypothetical size is discarded
and the corresponding evidence gate fails or becomes unknown. Such a
read cannot silently recover by reusing previous positive diagnostics.

This still uses Nado API-family sources rather than independent settlement
verification. Even when every **data diagnostic** passes, the explicit
`Authenticated order and execution constraints` gate remains **FAIL**.
The report is review-only, has no transaction payload and cannot grant
trading permissions. No Upstash, operator secret or live wallet is required
for the deterministic regression tests.

## Cross-protocol exposure inventory must not mistake missing data for zero exposure

The combined Nado/Tydro read-only inventory validates **same Ink 57073
wallet**, correctly formed source addresses, both account snapshot times,
and an upper bound of 60 seconds of source skew. Either snapshot older
than three minutes, in the future beyond the small RPC tolerance, or
missing its timestamp results in **withheld rows and a visible warning**,
not an empty or reassuring portfolio.

Every Nado position row must have a unique subaccount/product/position
identity, a valid cross-margin side, known symbol and positive finite
size and entry price. Duplicate or missing user reserves, invalid token
addresses, negative debt amounts and malformed Tydro reserve metadata
also cause the entire cross-protocol inventory to be withheld. Provider
warnings, partial Nado position discovery and missing subaccount health
do not invalidate otherwise well-formed displayed rows but explicitly
mark the inventory **incomplete**. If more than 60 rows exist, the
display is explicitly truncated and never called complete.

The interface now distinguishes genuinely empty, complete observations
from data withheld or partially observed because of integrity failures.
The UI also avoids implying that merely providing a wallet address
authenticates ownership.

These checks do not establish valuation, margin aggregation, on-chain
finality, wallet ownership, executable repayments or Nado order
authorization. They do not depend on Redis or change production flags.
