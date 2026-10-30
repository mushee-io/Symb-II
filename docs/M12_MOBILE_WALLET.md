# M12 — Mobile wallet onboarding (optional code phase)

M12 follows the merged in-tab M11 risk timeline. M10 has no formal
documentation in this repository, and M7–M9 live acceptance is still
outstanding. Shipping M12 code does not mark those gates completed.

## What is implemented

Symb-II's Connect Wallet button now shows an explicit wallet choice rather
than calling the first connector without asking. The existing injected
EIP-1193 connector stays available by default. An optional WalletConnect v2
connector enables QR and cross-device mobile app pairing when the operator
configures a valid public project identifier. Only **Ink mainnet (57073)**
is in the wagmi chain configuration. Wrong-network and malformed connected
addresses are not treated as read-only access, and users have visible
switch/disconnect options. Nothing in this work introduces app transaction
signing or broadcasting.

The public `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` must be exactly
32 hexadecimal characters, and an all-zero placeholder is rejected. An
unconfigured deployment has **no WalletConnect connector** and says so
instead of presenting an inert or fictitious QR connection. Users with
supported wallets may still open the site in the wallet's injected browser.

The Project ID is explicitly public runtime configuration, not a password,
wallet key or operator bearer token. **Do not** put a private WalletConnect
dashboard login, relay credential, mnemonic or wallet key in environment
variables, Git or chat. Register the genuine application domain
`https://symb-ii.vercel.app` and review the project restrictions,
privacy requirements and billing before provisioning.

## Operator enablement (requires real project owner)

1. In the authorised WalletConnect/Reown dashboard create a project for
   Symb-II and copy its public 32-hex Project ID. Do not fabricate one.
2. Add `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` to the **production**
   Vercel project with that ID (client-visible by design), then redeploy
   the exact reviewed main commit. No Upstash credentials are needed for
   this mobile connector.
3. On iOS and Android, separately test QR pairing with a desktop browser
   and mobile app pairing from the device browser. Use a wallet you control.
4. Confirm wallet address and Ink 57073 chain; verify that another chain
   blocks portfolio queries; test network switch rejection, cancellation,
   forced disconnect, session revocation in the external wallet app,
   reload and reconnection. A read-only connection never proves a Nado
   subaccount owner's identity or grants permissioned API access.
5. Repeat with one browser-injected wallet and a second independent mobile
   wallet. Compare wallet-specific Nado/Tydro data, empty states and
   switch isolation. Check that no transaction/approval/signing dialog
   appears from the mere act of inspecting the workspace.
6. Complete an independent security review of the connector/dependency
   graph, project-domain spoofing, session lifetime and revocation before
   advertising public mobile interoperability.

### Boundaries

CI passing confirms that this app compiles and deterministic policies
behave as specified. It does not prove a real mobile wallet paired,
a relay is reachable, a QR displayed, that the current live deployment
has the Project ID or that session revocation works end-to-end. Native
iOS/Android apps, autonomous risk protection, notifications, execution,
approval and borrowing are not delivered in M12. Any authenticated
signature workflow remains under the existing restricted M8/M7 gates.
