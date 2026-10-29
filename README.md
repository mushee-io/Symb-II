# Symb-II

**Your AI Capital Operator for Ink.** An independent, Ink-exclusive application. **Not a decentralized exchange.**

## Current milestone: M3 — Tydro on-chain read-only integration

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
- **M4:** Deterministic risk engine and verified portfolio aggregation
- **M5:** AI analysis grounded in actual account state and approved tools
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
