# Desktop-agent pivot — first implementation slice

The product direction is **a desktop-first AI-assisted trading agent for Ink**, not merely a capital dashboard.

## In this pull request
- `/workspace/terminal`: a dedicated three-column, desktop-first terminal, responsive on smaller screens.
- Live Nado perpetual watchlist sourced from the existing `/api/nado/markets` endpoint. No fabricated quotes.
- Publicly inspectable wallet-associated Nado positions, with partial-data warnings.
- A bounded deterministic command parser (for example, "Prepare a $500 BTC long at 2x") that fills a **local draft**.
- A calculator for *illustrative* notional/leverage/quantity and a 1% gross PnL move. These are **not** executable quotes or liquidation models.
- Unit tests for command handling and invalid values.

## Safety boundaries (unchanged)
- No order placement, transaction construction, trading signatures, token approvals, delegation, wallet custody, or autonomous trades.
- No actual generative AI is connected to this parser. It cannot recommend trades; it can only fill a hypothetical draft.
- Quotes are indexer snapshots, not executable prices. Stale snapshots block the quantity illustration.
- Incomplete Nado account coverage is disclosed rather than interpreted as safety.
- The new route is a **desktop-first web UI**, not yet a native Windows/macOS installer.

## Next gated slices
1. Confirm market selection, quote freshness, account isolation, and command-parser behavior in production.
2. Desktop packaging design and security-reviewed native runtime; decide local vs hosted API and wallet pairing. No remote Electron runtime with unrestricted Node access.
3. Grounded AI market research with source attribution, failure handling and explicit indication of uncertainty.
4. Read-only transaction preflight, venue-specific order simulation, margin/fees/liquidation validation and independent test vectors.
5. Only after full security acceptance: separately authorised user-controlled execution, with revocable permissions and auditable receipts.

Do not merge a future execution change just because this interface compiles. The explicit signing/trading release gates remain closed.
