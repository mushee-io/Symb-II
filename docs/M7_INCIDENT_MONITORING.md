# M7 — production incident monitoring and activation

## Public outage notifications (deployed)

The [Production incident monitor](../.github/workflows/production-incident-monitor.yml)
is an independent, scheduled GitHub Actions check of the **11 public read-only and safe origin-rejection
production checks** validated by `scripts/smoke.mjs`. It runs twice per
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
Successful public smoke does not establish protected probe readiness. The
protected probe now performs a **real ephemeral one-use Redis drill** if Redis
credentials are configured: create a fresh randomly keyed value using `SET NX
EX 30`, check the TTL, consume it atomically with `GETDEL`, and require a
subsequent replay attempt to return null. A private `DEL` cleanup is attempted
regardless of the test outcome. The probe never returns the ephemeral value or
private endpoint; it returns HTTP 503 if configured Redis fails the drill.
If Redis is intentionally unconfigured, this stage is marked
`not-configured`, not passed. A missing Redis diagnostic is unhealthy.

This protected synthetic nonce test **does not verify a real wallet
signature**, but establishes that the configured storage primitives can
support one-use M8 challenges.

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
provider, confirm Redis `PING`, one-use `SET NX EX`, `TTL`, first `GETDEL` and replay
`GETDEL` succeed in the protected diagnostic, then enable and test
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

## Default-branch deployment drift monitor

`.github/workflows/production-release-drift.yml` independently checks the
actual latest merged `main` commit against the public `/api/health`
deployment SHA every 30 minutes. It grants 30 minutes from the commit timestamp
for deployment, then raises a deduplicated GitHub issue if the production site
still serves a healthy but older release. After the exact revision is observed,
the monitor comments and closes that issue automatically. Unavailable or
invalid production health data is **indeterminate**, and never auto-closes an
existing drift incident (public outage monitoring handles endpoint failures).

This is a detector, **not a deployment runner or a Vercel billing workaround**.
It does not call deployment APIs or use API credentials. A GitHub green build
cannot be misrepresented as a production release; the SHA must match. A
Vercel deployment quota, team restriction, or Git integration failure still
requires an authorized operator to resolve it. Scheduled GitHub Actions are
best effort, and real pager delivery must be independently configured.

## Automatic Vercel deployment volume control

The repository's `vercel.json` explicitly keeps `main` eligible for
automatic **production** deployment but disables **automatic preview
deployments** for branches matching `feat/**`. This reduces repeated builds
during code development, where several commits in one feature branch would
otherwise each spend a Vercel deployment. Other branch types retain their
default Vercel behavior, and GitHub CI still validates pull requests.

This is based on Vercel's supported `git.deploymentEnabled` per-branch
minimatch configuration. It **does not** bypass Vercel quotas, restore a
blocked production build, create an alternative deployment, or disable
automatic production releases. An operator must still resolve any existing
Vercel billing/plan or deployment-cap limit. Preview deployments for
`feat/**` can be intentionally made manually with authorized tooling if
needed once deployment capacity is available.
