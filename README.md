# Symb-II

**Your AI Capital Operator for Ink.** An independent, Ink-exclusive application. **Not a decentralized exchange.**

## Current milestone: M1 — Foundation

This repository contains a responsive Next.js application with:

- An original Symb-II landing page, workspace and project roadmap
- Real Ink mainnet wallet connection through injected EIP-1193 browser wallets (e.g. MetaMask / Rabby)
- Explicit network switching to Ink and wallet disconnect
- Live Ink ETH balance inspection using on-chain JSON-RPC queries
- Ink explorer links and a truthful health endpoint (`/api/health`)
- No fabricated balances, positions, AI responses or transaction receipts
- No automatic transaction signing, custody or autonomous trading

**Not yet implemented:** Nado, Tydro, portfolio aggregation, AI agent, risk models, orders, lending transactions or notifications. The roadmap shown in the app is a plan, not production functionality.

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

- **M2:** Nado read-only connector (positions, market data and orders)
- **M3:** Tydro read-only connector (supply, loans and health)
- **M4:** Deterministic risk engine and verified portfolio aggregation
- **M5:** AI analysis grounded in actual account state and approved tools
- **M6:** Explicit user-approved transactions, complete audit trails
- **M7:** Mobile wallet connectivity, notifications, deeper responsive workflows
- **M8+:** Security-reviewed constrained automation, native apps and developer API

Do not treat upcoming milestones as deployed capabilities. No smart contracts are required for M1.

## Architecture

```text
app/                 Next.js pages, provider, styles and health endpoint
components/          Brand, navigation, wallet controls, honest preview
lib/ink.ts           Canonical chain ID, RPC and explorer
lib/wagmi.ts         Strict Ink-only wallet configuration
.github/workflows/   Typecheck and production build checks
```

## Security boundaries

- Never ask users for seed phrases or private keys.
- M1 only requests wallet connectivity and reads public on-chain data.
- The UI refuses to describe itself as executing trades or lending operations.
- Keep keys and third-party service credentials out of client bundles.
- Any future permissioned automation must have enforceable, revocable limits and separate security review.

© Symb-II. Independent project for Ink.
