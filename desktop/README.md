# Symb-II Desktop (first shell)

An **actual Electron desktop application shell**, separate from the Next.js app. This is development-only until platform acceptance and code signing are completed.

## Local developer run

From the `desktop` directory, run:

```sh
npm install
npm start
```

The shell loads the hosted `https://symb-ii.vercel.app/workspace/terminal` route. Until the terminal branch is deployed, the hosted route will not be available. It needs a network connection; it is not an offline terminal.

## Packaging, not release

```sh
npm run pack:win
npm run pack:mac
npm run pack:linux
```

Platform builds must run on appropriate build hosts. This repository does **not** contain code-signing identities, notarisation or a finished installer; packaged binaries have not been built or verified. Never distribute unsigned builds as trustworthy financial software.

## Threat model and limitations

- The remote renderer is sandboxed, context-isolated and has Node.js integration **off**. No preload bridge, IPC, native key storage, signing, approvals, trade execution, or external shell calls.
- The window denies all new windows and navigation outside the owned hosted workspace/agent routes, including permission requests for privileged device APIs. The app requires controlled deployments and trusted TLS.
- Browser extensions such as MetaMask/Rabby are **not** embedded. The desktop app does not yet have an independently verified WalletConnect pairing flow. Wallet-specific position inspection in this shell may therefore be unavailable even though public market data loads.
- The executable needs independent Windows/macOS launch tests, Electron security review, installer signing and update/revocation design before public beta.
- Trading stays disabled. This is **not yet a functional autonomous trading agent**: current command entry is a local, deterministic draft parser with no generative model, no venue-side simulation and no execution.

Reference security guidance: https://www.electronjs.org/docs/latest/tutorial/security
