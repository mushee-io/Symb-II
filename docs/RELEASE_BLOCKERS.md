# Symb-II: what still blocks a complete desktop trading agent

This document separates verified capabilities from operational dependencies. Completing code changes or seeing public data **does not** prove wallet ownership, live account safety, a model-generated response, secure desktop pairing or trade execution.

## Shipped and independently verifiable in public production

- Ink Mainnet chain 57073: Nado perpetual market prices, official engine bid/ask, OHLCV candles and snapshot provenance.
- Tydro verified Aave V3 Ink Pool: canonical reserve inventory, market APRs, public account supply/borrow/health observations and risk warning labels.
- Desktop-first terminal UI, account tabs, and temporary watch-only public address inspection without signatures or custody.
- Read-only lending Action Lab (supply, withdraw, borrow, repay): checks current live reserve state, exact decimal amount, wallet-associated on-chain account context and missing simulation requirements. **Always returns blocked; never signs or broadcasts.**
- Fail-closed Tydro health classification: unavailable health factor with nonzero or uncertain debt is **unknown**, not “no debt”.
- Explicitly locked spending and trade execution: `EXECUTION_RELEASE_ENABLED=false`.

## Remaining operational dependencies

| Capability | Code foundation | Still needed to verify operational |
| --- | --- | --- |
| Live model-generated analysis | One-use wallet signature and read-only Nado evidence-backed model endpoint | Provision Upstash Redis, test nonce atomicity and replay; configure/authorize AI Gateway with a budget; enable the protected feature flag; test real EOA/ERC-1271 signatures, provider failures and output quality |
| Native desktop wallet pairing | WalletConnect QR connector supported when configured; watch-only mode needs no QR | Actual public Reown Project ID in Vercel; real mobile wallet/native Windows/macOS QR pairing and disconnect/reconnect tests; no Electron wallet-extension or signing bridge exists |
| Signed distributable Windows/macOS installers | Protected manual GitHub signing workflow plus unsigned platform build CI | Real protected signing certificates, approved GitHub environment, Apple notarization, independent device/SmartScreen/Gatekeeper and update verification |
| Nado execution | Read-only positions, quote data and reduce-only preflight available | Exchange-specific credentialed signing, account controls, authoritative order constraints, fee/slippage/margin checks, explicit user-approval and exact trade receipt, independent security acceptance |
| Tydro supply / withdraw / borrow / repay | Live Pool/account read, read-only action drafts, partial variable-debt repay eth_call preflight | All four action-specific calldata paths and exact pinned-block simulations; ERC-20 allowance/balance/gas checks; health/LTV/eMode/cap/oracle and debt-mode checks; real wallet approvals and independent audit |
| Autonomous agent execution | Deterministic drafts and risk monitoring | Revocable granular session permissions, caps, expiry, protected risk controls, live monitoring, independent security/regulatory approval; **remain disabled** |
| Private monitoring and signed watch alerts | Redis-backed feature code and protected probes | Upstash credentials, authenticated worker drills, real alert delivery provider and consent/revocation acceptance |
| Full native product acceptance | Electron shell exists, unsigned build jobs have passed | Device-tested app + wallet pairing + app update/signing verification + penetration test; **no public installer claims** |

## Operator actions — never paste secrets into chat

1. Add an Upstash Redis REST endpoint and token to the Vercel production environment, redeploy, and run the protected one-time nonce and replay drills. Operator access is required.
2. Configure AI Gateway via an operator-controlled account, set limits, and run a **real signed** AI request. Only enable model flag after protected service tests pass.
3. Obtain a Reown WalletConnect Project ID; set the public project ID in Vercel, redeploy and test a separate real wallet inside the **native Electron app**.
4. Protect GitHub `desktop-release` Environment and provision licensed code-signing/Apple notarization identities there. Manually execute candidate builds and independent OS install validation.
5. Commission independent security and compliance review; implement and verify per-venue simulations and granular user-approved transaction flows **before** changing any execution release gate.

## Acceptance references

- `/workspace/terminal` for public market and watch-only account data.
- `/workspace/actions` for non-executable Tydro lending drafts.
- `/workspace/readiness` for current configuration gate metadata, **not** proof of live provider credentials.
- GitHub Build, Desktop build and Production acceptance workflows are regression checks. Only independent wallet/installer/audit evidence can close the release gates.

These tasks have not been silently marked complete.
