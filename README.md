# Symb-II

**Your AI Capital Operator for Ink.** An independent, Ink-exclusive application. **Not a decentralized exchange.**

## Current milestone: M4 — Protocol-specific risk intelligence (in progress)

This repository contains a responsive Next.js application with:

- An original Symb-II landing page, workspace and project roadmap
- Real Ink mainnet wallet connection through injected EIP-1193 browser wallets (e.g. MetaMask / Rabby)
- Explicit network switching to Ink and wallet disconnect
- Live Ink ETH balance inspection using on-chain JSON-RPC queries
- Ink explorer links and a truthful health endpoint (`/api/health`)
- No fabricated balances, positions, AI responses or transaction receipts
- No automatic transaction signing, custody or autonomous trading

**Milestone 2 is implemented in code:** Nado live market tickers, publicly discoverable wallet-associated subaccounts, indexed open positions, open orders and paginated order records. No order placement or signing. **Milestone 3 is implemented in code:** direct Ink mainnet Tydro reserve/rate queries and wallet-specific supply/borrowing/health views. **Not yet implemented:** cross-protocol risk, AI agent, order execution, lending transactions, mobile WalletConnect or notifications.

## Ink network

- Mainnet chain ID: **57073**
- Gas token: **ETH**
- RPC: https://rpc-gel.inkonchain.com
- Explorer: https://explorer.inkonchain.com
- Official network reference: https://docs.inkonchain.com/general/network-information

The application is restricted to Ink mainnet. No other networks or past project modules are included.

## Run locally

Node.js **22+** recommended.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open http://localhost:3000. Set `NEXT_PUBLIC_INK_RPC_URL` to a trusted Ink mainnet RPC endpoint if desired.

To validate a build:

```bash
npm run typecheck
npm run build
```

A GitHub Actions workflow runs these checks for pushes and pull requests. A successful CI run confirms compilation only, not wallet interoperability or production security.

## Wallet support

M1 uses injected EIP-1193 wallets. It works when a compatible extension/in-app browser injects a provider. **Standalone mobile WalletConnect and native iOS/Android apps are not implemented yet.** Do not claim universal mobile wallet support. No WalletConnect project ID or API keys are required for the current injected-wallet scope.

## Planned milestones

- **M2 (implemented):** Nado read-only markets, wallet-associated positions, open orders, indexed order activity
- **M3 (implemented in code):** direct Ink mainnet Tydro reserve data and wallet borrowing/health views
- **M4 (in progress):** Nado position PnL sensitivity, Tydro health scenarios and cross-protocol exposure inventory; full protocol risk simulation pending
- **M5 (initial guided preview):** source-grounded deterministic Nado/Tydro capital briefs; no generative model connected yet
- **M6:** Explicit user-approved transactions, complete audit trails
- **M7:** Mobile wallet connectivity, notifications, deeper responsive workflows
- **M8+:** Security-reviewed constrained automation, native apps and developer API

Do not treat upcoming milestones as deployed capabilities. No new smart contracts are required for M1–M3. Tydro's existing audited protocol is used read-only.

## Architecture

```text
app/                 Next.js pages, providers, health and Nado API endpoints
components/          Brand, navigation, wallet controls and live Nado panels
lib/ink.ts           Canonical chain ID, RPC and explorer
lib/wagmi.ts         Strict Ink-only wallet configuration
lib/nado/            Read-only Nado engine/indexer adapters and JSON types
lib/tydro/           Verified on-chain Tydro Pool/data-provider readers and JSON types
.github/workflows/   Typecheck and production build checks
```

## Security boundaries

- Never ask users for seed phrases or private keys.
- M1–M3 only connect wallets and inspect publicly queryable Ink, Nado and Tydro data. Nado queries do not use or store private keys.
- The UI refuses to describe itself as executing trades or lending operations.
- Keep keys and third-party service credentials out of client bundles.
- Any future permissioned automation must have enforceable, revocable limits and separate security review.

© Symb-II. Independent project for Ink.

## M2 API endpoints

- `GET /api/nado/markets` — live Nado market tickers from the official Ink mainnet indexer, refreshed every ~30 seconds in the workspace.
- `GET /api/nado/account?address=0x...` — publicly queryable Nado subaccount data, open positions, live open orders and indexed order activity. This endpoint is **read-only** and does **not** authenticate the wallet owner. Do not use it to authorise actions.

These APIs may return errors or partial data when Nado is unavailable, a wallet has no Nado subaccounts, the SDK reaches provider pagination limits, or individual sections fail. The UI surfaces those states rather than fabricating records. It initially inspects at most six cross-margin subaccounts, 100 positions and 25 indexed orders per subaccount. Further pages and more complex account handling remain improvements.

**Important:** Indexed orders are a historical indexer view, not proof that every submitted, cancelled or expired order is included. A connected wallet address is not proof that it controls a Nado subaccount. Market quotes are snapshots, not guaranteed execution prices.

Official API source: https://github.com/nadohq/nado-typescript-sdk

## M2 verification

Run `npm run typecheck` and `npm run build`, then manually verify with a wallet that has a Nado account and with an unused wallet. Confirm market timestamps, correct account isolation, empty states, pagination warnings and no signing prompt. The CI build does not by itself prove successful live Nado API responses.

## Milestone 3 — Tydro integration

Symb-II is **not** a lending pool or decentralised exchange. M3 queries Tydro's existing Pool and Aave v3-compatible PoolDataProvider on **Ink mainnet (57073)**.

- `GET /api/tydro/markets`: reads Tydro's current reserve list, per-reserve configuration, live liquidity and variable borrow APR. Exposes active/frozen flags, collateral LTV, supplied and borrowed amounts. It does **not** manufacture TVL or price-feed conversions.
- `GET /api/tydro/account?address=0x...`: reads a wallet address's protocol-level collateral, debt, current borrowing capacity, health factor, and per-asset aToken/variable debt balances, without signing.

The adapter verifies the current Pool returned by the official PoolAddressesProvider against the address pinned in the Aave address book; if different, it fails closed. Other known addresses are referenced from the same published address-book deployment:

- Pool: `0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA`
- PoolAddressesProvider: `0x4172E6aAEC070ACB31aaCE343A58c93E4C70f44D`
- PoolDataProvider: `0x96086C25d13943C80Ff9a19791a40Df6aFC08328`
- Oracle: `0x4758213271BFdC72224A7a8742dC865fC97756e1`

Source: https://github.com/aave-dao/aave-address-book/blob/main/src/ts/AaveV3InkWhitelabel.ts

Annual rates displayed as APR use on-chain ray-denominated liquidity and borrow rates; actual realized APY differs, rates vary and there are no guaranteed yields. Pool account summary values are formatted using the actual oracle `BASE_CURRENCY_UNIT()`, but deliberately labelled **oracle base units**, not a fabricated USD quote. When total debt is zero, health factor is represented as *no debt*, not an arbitrary huge number. Tydro margin and liquidation rules are independent from Nado's.

All user-address reads are publicly inspectable and **not proof of wallet ownership**. No transaction endpoints, delegate signing, keys, token approvals or fund transfers are introduced. A 502 status and UI error indicate failed contract verification or unavailable RPC, rather than invented account or market values. Individual reserve failures produce explicit partial-data warnings.

Limits: up to 32 protocol-discovered reserves; no reserve list hard-coded. Account-level lending positions are native token amounts and are not yet consolidated into a USD-denominated multi-protocol risk model. Test with a Tydro wallet and independently verify balances, current borrowing capacity and health against Tydro's own dashboard. CI compilation alone does not prove successful mainnet reads.

## Milestone 4 (initial) — Risk monitor foundations

The workspace adds a separate risk overview for each connected Ink wallet:

- Nado's official engine subaccount summary supplies **initial and maintenance health** for each discovered cross-margin subaccount. Negative maintenance health is highlighted as adverse. This is **not** an Aave-style health-factor multiplier.
- Tydro's Pool contract supplies a **health factor** with an explicit liquidation warning below 1.0 and a display-only caution band below 1.5.
- Errors and limited/paginated responses are flagged. No data is combined into a single fictitious collateral balance or liquidation threshold.
- All calculations are read-only, require zero signing or custody, and never control execution.

**Not implemented yet:** risk stress simulations, isolated-margin aggregate health, numerical capital reallocation, durable risk-alert workers, automatic liquidation protection or cross-protocol execution. Current labels are basic informational heuristics, not investment advice or a verified risk engine. Compare displayed values directly against Nado and Tydro before making financial decisions.

## M4 — Tydro single-asset sensitivity simulator (initial)

A guarded price-shock interface now lives in `/workspace#risk` for a connected Ink wallet that has Tydro debt. It uses **current on-chain** quantities and Oracle `getAssetPrice` values fetched through Tydro's verified contracts.

The calculation independently values each Tydro supplied collateral and borrowed token, applies the selected asset's parallel price shock (-50% to +50%), and adjusts the existing protocol-reported health factor by the relative movement in liquidation-weighted collateral and debt. It refuses to emit a scenario when:

- The account is in an eMode category (or the mode cannot be determined), data is incomplete or an oracle price is missing.
- The reconstructed current health factor diverges by over 2% from the contract-reported value, e.g. from unmodelled risk settings.
- The user has no outstanding debt, invalid collateral, missing positions or invalid asset/range inputs.

The model assumes fixed token balances, reserve liquidation thresholds, all other oracle prices, and no intermediate trades, price feed updates or interest accrual. It is **not a liquidation guarantee, portfolio-wide risk simulator, full Nado stress test or execution advice**. Mathematical boundary tests run in CI (`npm run test`). Test with a real active Tydro account and compare to the Tydro app before relying on it.

## M4 — Nado perpetual sensitivity and exposure inventory

The read-only `/workspace#risk` view now provides:

- **Nado linear perpetual position PnL sensitivity:** choose a real, open Nado perpetual position, then shock its matching public ticker between −50% and +50%. The model estimates the **change in quote-denominated position PnL**, not an account liquidation price, risk tier, equity or margin-health projection. It uses the Indexer market's `productId` to match the position and refuses stale/missing quotes and partial account coverage. Quote units (e.g. USDT0) are displayed explicitly, not converted into fictitious USD.
- **Protocol-separated position inventory:** a single read-only listing of Nado open position quantities and Tydro native-token supplied/borrowed amounts; validates that both sources belong to the same Ink address. It never sums unlike units or assumes transferable collateral.
- **Tests:** Nado long/short sign, zero and fractional shocks, quote-product matching, time-window/stale guards, source completeness and inventory account isolation.

Ticker prices are not guaranteed Nado margin mark prices, settlement values or execution quotes. PnL sensitivity omits funding, fees, slippage, spread, collateral, liquidation tiers and correlated exposures. Tydro simulations remain separate and subject to their own reconciliation checks. The feature does **not** trade or provide a fully verified cross-protocol risk engine.

Manual acceptance still requires a wallet with genuine Nado open perp positions and Tydro balances, plus independent comparison against the respective official protocol interfaces.

### M4 Nado coverage boundary

The Nado account API includes `positionCoverageComplete` independently of the generic `incomplete` flag. Market/position sensitivity refuses missing position pages, truncated subaccount discovery, non-retrieved cross-margin positions and isolated-subaccount omissions. Incomplete *order history alone* no longer blocks a position-only calculation. This is intentionally a per-position linear price PnL sensitivity, not a position aggregation or liquidation forecast.

## M4 — Active-tab risk watch

The workspace now evaluates Nado margin health and Tydro lending health with deterministic, independently tested alert rules (including provider errors, stale data, wrong wallet/network, incomplete Nado position coverage, invalid health readings and protocol-specific warning thresholds).

- In-app warning cards refresh when the Nado/Tydro account queries refresh while the browser tab is running.
- Browser notifications are **opt-in** and request permission only on explicit user interaction. Dedupe prevents repeated notifications for unchanged conditions; users can disable notifications.
- **No promise of 24/7 delivery.** Browser throttling, tab close, sleep, disconnection and network errors may stop updates. The alert engine does not place trades, liquidate accounts or initiate rescue actions.
- A persistent server worker, authenticated wallet subscriptions, a durable database, retries, rate limits and outgoing delivery infrastructure remain **not implemented**. Do not advertise always-on risk alerts until those components are actually operational and tested.

## M5 — Guided capital assistant (first implementation)

The new `/agent` route reads the **same** Nado and Tydro wallet-associated data as `/workspace` using the existing read-only account endpoints. It offers five user-triggered guided summaries: overview, risk, Nado positions, Tydro lending, and a cautious review checklist. Human-readable summaries retain their source timestamps, refuse mismatched networks and wallet addresses, call out stale/partial or failed feeds, and do not merge incomparable collateral or price units.

**Model status:** no generative model is configured or called; outputs come from a deterministic rule engine. This is an **agent interface and read-only analysis foundation**, not a functioning autonomous financial agent or free-form LLM. Unsupportable/transactional requests are rejected. Later work includes model-provider connections, authenticated API limits, strict tool schemas, adversarial prompt-injection testing, independent evaluation, and user-authorized execution gates. No server-side private signing credentials are used.

## M5 — Protected model explanation path (credential-gated)

The guided `/agent` page remains operational with no AI credentials. New optional model support adds:
- `GET /api/agent/config` returns **only feature flags**, no secrets;
- `POST /api/agent/challenge` returns a short-lived **Ink-only read-only wallet message** requiring an explicit personal-wallet signature (EOA support; contract wallets need separate handling);
- `POST /api/agent/explain` consumes that challenge **exactly once**, checks the signature against the wallet, uses a *private* Upstash Redis token store and atomic `SET ... NX EX` wallet rate limiter, re-fetches Nado/Tydro server-side, checks freshness, completeness, and wallet ownership, and then optionally asks Vercel AI Gateway to explain **only** a bounded deterministic account brief.
- No user-supplied price, account data, prewritten model instructions, spending authorization or arbitrary model tool arguments are accepted. The model has **no tools**.
- The model output is labelled as AI-generated and accompanied by a factual deterministic source brief. Gateway outages produce the deterministic brief instead of fabricating model success.

### Enable it deliberately

Configure these **server-side** secrets on your Vercel project (never `NEXT_PUBLIC_*`): `SYMB_II_AI_ENABLED=true`, `AI_GATEWAY_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. The Redis REST endpoint must use a TLS `.upstash.io` host. `AI_GATEWAY_API_KEY` must be provisioned with a cost budget and limited access; model is pinned in code to `openai/gpt-6-luna`. Deploy again after configuring credentials, then manually test an Ink wallet signature and check production logs/costs. Without **all** required credentials, model mode is disabled and attempts return 503; the original guided rules remain available.

**Production constraints:** rate limiting is by verified wallet, not by all visitors/IPs; challenge creation is rate-limited by wallet but should additionally add abuse/IP controls before a public model launch. One-shot wallet signatures are not trading authorization. Account reads are publicly queryable; the signed challenge controls model costs and attribution, not protocol access. No persistent chat history, portfolio write tools, automated strategies or wallet sessions are created. Perform real-wallet and adversarial testing before treating it as secure for broad public use.

## M4/M5 — Scheduled risk-watch backend (opt-in, bounded)

A **new code path**, disabled unless configured in Vercel:
- `GET /api/watch/config`: public on/off and schedule metadata.
- `POST /api/watch/challenge`: short-lived action-scoped wallet challenge (`subscribe`, `unsubscribe`, `status`). One-time message signing is required, not a token allowance.
- `POST /api/watch/manage`: consumes a Redis nonce and verifies the wallet signature; returns stored status, subscribes or immediately removes subscription plus alert history.
- `GET /api/cron/risk-watch`: `CRON_SECRET`-authenticated server-only job, scheduled once daily via `vercel.json`. The worker re-fetches Nado/Tydro, evaluates deterministic alerts and stores **only alert IDs, severity, short titles and timestamps**, not account balances, market positions or raw provider responses. A deduplicated alert-status event is stored only when the set changes. Last-checked timestamps are retained.
- Only **three least-recently-checked addresses per run** are processed to cap RPC usage/function time. More subscriptions may mean some wallets wait multiple days between readings. The Redis list stores at most 40 watch events and expires after 90 days without further writes. Unsubscribe deletes the subscription, current event list and status. Some concurrent in-flight worker races may delay deletion of a just-written event; confirm retention controls before broad public launch.

Vercel Hobby cron **cannot run more often than once per day** and the run may occur anytime during its scheduled hour. This is slow periodic diagnostic snapshotting, not 24/7 fast risk protection, liquidation rescue, guaranteed delivery or real-time monitoring. **No email, SMS, push notifications or autonomously triggered transactions** are included. Browser-active watch remains separate.

Before enabling, configure private `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SYMB_II_WATCH_ENABLED=true`, and strong random `CRON_SECRET` (16+ characters) in Vercel and redeploy. The feature is fail-closed without them; no real subscriptions are created. Exercise sign/subscribe/status/unsubscribe against a real Ink wallet, inspect Vercel cron logs and validate scheduled polling against Nado/Tydro. For actual high-frequency monitoring, use an appropriately provisioned scheduler, scalable queue and delivery service with monitored SLAs and independent security review.

## M6 Preview — Portfolio Rescue Lab (non-executable)

The connected Ink workspace now includes `/workspace#portfolio-rescue`: a **read-only decision lab** built from live Nado and Tydro account records. It deliberately DOES NOT prepare unsigned transaction payloads, submit orders, invoke token approvals, move collateral, provide execution quotes, or offer autonomous rescue.

- **Nado scenario:** select an actual, currently indexed Nado perpetual position and a live matching market reference. Apply a bounded -40% to +20% ticker move and compare linear quote-denominated PnL sensitivity before/after a hypothetical 10/25/50/75% reduction in that specific position. Validates source freshness, wallet address, product ID, position coverage and supported input ranges. Reducing size removes upside as well as downside and does not predict Nado margin health or liquidation.
- **Tydro scenario:** assuming *all existing debt assets* decreased proportionally by 10/25/50/75%, calculate a purely mathematical change to the existing Tydro-reported health factor under unchanged collateral values and protocol thresholds. Refuses missing, stale, partial, wrong-network, no-debt or eMode data. Does not estimate repaid token quantities, interest, gas, oracle movements, action feasibility or lending transaction outcomes.
- Both protocols remain independent. No shared margin is inferred; no financial recommendation is presented. Scenario values are visibly distinguished from actual account balances.
- Automated tests verify calculation math, source guards, unsupported configurations, missing markets, and refusal of stale/partial data.

**Not complete:** real-account reconciliation on Nado/Tydro, user-controlled execute proposals, per-asset repay simulation, account margin tier changes, gas estimates, preflight transaction simulations, continuous risk alarms and external security evaluation. None of the lab calculations are suitable as trading or liquidation protection guarantees.

## M6 review packets and signed acknowledgements

The Rescue Lab now offers copyable local what-if summaries and an optional server-verified receipt workflow. The backend re-reads Nado/Tydro data, reconstructs only bounded risk scenarios and creates a 120-second proposal packet pinned to the Ink chain, connected wallet, source timestamp and canonical Keccak-256 digest. The packet explicitly contains `executable:false`, `calldata:null`, `targetContract:null` and no gas or signing authority.

A user may sign a **plain-text review acknowledgement** of that exact server packet. Server verification consumes the packet atomically via Redis `GETDEL`; replay or cross-wallet signatures fail. Only the wallet, proposal digest, action, receipt ID and timestamp are stored (up to 20 receipts; 30-day expiry). This signature is **not** order authorization, a token allowance, transaction calldata, a permit or a future delegation credential. No transactions can be executed by these routes.

The authenticated receipt flow is disabled until private `SYMB_II_PROPOSALS_ENABLED=true`, `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured on Vercel. Exporting a local review summary does not need credentials. Signed receipts currently support EOA wallets only; contract-wallet verification, security review and real-wallet testing remain outstanding.

## Milestone 6 — Protocol-specific read-only preflight

A new `/workspace#preflight` panel and protected three-endpoint API distinguish *simulations and acknowledgements* from actual financial execution.

- `GET /api/preflight/config`: tells clients whether read-only checks are enabled and explicitly reports `supportsExecution:false`.
- `POST /api/preflight/check`: accepts only a strict Ink wallet and one of two bounded actions. **Tydro** checks a single existing *variable-rate* debt asset, at 10/25/50/75% of current debt, never an arbitrary user-supplied pool or amount. Re-reads the pinned on-chain Pool, wallet's reserve data, token balance, token allowance to the Pool, native ETH balance and current gas price. If prerequisites pass, uses `eth_call` (`simulateContract`) and `eth_estimateGas` for the actual `repay(asset, amount, 2, wallet)` interface. Compares a conservative ETH-fee screening buffer (gas units × observed gas price × 1.5) with wallet ETH. Strictly less-than-full-debt amounts avoid unintentionally relying on sentinel max-uint repayment semantics. A reverted simulation or missing required data blocks an acknowledgement.
- **Nado** checks Ink wallet, position discovery and current perp ticker; its execution gates are **always blocked** until real Nado authenticated order construction, tick sizes, index/mark prices, position margin constraints and protocol signing are independently implemented. No speculative Nado calldata or fake fee estimates.
- On success the backend creates a digest-locked report that includes all gate outcomes and times. It contains no transaction payload, no order, no token approval or spending instructions. A 90-second, one-use Redis entry enables a **separate plain-text preflight acknowledgement** with a wallet signature. `POST /api/preflight/acknowledge` verifies that signature against exact chain, wallet, origin, amount, asset, report digest and timestamp. It consumes the report atomically and saves only a minimal, bounded audit record for 30 days. This is independent from the earlier proposal scenario-review receipts. Neither signature is reusable for token or order execution.

Preflight is **disabled by default**: set `SYMB_II_PREFLIGHT_ENABLED=true` plus private `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel to enable the read-only checks; do not set `NEXT_PUBLIC_*` credentials. Rate limits use an atomic shared Redis store. No code path signs or broadcasts an on-chain transaction.

**Not yet delivered:** native/external wallets with contract signatures (EIP-1271), ERC20 approval transaction handling, Nado authenticated order margin simulation, independent state-root/consistent-block replay, actual EIP-1559 max-fee quotes, explicit spending execution approval, multi-step action plans, and independent production security review. Simulations are snapshots, not guarantees. Test with a real funded Ink wallet and valid Tydro variable debt and compare every result with Tydro's official app before trusting the diagnostic.

## Milestone 6 — ERC-20 approval diagnostics and EIP-1559 screening

For a specific existing **Tydro variable-rate loan**, the read-only preflight now:
- Calculates the exact atomic debt portion and checks the current allowance for the independently pinned Tydro Pool, not any caller-selected spender.
- If the exact Pool allowance is insufficient and basic protocol inputs are verified, simulates `ERC20.approve(pool, exactAmount)` using **eth_call** and estimates its gas without submitting a transaction. This is only an isolated simulation, not authorization. The app never supplies approval calldata for signing.
- Detects a possible **nonstandard zero-reset-first allowance** condition when a direct approval simulation fails against a nonzero allowance and a reset-to-zero eth_call succeeds. It reports a warning; it does not claim that both steps succeed together or automatically prepare either transaction.
- Uses the RPC's EIP-1559 `maxFeePerGas` estimate for a 1.5x gas screening buffer instead of assuming legacy gas price is a maximum. OP Stack L1 data charges, fee changes and wallet-specific costs remain excluded, so it must never be presented as a full/guaranteed quote.
- Checks network chain ID, source timestamps, a recent final block timestamp and block-number drift; these separate reads are **not atomic at one block** and are still not an execution-ready state proof.
- Includes approval findings and fee observations in the server-digested review receipt, so modifying them invalidates the one-use signed acknowledgement.

The persistent `/api/preflight/check` endpoint is **opt-in** and requires a private Redis token, a feature switch and real-wallet validation. **No ERC20 approve, allowance mutation, transaction signing, trade execution, or transaction broadcasting exists in Symb-II.** Approval diagnostics are not instructions to grant unlimited allowances.

## Milestone 6 — Pinned-block Tydro verification

The preflight verifier now calculates variable debt directly from Tydro's on-chain `getUserReserveData(asset, wallet)` using **integer atomic units**, rather than using the previously formatted account API response to calculate the action amount. The independently read account's formatted debt must reconcile within 0.1% of the pinned debt; larger discrepancies block the review. Pinned configuration decimals and the token's own `decimals()` must agree, and both the Pool and asset must have bytecode.

Allowance, token balance, native balance, provider, reserve configuration and simulations all target the chosen Ink block. It records that block's hash **before** running the reads and rechecks it afterwards to guard against a reorganization, and tests recency and block span. Gas estimates are also requested at the pinned block; EIP-1559 fee observations remain point-in-time rather than block-pinned. These findings are included in the existing cryptographic report digest and visible under Preflight.

This is a read-only diagnostic, **not** an atomic proof of cross-service consistency or guaranteed transaction outcome, and still requires a real Tydro borrower test. No execution, ERC-20 approval, delegation, transaction signing, or broadcast is introduced.
