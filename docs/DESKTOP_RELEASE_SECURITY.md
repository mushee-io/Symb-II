# Symb-II native release and independent execution acceptance

## What exists in GitHub
- `desktop/` is a sandboxed Electron desktop shell. No Node.js renderer access, native wallet key storage, execution IPC or auto-trading.
- `.github/workflows/desktop-build.yml` produces short-lived **unsigned internal** Windows/macOS/Linux artifacts for engineering review.
- `.github/workflows/desktop-signed-candidate.yml` is a **manually invoked** guarded workflow for **signed Windows** and **signed + Apple-notarized macOS** internal candidates. It does not create GitHub Releases or publish downloads.
- `scripts/verify-financial-boundary.mjs` fails CI if protected AI/native entrypoints add known signing, broadcasting or transaction APIs.

## Required GitHub controls before a signed candidate can run
1. Create a `desktop-release` GitHub Environment with required reviewer approval, trusted branch restrictions and appropriate secrets permissions.
2. Set repository variable `SYMB_II_DESKTOP_SIGNING_APPROVED=true` only after independent security review. This is *not* an execution toggle.
3. Supply **secrets in the protected GitHub Environment**, not in the repository or chat:
   - `SYMB_II_WINDOWS_PFX_BASE64`, `SYMB_II_WINDOWS_PFX_PASSWORD`.
   - `SYMB_II_MAC_DEVELOPER_ID_P12_BASE64`, `SYMB_II_MAC_DEVELOPER_ID_P12_PASSWORD`.
   - `SYMB_II_APPLE_ID`, `SYMB_II_APPLE_APP_PASSWORD`, `SYMB_II_APPLE_TEAM_ID`.
4. Invoke the signed candidate workflow explicitly. Windows fails if Authenticode is invalid; macOS fails if Developer ID validation or notarization/stapling fails. Output expires after seven days and **is not a public release**.
5. Verify Windows SmartScreen, Gatekeeper, wallet connectivity, permission isolation, trusted hosted origin, and native updates on actual independently controlled computers. Never call an untested, signed installer production-ready.

## Native wallet pairing
- Only the **browser-based WalletConnect QR connector** is supported when a valid **public** `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is configured. It needs real independent wallet testing in Electron: QR display, deep-link behaviour, sessions, wrong network, disconnect, replay and cleanup.
- A successful wallet connection is **not** an EOA/1271 ownership proof, a signed order, or authority to trade.
- No native wallet extension or key management is embedded. There is no native signing bridge.

## Why secure trading is still blocked
The code-level `EXECUTION_RELEASE_ENABLED=false` barrier is permanent until a future independently reviewed change. Even if all checklist fields are passed as input, no execution is unlocked.

Before a separate execution release can be considered:
- Independent audit of any Nado/Tydro transaction builder and signer, simulation and allowance rules, Web3 provider boundary and order constraints.
- Reproducible mainnet or testnet wallet-ownership, EOA/ERC-1271, ERC-20 approval/zero-reset and expiry/replay tests on real independently controlled wallets.
- Per-protocol fee, slippage, size increments, health, margin, insolvency and liquidation checks.
- Human-in-the-loop exact-signature approvals, revocable session permissions, spending caps, failure rollbacks, audit evidence and monitoring.
- Independent legal/regulatory review of the trading-agent operations and jurisdictions.

The signatures protecting *AI explanations* are one-time readable messages only. This is not an execution system or an external audit certificate.
