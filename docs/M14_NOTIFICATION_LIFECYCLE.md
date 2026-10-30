# M14 — Recipient possession proof, notification opt-out and data removal

M14 builds on the **M13 code-only notification queue foundation**. Neither
milestone activates email, mobile push, contact collection, durable queues
or a background sender. A successful test is not evidence of user delivery.

## Recipient possession challenges

`lib/notifications/recipient-proof.ts` defines a private,
ten-minute challenge that uses 32 bytes of Node CSPRNG entropy. A future
provider adapter will send the raw one-time token only to the selected
destination. The store must persist only a SHA-256 token digest scoped to:
- Ink wallet address, 57073
- channel (email or web-push)
- opaque private recipient reference
- subscription ID and issue/expiry timestamps

One proof may be consumed once. Invalid guesses increment a counter; three
mistakes invalidate the challenge. Wrong wallet, channel, recipient,
subscription, expired token, consumed token and malformed stored record
are all denied. A private store must **atomically compare-and-swap** the
attempt counter and consumed flag. Reading a token then writing its
consumption in separate Redis commands would permit concurrent replay.
The pure policy is deliberately not an installed verification endpoint.

Note: *a challenge token is not a wallet signature*. Recipient
verification alone never authorises a wallet subscription. The authorised
implementation must independently bind a verified Ink EOA/ERC-1271 wallet
to a specific recipient and channel, with an explicit opt-in and data
retention terms. It must prevent issuing challenges without rate limits,
recipient throttling and abuse protection.

## One-use wallet-authorised unsubscribe

`lib/notifications/revocation.ts` defines an exact canonical
opt-out-only message bound to the configured domain, Ink 57073, wallet,
subscription ID, nonce and 120-second expiry. The injected workflow
requires:

1. Atomic nonce consume **before** signature check.
2. Independently verified real Ink EOA/ERC-1271 signature, with canonical
   message and same domain, chain, wallet and selected subscription.
3. Fresh server time **after** asynchronous signature verification, so
   expiry during RPC work cannot authorise a revocation.
4. A single **atomic revoke/tombstone and delete**, coordinated with
   in-flight sender leases and purge of consent, contact mapping, queued
   jobs, recipient proof, dedupe reservations and pending delivery leases.
   An unconfirmed private-store acknowledgement is reported unavailable,
   not successful.

No signature verification implementation or Redis adapter is installed
by M14; it exposes injection interfaces to use the existing M8 pinned
RPC security flow when operator credentials, deployment and audit gates
permit. A successful opt-out grants **no trade, transfer, borrowing,
wallet delegation or spend permission**.

## User-facing truth and privacy

`GET /api/notifications/config` exposes M14 policy presence
but expressly returns all live verification/revocation fields **false**.
The Risk Watch panel already states outbound notifications are disabled.
No production contact form, unsubscribe email link, verification endpoint
or message sender is exposed. Do not ask users for email/push destinations
before channel and revocation controls are fully operational.

## Remaining live requirements

- Private, well-scoped, audited Redis records with atomic one-use tokens,
  attempt counters, signed consent and revoke/worker fencing.
- A real, provider-managed verified recipient delivery and opt-out flow,
  abuse controls, sender ID restrictions and safe token/link handling.
- Confirm provider failures, duplicate sends, revocation during a worker
  lease, deletion of contact and queue records, and retention guarantees.
- Test opt-in/out with two independent real wallets on Ink, including
  genuine deployed ERC-1271 account, and after-hours delivery behavior.
- Keep outbound delivery OFF until external security/privacy acceptance,
  production exact revision verification and operator sign-off are recorded.

Run from the reviewed commit:

```sh
npm run test
npm run typecheck
npm run build
```

The tests are adversarial *policy* tests using mock storage/verifiers and
do not establish live provider or wallet security.
