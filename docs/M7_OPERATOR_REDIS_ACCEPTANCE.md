# M7 — operator-only Redis acceptance

This workflow verifies **real Upstash Redis nonce and replay primitives** and the canonical Ink, Nado and Tydro public providers, without disclosing Vercel credentials in tickets, code or chat.

## Setup (once, by the repository/Vercel operator)

1. Verify Vercel project `symb-ii` Production contains `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `CRON_SECRET`. Use the Vercel dashboard directly. Do not paste values into GitHub issues, PRs or chats.
2. In GitHub `mushee-io/Symb-II`, open **Settings → Environments → New environment** and name it `production-ops`. Require an authorized reviewer and restrict deployments to the `main` branch. Restrict repository and environment administration to trusted people.
3. Under **production-ops → Environment secrets**, add `SYMB_II_CRON_SECRET`. Its value must equal the existing production Vercel `CRON_SECRET`; put it in GitHub's secret editor only. If the credential is rotated in Vercel, rotate the GitHub copy too.
4. Confirm Vercel has finished deploying the exact latest `main` SHA. Leave transaction execution disabled.
5. Open **Actions → M7 private Redis acceptance (operator-only) → Run workflow**, select `main`. If the environment requires approval, a trusted reviewer must approve this specific job.
6. Inspect the safe summary and the gate results. Only a PASS for **all** exact-release, read-only, Redis configuration, wallet-proof-not-enabled and protected-live Redis/provider gates qualifies **M7 Redis only**. A failed job is not proof Redis is broken: misconfigured secret, stale deployment, missing provider or temporarily unavailable RPC also fail closed.

## Security design

The workflow is manual, `main`-only, least-privileged and environment-scoped. It does not run on pull requests, pushes or schedules. The job injects the secret through the runner environment, not shell arguments or workflow inputs. The verifier refuses redirects and first checks the public production commit against checked-out Git HEAD before it sends the token to the fixed canonical origin. Raw private probe bodies and credential values are never printed.

## What the workflow does NOT approve

- AI Gateway working; real model analysis and signer verification still need independent acceptance.
- WalletConnect functioning in Electron; a public project ID alone proves nothing.
- Permission to create any signed Nado order or Tydro transaction.
- Agent spending, execution, security audit, legal/compliance or signed Windows release.

`EXECUTION_RELEASE_ENABLED=false` is unchanged. Do not enable financial execution from a green Redis workflow alone.
