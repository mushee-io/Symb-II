# M7 — production incident monitoring and activation

## Public outage notifications (code present, activation requires merge)

The [Production incident monitor](../.github/workflows/production-incident-monitor.yml)
is an independent, scheduled GitHub Actions check of the **eight public read-only
production endpoints** validated by `scripts/smoke.mjs`. It runs twice per
hour (at UTC minutes 17 and 47) and supports manual workflow dispatch.

- A failed smoke produces a **failing Actions run** and opens one deduplicated
  GitHub issue titled `[M7] Symb-II production monitor: degraded`.
- Subsequent failures do not create duplicate issues or repeated comments.
- The first passing check comments with recovery evidence and closes the issue.
- For external delivery, team members must subscribe to repository Actions and
  Issues notifications; GitHub issue creation does not itself guarantee that
  an on-call engineer will receive a push, email or page.
- Scheduled Actions can be delayed or skipped by GitHub. This is a lightweight
  detection layer, not a high-availability external uptime monitor.

The public smoke checks the deployed release, configuration safety, and live
market response integrity. It **does not test Redis, private worker credentials,
wallet ownership, active derivatives positions, live debt or transaction execution**.

## Protected live diagnostics

Vercel Cron invokes `GET /api/ops/probe` daily at 08:00 UTC, using
`Authorization: Bearer <CRON_SECRET>`. The route requires a secret of at
least 32 characters, is private/no-store, and returns HTTP 503 if required
RPC, Nado, Tydro or configured Redis integrity/connectivity checks fail.
A malformed/incomplete diagnostic cannot change a genuine 503 into a success.

The protected endpoint is **not** pinged by the GitHub public monitor.
Its existing schedule and Vercel logs should be inspected separately.
Successful public smoke does not establish protected probe readiness.

## Missing production activation

Provision a private Upstash Redis REST database with enforced TLS. Add these
**server-only encrypted** Vercel production environment variables (never add
their values to Git or browser-exposed `NEXT_PUBLIC_` configuration):

- `UPSTASH_REDIS_REST_URL` — trusted `https://*.upstash.io/` root endpoint
- `UPSTASH_REDIS_REST_TOKEN` — REST authentication token
- `CRON_SECRET` — strong secret already used by protected cron
- `AI_GATEWAY_API_KEY` — if Vercel OIDC authentication is not available and
  generative model support is required

After a production redeployment, validate the protected probe against each
provider, confirm Redis `PING` succeeds, then enable and test
`SYMB_II_WATCH_ENABLED`, `SYMB_II_PROPOSALS_ENABLED`,
`SYMB_II_PREFLIGHT_ENABLED` and `SYMB_II_AI_ENABLED` **one at a time**.
Do not switch them on until credentials and their service-specific behavior
are verified in the actual deployment.

## Acceptance / incident drill

1. Merge and confirm this workflow appears under repository Actions.
2. Manually dispatch it; a healthy public deployment should pass without
   opening an incident.
3. In a controlled **non-production** test repository or isolated fork,
   temporarily replace the target URL with a known failing endpoint, confirm
   one issue and a failing run, and then restore it to verify auto-closure.
   Avoid engineering a real production outage as a test.
4. Confirm operational staff actually receive the desired GitHub
   notifications; provision an external paging provider separately if
   guaranteed delivery or escalation is required.
5. Execute the protected live probe and real wallet verification lab
   independently, and record timestamped evidence before making any
   M7/M8 production-acceptance claims.

Transaction execution remains disabled. Neither these monitors nor a passing
CI run authorize automated trading, broadcasting or token approvals.
