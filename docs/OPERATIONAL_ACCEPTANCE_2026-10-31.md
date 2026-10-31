# Symb-II operator activation and independent acceptance

Updated 31 October 2026. This checklist distinguishes **working public services**, **configured but untested services**, and **external requirements that no code change can certify**.

## Independently observed production services

- `/api/health` reports Ink chain ID **57073** and the exact release short SHA.
- Official Nado perpetual market snapshots and BTC-PERP top of book return non-simulated public data. Last checked on 2026-10-31 with no engine warnings.
- `/api/nado/candles?productId=2&interval=15m` returned 96 real historical BTC candles. Volume normalization converts Nado's raw x18 indexer units into base-asset units.
- Tydro Pool data returned 14 real reserves; no fabricated APYs, balances or live account positions.
- The terminal can view any explicitly entered public Ink address in **watch-only** mode. This is not wallet pairing, account authentication, a safety conclusion or authorization to spend.

## Production Vercel configuration blockers (read-only metadata audit)

As of this check the `symb-ii` Vercel project's environment variable list exposes only `CRON_SECRET`. This is an observation, not proof that other service accounts do not exist. No secret values were read.

| Service | Required operator setup | Independent acceptance |
| --- | --- | --- |
| One-use wallet proofs, rate limits, protected AI | Provision private Upstash Redis REST store; add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` **in Vercel production settings**, never in Git/chat | Protected `/api/ops/probe` Redis nonce atomicity drill, service-data drill, and replay/failure tests |
| AI-generated explanations | Set `SYMB_II_AI_ENABLED=true` only after Redis; configure AI Gateway, budget and model access. Vercel OIDC may eliminate a separate API key. An optional `AI_GATEWAY_API_KEY` can be stored privately | Independent wallet one-use signature → authenticated Nado market explanation; verify fallback, output safety and per-wallet budget limits |
| Native WalletConnect QR | Create a real Reown/WalletConnect Cloud project; set the **public** `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (32 hex) in Vercel and redeploy | Independent phone wallet: QR scan, correct Ink chain 57073, network mismatch, disconnect/reconnect, replay resistance and no transaction signing |
| Windows desktop signed installer | Protected GitHub `desktop-release` Environment; trusted Windows code-signing identity and password; operator approval | `desktop-signed-candidate.yml` Authenticode validation and real Windows launch/SmartScreen test |
| macOS signed installer | Developer ID certificate, Apple team/notarization credentials, protected GitHub `desktop-release` Environment | `desktop-signed-candidate.yml` codesign, Apple notarytool, stapler validation and Gatekeeper/device acceptance |
| Financial execution | Independent audits, signed approved order venue integrations, identity/delegation/revocation controls, simulation, user approvals and applicable legal review | Until external acceptance, `EXECUTION_RELEASE_ENABLED=false` and no automated trading, signatures, token approvals, or broadcasts |

## Safe activation order

1. Leave **transaction and execution flags disabled**. The code-level execution switch cannot be opened by a configuration-only change.
2. Provision Upstash in an operator-controlled account. Set Redis variables **directly in Vercel** without sharing passwords in chat, tickets or code. Redeploy.
3. Review the protected daily Vercel Cron `/api/ops/probe` log and confirm Redis one-use nonce atomicity + private service structures, RPC, Nado and Tydro are all `pass`. A public health response alone does not prove nonce safety.
4. Enable AI Gateway with a project budget. OIDC is supported by Vercel for production functions, but **verify a real model response** rather than assuming `VERCEL=1` is authentication. Only then enable `SYMB_II_AI_ENABLED=true` and test a controlled read-only wallet message signature.
5. Create a real WalletConnect project, add the public ID and redeploy. Test native QR pairing on a real Windows/macOS computer with a separate phone wallet. Browser-injected wallets are *not* automatically available in Electron.
6. Get human approval for code signing and install the required certificates **only in a protected GitHub Environment**. Manually invoke the signed candidate workflow and independently install/verify the resulting artifacts.
7. Commission and complete an independent trading/security and regulatory acceptance program before considering any future execution release.

**Do not infer:** “configured” means “verified”, “connected address” means “wallet ownership”, “signed app” means “audited trading agent”, or “read-only safe preflight” means “transaction approved”.

## Operator references

- Public launch status: `/workspace/readiness` and `/api/ops/readiness`.
- Private probe: `GET /api/ops/probe` via authenticated Vercel Cron, never publish `CRON_SECRET`.
- Public regression: `npm run smoke`; exact-release qualification: `npm run verify:m9:public -- <full-main-commit-sha>`.
- Account-only data and watched wallet checks must be compared independently with the official Nado and Tydro apps on the same Ink chain.
