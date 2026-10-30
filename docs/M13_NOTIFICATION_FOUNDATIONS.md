# M13 — Opt-in risk notification delivery foundations

Symb-II remains an Ink 57073 **read-only** capital workspace. M13 creates
deterministic, testable queue and delivery policy **without sending anything**.

## Code implemented

- New `GET /api/notifications/config` truthfully reports
  `deliveryEnabled:false`, `notificationsDelivered:false`,
  `verifiedConsentStore:false`, and `executionEnabled:false`.
- `lib/notifications/policy.ts` validates a distinct M13
  `purpose:risk-notifications` consent record, correct Ink wallet,
  verified recipient timestamp, opt-in channel, expiry, revocation, and opaque
  recipient reference. Existing M7 signed wallet-watch consent is insufficient.
  This policy does **not** verify a wallet signature or recipient possession:
  future callers must fetch a record from an independently verified private
  consent service before accepting it as trusted.
- Fresh, bounded Nado/Tydro warning events can become generic notification
  jobs without raw wallet addresses, email addresses, mobile push endpoints,
  balances, positions, source details or unsigned message text. No
  automated "your portfolio is safe" or liquidation rescue claims.
- Deduplication uses a fixed alert ID/severity fingerprint and a proposed
  30-minute per-recipient/channel cooldown. The actual dedupe reservation
  **must be atomic in a future private store**; the code-only policy and
  interface do not provide durable storage.
- Queue attempts use 1, 5, 15, then 60 minute backoffs, at most five attempts,
  no later than 24 hours after creation, and explicit terminal states. Unknown
  provider outcomes reuse the original idempotency key. An accepted provider
  receipt is **not** confirmation an email/device received the alert.
- `lib/notifications/delivery-ports.ts` defines isolated,
  injectable queue and transport contracts with lease/CAS coordination,
  post-claim consent rechecks, and disabled-by-default integration. The
  existing watch cron does not call this module and no provider is configured.
- The Risk Watch UI explains that monitoring opt-in is NOT consent for email
  or mobile push. No address-collection form is exposed prematurely.

## Before any live enablement

1. An authorised operator provisions private Upstash credentials and passes
   M7 structure/replay drills on the **exact deployed commit**.
2. Implement a separate, one-use, wallet-signed *delivery* subscription,
   independent contact verification, and atomic revoke/delete flows. Bind
   recipient references to authenticated owner records, use retention limits,
   and avoid secret tokens and contact data in telemetry.
3. Supply a real provider adapter supporting idempotency and typed receipts.
   Add a durable atomic queue with lease ownership, concurrent revocation
   coordination, dead-letter inspection without PII, and a genuine worker.
4. Test concurrent enqueue/revoke/send races, provider crash/timeouts,
   replay, fake recipients, injection, delayed responses, resend, and rate
   limits in a controlled environment.
5. Independently verify an actual opt-in and opt-out from two devices; record
   *provider acceptance* separately from end-user delivery. Test outages and
   recovery and obtain external security review.
6. Confirm production deployment exact SHA, Vercel worker and real transport
   credentials. Sign off privacy and user-facing disclosures before promising
   any email/push notification frequency or reliability.

## Explicit non-goals

This code phase does **not** ship a notification service, delivery worker,
stored subscription, contact list, push token, email provider, Upstash,
production webhook or emergency liquidation protection. Do not enable
transaction signing, automatic trades, transfers or lending operations.

Run `npm run test`, `npm run typecheck`, and
`npm run build` as code-only checks. Independent real delivery
acceptance is mandatory and remains outstanding.
