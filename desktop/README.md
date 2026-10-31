# Symb-II Windows Desktop — internal beta

Symb-II now has a Windows x64 Electron shell and an NSIS .exe packaging workflow.
The desktop loads the official HTTPS application:
https://symb-ii.vercel.app/workspace/terminal

**Release state:** unsigned internal candidate only until a genuine Windows
machine, wallet pairing and security acceptance are independently completed.
This is NOT a signed public installer or an autonomous trading application.

## Obtain a Windows test build

1. Open GitHub Actions and select desktop-build.yml.
2. Choose Run workflow, branch main, or inspect a verified pull-request run.
3. Download the short-lived artifact named symb-ii-windows-internal-<commit>.
4. The artifact contains:
   - Symb-II-Setup-0.1.0-x64.exe — Windows NSIS installer
   - SHA256SUMS.txt — actual installer SHA-256 digest
   - windows-candidate.json — test-only release metadata
5. Review the source commit and compare the installer digest on your Windows PC:

~~~powershell
Get-FileHash .\Symb-II-Setup-0.1.0-x64.exe -Algorithm SHA256
~~~

The digest must exactly match SHA256SUMS.txt. Refuse to execute a mismatched
installer. This internal candidate is **unsigned** and may trigger SmartScreen.
Do not bypass Windows protections on an untrusted download or advise others to
ignore OS warnings. Only use for controlled testing.

## Windows acceptance checklist

- [ ] Confirm correct GitHub owner, source commit, digest and unsigned status.
- [ ] Install per-user on Windows 11; verify Start Menu/Desktop shortcut.
- [ ] Launch and confirm the owned HTTPS terminal loads correctly.
- [ ] Disconnect network, launch: see the static Connection unavailable screen.
      Reconnect, select Retry and confirm the genuine terminal loads.
- [ ] Verify packaged Developer Tools cannot be opened, navigation to untrusted
      domains is blocked, and remote-file downloads are refused.
- [ ] Pair a separate mobile wallet via genuine WalletConnect QR on Ink 57073.
      Document successful connection, signing challenge and reconnection. No
      wallet authority is implied merely by reading a public address.
- [ ] Verify wrong-chain refusal, disconnect, reconnect and watch-only mode.
- [ ] Check true indexed Nado candles and actual Tydro account evidence.
      No invented market prices or mock portfolio balances.
- [ ] Verify Nado order placement and Tydro spending remain disabled;
      there must be no native key entry, seed collection or signing bridge.
- [ ] Test uninstall and rerun install; scrub all submitted diagnostics of
      passwords, recovery phrases, access tokens and sensitive identifiers.

## Developer start and package on Windows

~~~powershell
cd desktop
npm install --no-audit --no-fund
npm start

# Build unsigned internal NSIS installer (requires a Windows build host)
npm run pack:win
~~~

Electron builder 26 creates a normal-user, non-elevated NSIS package with
bundled app.asar. No self-updater, public publisher certificate or auto-release
is bundled. Runtime requires a network connection; offline UI shows no fake
prices and offers an explicit retry.

## Real signed public release is separate

The protected manual GitHub workflow at
.github/workflows/desktop-signed-candidate.yml requires actual Windows
Authenticode credentials. A signed candidate still requires independent
SmartScreen/device/WalletConnect acceptance, external security review and
financial-service compliance sign-off before public release.

Live Nado/Tydro financial execution and autonomous trade signing remain
blocked by EXECUTION_RELEASE_ENABLED=false. Passing an installer build
cannot and must not enable financial spending.
