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

## Step 1 — protected Upstash activation gate

**This gate ships ready to run, but Redis is not provisioned by source-code
changes.** Creating a database or installing a Marketplace integration may
require an authorized account holder, approval of billing terms, and access
to the Vercel project. Do not create trial credentials or placeholder secrets.

1. On the **Symb-II** Vercel project, use **Storage → Create Database →
   Upstash Redis**, or install the Upstash integration from
   https://vercel.com/marketplace/upstash and connect the database to the
   project. Review the region and billing plan yourself. An existing Upstash
   account can also be connected.
2. Verify that the **production** environment contains exactly these
   server-only variables:
   - `UPSTASH_REDIS_REST_URL` — root HTTPS `*.upstash.io` REST endpoint
   - `UPSTASH_REDIS_REST_TOKEN` — the private REST token

   Upstash integration may inject these automatically when the database
   is connected. Use the Vercel **Secret** type for the token; never use
   `NEXT_PUBLIC_` keys, commit secrets, or paste tokens into a chat.
3. Keep `SYMB_II_WALLET_PROOF_ENABLED`, `SYMB_II_AI_ENABLED`,
   `SYMB_II_PREFLIGHT_ENABLED`, `SYMB_II_PROPOSALS_ENABLED` and
   `SYMB_II_WATCH_ENABLED` disabled while validating the store.
   **Redeploy** Symb-II after setting production environment variables.
   Previously deployed functions do not gain newly added variables.
4. From an up-to-date checkout of `main` with Node and dependencies
   installed, inject **the existing `CRON_SECRET`** into the local
   terminal using a trusted secret manager/environment tool and run:

   ```sh
   git switch main
   git pull --ff-only
   npm run verify:m7:redis
   ```

   Do not put `CRON_SECRET` on a command line, in a script committed to Git,
   or in CI logs. The command uses `git rev-parse HEAD`, queries
   **only** `https://symb-ii.vercel.app`, refuses HTTP redirects, and
   verifies the exact production commit from `/api/health` and
   `/api/ops/readiness` **before** sending the secret to
   `/api/ops/probe`.

   The protected route executes a live `PING`, synthetic `SET NX EX`,
   bounded `TTL`, `GETDEL`, replay rejection and cleanup, then checks
   Ink RPC, Nado and Tydro public integrity. The CLI prints only
   non-sensitive policy-owned check labels, never the raw HTTP response,
   operator token, Redis key or private endpoint.

5. Step 1 is accepted only if all **five** checks pass: exact release,
   read-only runtime, Redis configuration, disabled M8 wallet proof, and a
   healthy *live* protected Redis/provider probe. The output's scope is
   `m7-redis-one-use-and-public-provider-activation-only`.

This **does not enable** M7 model generation, watch notifications,
signed receipts or M8 wallet ownership; those require separate
credential-specific activation and real-wallet acceptance. A green CI
test or a configured URL never counts as proof of a live Redis service.

### Failure cases

- `blocked` / `redis-configuration`: URL or token missing or malformed;
  check the *production* environment and redeploy.
- `blocked` / `exact-release`: your local checkout does not match the
  deployed revision; do not send the secret until releases match.
- `blocked` / `protected-live-redis-and-providers`: check protected
  Vercel logs and DNS/network connectivity; a 503 from Redis, Ink RPC,
  Nado or Tydro must not be overridden.
- `blocked` / `wallet-proof-not-prematurely-enabled`: disable the
  feature first, then separately plan genuine-wallet testing.

The Redis URL validator is now shared by readiness and the real transport.
It rejects URL credentials, non-TLS, query strings, fragments, unsafe
paths and explicit ports. The private REST client also refuses HTTP
redirects to prevent bearer-token forwarding.

## Step 2 — isolated Redis structure drills for protected services

A configured Redis connection must support not only one-use M8 nonces but
also the **real data structures required by the existing M7 services**:

- Proposal and preflight receipt retention: `LPUSH`, `LTRIM`, `LRANGE`,
  `EXPIRE` and bounded `TTL` for a synthetic private list.
- Background watch indexing: `ZADD`, `ZSCORE`, `ZRANGE`, `ZREM`,
  `EXPIRE` and `TTL` for a synthetic private sorted set.

The existing operator-only `GET /api/ops/probe` now reports a separate
`redis-services` result **only after a live test**. Every synthetic key has a
random UUID under `symb-ii:ops:`; no real subscription list, private
wallet, actual receipt or alert is read or mutated. Both keys receive a
short retention timeout and a cleanup attempt is made on every outcome.
A failed command, incorrect order, missing TTL or incomplete cleanup
is never counted as a healthy storage service.

If no Redis credentials exist, this check reports `not-configured` and
the private probe retains the existing distinction between *public
provider health* and *private service activation*. A missing or failed
`redis-services` observation when Redis is configured causes HTTP 503.
The M7 operator `npm run verify:m7:redis` command now **requires**
the new observation too; an earlier 4-check probe no longer qualifies
for activation.

**A pass is not an endorsement of turning on all M7 services at once.**
It proves the protected storage primitives, not email notifications,
background watch scheduling, Vercel AI Gateway billing/authentication,
actual Nado/Tydro user state or signed acknowledgement validity.
Enable one feature at a time only after Redis passes and its own
real-world acceptance run is recorded. All trading and wallet
execution remain disabled.
