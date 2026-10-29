# M8 server-verified wallet control — implementation and acceptance

This is **only a single, read-only wallet-control check**. It does not start a
session, authorize an AI request, sign a transaction, create an ERC-20 permit,
approve token spending, or satisfy M8 production acceptance.

## Default state and activation

The service is intentionally disabled unless both conditions are true:

1. `SYMB_II_WALLET_PROOF_ENABLED=true` is set in the Vercel production environment.
2. Valid **private** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
   credentials are configured and tested.

Never place Redis credentials in `NEXT_PUBLIC_` variables or source control.
The public `GET /api/verification/config` endpoint reports only status
and supported wallet types, never credential values. This is a configuration
check, not a successful live-connectivity test.

## Request flow

1. The connected Ink wallet requests `POST /api/verification/challenge` with
   `{"wallet":"0x..."}`. A same-origin requirement, strict body size bound,
   per-wallet throttling, and explicit feature flag apply.
2. The server constructs an exact, domain-bound 120-second message and stores
   it once in Redis under an M8-specific nonce namespace.
3. The user explicitly chooses to sign the message. This must be
   `personal_sign` only; no transaction, permit, transfer or spending approval.
4. The wallet sends `wallet`, `challengeId` and `signature` to
   `POST /api/verification/verify`. The server uses atomic Redis `GETDEL`
   before checking the exact message, its origin, Ink chain ID and signature.
5. An **EOA** signature is recovered and matched against the wallet only if the
   server's Ink RPC confirms no deployed code. A **deployed ERC-1271 contract**
   is checked by calling the wallet contract. Undeployed ERC-6492 and other
   unreviewed smart-account modes are not accepted as server signatures.
6. On success, the response only reports a short-lived self-test result,
   `serverSessionIssued:false`, `permissionGranted:false` and
   `executionEnabled:false`. There is no bearer token or credential to reuse.
   The browser does not export the signature or Redis nonce in its M8 report.

The existing local signature test remains a **separate** button; it cannot
fall back to server-verified status if protected verification is unavailable.

## Required real acceptance checks (not completed by CI)

- On a real Ink EOA, challenge, sign, verify and confirm the same challenge
  cannot be used twice.
- Use a **deployed** Ink ERC-1271 wallet, sign with its authorized owners and
  verify the contract returns the expected magic value.
- Reject wrong-wallet signatures, wrong origins, malformed oversized bodies,
  expired challenges and an unavailable Redis store.
- Observe one-use rate limits under concurrency and a 503 response when
  disabled. Confirm no signature, raw balance or sensitive credential appears
  in application logs or the copied report.
- Independently complete the Nado active-position, Tydro debt reconciliation,
  protected preflight and external security-review gates.

Never test with real funds or grant execution privileges merely to validate
this endpoint. These checks require a human-controlled wallet and live
configured infrastructure; green CI alone is not sufficient.
