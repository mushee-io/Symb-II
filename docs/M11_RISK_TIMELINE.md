# M11 — Browser-tab risk event timeline

This workstream is **newly defined M11 scope**, not a claim that M10 has
been implemented. M10 is not formally described in the current roadmap.
M7 Redis activation, M8 genuine account reconciliation, and M9 independent
release acceptance remain separate, outstanding obligations.

## Implemented code-only scope

The existing active-tab Nado/Tydro Risk Watch panel now includes a compact
risk event timeline in the Ink wallet workspace. Events record **changes in
risk alert IDs and severity**, not trades or collateral movements. The event
payload retains only observation time, transition type, warning/critical
counts, public protocol labels and generic policy-authored alert titles.

- Only an Ink wallet address that matches the currently selected wallet can
  contribute a risk event, and the timeline is reset when the wallet changes.
- The timeline does not advance while either protocol feed is still loading.
  When a protocol query returns an error, the existing alert evaluator
  produces an explicit **unknown/unavailable** warning.
- A change to no warnings is called a *recovery from flagged conditions*
  only when both feeds are successful, fresh under three minutes, associated
  with the same Ink 57073 wallet, report complete coverage, and pass
  internal Nado/Tydro reserve/health consistency checks, including unique, finite Nado subaccount-health data and non-contradictory Tydro account/reserve debt presence. A "recovery" is
  not a safe-account verdict, margin guarantee or proof of account ownership.
- A repeated alert ID/severity set does not create another event, even if
  new HTTP timestamps arrive. Changes in severity trigger an event.
- Only 40 events are retained in JavaScript memory (latest 12 displayed).
  Clearing history retains the last fingerprint to avoid immediately
  replaying the same snapshot as a fresh event.
- No localStorage, IndexedDB, cookie, server-side alert persistence, user
  signing, external notification channel, long-running worker, Upstash
  connection, transaction payload or wallet approval is added by this
  milestone. Reload, tab close and disconnect erase the history.

Events carry neither the wallet address nor raw position/debt fields, and
there is no export or analytics telemetry. The app necessarily still holds
the connected wallet address in its normal wallet state while rendering.

## Security and acceptance

The deterministic tests cover initial empty snapshots, critical escalation,
identical refresh deduplication, genuine complete-snapshot recovery,
loading/error/stale/partial source rejection, malformed reserve inventory,
cross-wallet resets, explicit clearing, chronological rollback and
privacy/40-event bounding.

Run from a checkout with Node 22+:

```sh
npm run test
npm run typecheck
npm run build
```

A successful build validates code only. To accept the M11 UI, verify with
two independently controlled Ink wallets, adverse real Nado/Tydro states,
network transitions and browser refresh/close behaviour. There is no
backend history or promised system notification delivery. This page is
**diagnostic only**; it cannot protect from liquidation or prove that
warnings were delivered during sleep, disconnection or RPC outage.

Future always-on alert delivery needs opt-in, durable queue/storage,
retries/deduplication, subscribed wallet authorization, deletion/retention
and independent adversarial review. Do not enable or advertise that as
part of the M11 timeline implementation.
