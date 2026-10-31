# Desktop-agent pivot — first implementation slice

The product direction is **a desktop-first AI-assisted trading agent for Ink**, not merely a capital dashboard.

## In this pull request
- `/workspace/terminal`: a dedicated three-column, desktop-first terminal, responsive on smaller screens.
- Live Nado perpetual watchlist sourced from the existing `/api/nado/markets` endpoint. No fabricated quotes.
- Publicly inspectable wallet-associated Nado positions, with partial-data warnings.
- A bounded deterministic command parser (for example, "Prepare a $500 BTC long at 2x") that fills a **local draft**.
- A calculator for *illustrative* notional/leverage/quantity and a 1% gross PnL move. These are **not** executable quotes or liquidation models.
- Unit tests for command handling and invalid values.
- `desktop/`: a separately installable Electron runtime project with a sandboxed read-only shell and allowlisted navigation. Its Windows/macOS/Linux packages are **not yet built, signed or device-tested**; wallet pairing inside the native shell is not accepted.

## Safety boundaries (unchanged)
- No order placement, transaction construction, trading signatures, token approvals, delegation, wallet custody, or autonomous trades.
- No actual generative AI is connected to this parser. It cannot recommend trades; it can only fill a hypothetical draft.
- Quotes are indexer snapshots, not executable prices. Stale snapshots block the quantity illustration.
- Incomplete Nado account coverage is disclosed rather than interpreted as safety.
- The new route is a **desktop-first web UI**. A native Electron shell project now exists, but no installer is built/signed, and native wallet pairing has not been verified.

## Next gated slices
1. Confirm market selection, quote freshness, account isolation, and command-parser behavior in production.
2. Build and test native Electron packages on supported operating systems, review remote-renderer security, code-sign installers and verify WalletConnect. No remote Electron runtime with unrestricted Node access.
3. Grounded AI market research with source attribution, failure handling and explicit indication of uncertainty.
4. Read-only transaction preflight, venue-specific order simulation, margin/fees/liquidation validation and independent test vectors.
5. Only after full security acceptance: separately authorised user-controlled execution, with revocable permissions and auditable receipts.

Do not merge a future execution change just because this interface compiles. The explicit signing/trading release gates remain closed.
