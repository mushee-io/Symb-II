# Execution engineering gates — Symb-II (Ink chain 57073)

## What this branch implements

- Read-only, exact-amount Pool eth_call and gas estimation for all four Tydro actions: supply, withdraw, variable-rate borrow and variable-debt repay.
- Pins Tydro's canonical Pool and token contracts, validates reserve/decimals/eMode and matches a single current Ink block with a rechecked hash.
- Requires existing token allowance and spendable balance for supply or repay, and verifies an existing position for withdraw or variable-debt repay.
- Conservatively checks a 2x L2 gas estimate buffer. OP Stack L1 data fees are NOT fully modelled.
- Exposes POST /api/tydro/simulate behind existing protected preflight flag, strict same-origin POST body size checks and a Redis wallet-scoped 30-second request throttle.
- Adds a read-only simulation review button to the Action Lab. The feature remains disabled until SYMB_II_PREFLIGHT_ENABLED=true and the Redis configuration has been live-tested.
- Adds a fail-closed autonomous-agent draft grant policy: wallet, chain, venue instrument, action, 24-hour maximum expiry, revocation, exact atomic per-action and daily ceilings, mandatory fresh human approval. It ALWAYS returns canExecute=false.
- Test coverage for invalid asset/action/amount, precision and overflow, grant expiry, revocation, budget violations and the absence of broadcasting/signing APIs.

## What has NOT been implemented or accepted

1. Nado engine-authoritative authenticated order creation, exchange-specific signing, fee/slippage/fill limits, user signature flows and reconciled trade receipts.
2. Actual Tydro wallet-approved transaction submission, UI for ERC-20 approvals, transaction sequence simulation, mined receipts, stale-state rechecking and independent risk assessment.
3. Durable issued grants, atomic spend accounting, verified human-approval receipts, token/venue exposure limits, anti-replay authorisation, agent workers, kill switch and live monitored execution.
4. A production security audit, WalletConnect acceptance on Windows, installer code signing and compliance sign-off.
5. Real-wallet acceptance of all four Tydro dry runs, including negative scenarios and independent protocol comparisons.

## Critical limits

- Eth_call is a simulation of current block state, not a transaction confirmation or guarantee. An apparently good result cannot by itself establish post-action health factor, future margins, oracle behaviour, interest changes or final fee.
- The report NEVER provides transaction calldata, wallet signature, token approval or broadcast permission.
- Wallet-scoped Redis throttling is not user authentication. Add authenticated rate limits and abuse controls before a broad public beta.
- The autonomous-agent draft policy is an arithmetic planning tool, NOT a server-side grant issuance or durable accounting system. Its spent counter is not authenticated.
- All actual spending gates stay locked: EXECUTION_RELEASE_ENABLED=false.
- Real financial execution must remain disabled until independent security testing, legal review, venue-specific signing and wallet-owner acceptance.

## Operator test sequence

1. Confirm Upstash replay and nonce drills and test the production deployment's AI, Redis and WalletConnect configuration. Mere presence of environment variables does not prove readiness.
2. After protected preflight acceptance, add SYMB_II_PREFLIGHT_ENABLED=true to Vercel and redeploy deliberately.
3. Use a real Ink wallet. Dry-run supply, withdraw, borrow and variable-debt repay in the Tydro Action Lab. Validate Tydro Pool reference, pinned block hash, allowance, balance, eMode, reserve status and fees against the official interface.
4. Exercise no allowance, insufficient balance, frozen reserves, nonexistent debt, wrong chain, stale block, disconnected RPC, rate limits and unavailable Redis.
5. Leave user-approved financial execution disabled pending an external security assessment.
