# Symb-II

**Your AI Capital Operator for Ink.** An independent, Ink-exclusive application. **Not a decentralized exchange.**

## Current milestone: M2 — Nado read-only integration

This repository contains a responsive Next.js application with:

- An original Symb-II landing page, workspace and project roadmap
- Real Ink mainnet wallet connection through injected EIP-1193 browser wallets (e.g. MetaMask / Rabby)
- Explicit network switching to Ink and wallet disconnect
- Live Ink ETH balance inspection using on-chain JSON-RPC queries
- Ink explorer links and a truthful health endpoint (`/api/health`)
- No fabricated balances, positions, AI responses or transaction receipts
- No automatic transaction signing, custody or autonomous trading

**Milestone 2 is implemented in code:** Nado live market tickers, publicly discoverable wallet-associated subaccounts, indexed open positions, open orders and paginated order records. No order placement or signing. **Not yet implemented:** Tydro, cross-protocol risk, AI agent, order execution, lending transactions, mobile WalletConnect or notifications.

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
- **M3:** Tydro read-only connector (supply, loans and health)
- **M4:** Deterministic risk engine and verified portfolio aggregation
- **M5:** AI analysis grounded in actual account state and approved tools
- **M6:** Explicit user-approved transactions, complete audit trails
- **M7:** Mobile wallet connectivity, notifications, deeper responsive workflows
- **M8+:** Security-reviewed constrained automation, native apps and developer API

Do not treat upcoming milestones as deployed capabilities. No smart contracts are required for M1 or M2.

## Architecture

```text
app/                 Next.js pages, providers, health and Nado API endpoints
components/          Brand, navigation, wallet controls and live Nado panels
lib/ink.ts           Canonical chain ID, RPC and explorer
lib/wagmi.ts         Strict Ink-only wallet configuration
lib/nado/            Read-only Nado engine/indexer adapters and JSON types
.github/workflows/   Typecheck and production build checks
```

## Security boundaries

- Never ask users for seed phrases or private keys.
- M1 and M2 only connect wallets and inspect publicly queryable Ink and Nado data. Nado queries do not use or store private keys.
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
