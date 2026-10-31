<#
 Verify an internal unsigned Windows NSIS candidate before GitHub uploads it.
 No signing, publishing, update feed, or financial permissions are enabled.
#>
param(
 [string]$DistPath = "desktop/dist",
 [string]$SourceRevision = $env:GITHUB_SHA
)
$ErrorActionPreference = "Stop"
if (!(Test-Path -LiteralPath $DistPath -PathType Container)) {
 throw "Windows output directory not found: $DistPath"
}
$items = @(Get-ChildItem -LiteralPath $DistPath -File -Filter "Symb-II-Setup-*.exe")
if ($items.Count -ne 1) {
 throw "Expected one deterministic NSIS installer; found $($items.Count)."
}
$installer = $items[0]
if ($installer.Length -lt 5MB) {
 throw "Installer unusually small: $($installer.Length) bytes."
}
$stream = [System.IO.File]::OpenRead($installer.FullName)
try {
 $first = $stream.ReadByte()
 $second = $stream.ReadByte()
 if ($first -ne 77 -or $second -ne 90) {
  throw "Installer does not have an executable MZ header."
 }
}
finally { $stream.Dispose() }
$asar = Join-Path $DistPath "win-unpacked/resources/app.asar"
if (!(Test-Path -LiteralPath $asar -PathType Leaf)) {
 throw "Packaged Windows application ASAR not found."
}
$signature = Get-AuthenticodeSignature -FilePath $installer.FullName
if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::NotSigned) {
 throw "Unsigned test workflow unexpectedly found installer signature state $($signature.Status)."
}
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $installer.FullName).Hash.ToLowerInvariant()
if ($hash -notmatch '^[a-f0-9]{64}$') {
 throw "SHA256 digest calculation failed."
}
$revision = if ($SourceRevision -match '^[0-9a-f]{40}$') { $SourceRevision } else { "unknown-local-test" }
$manifest = [ordered]@{
 classification = "internal-unsigned-test-only"
 filename = $installer.Name
 sha256 = $hash
 bytes = $installer.Length
 sourceCommit = $revision
 chainId = 57073
 executionEnabled = $false
 signerVerified = $false
 realWindowsDeviceAccepted = $false
 walletConnectDeviceAccepted = $false
 safeToDistributePublicly = $false
}
$manifestFile = Join-Path $DistPath "windows-candidate.json"
$hashFile = Join-Path $DistPath "SHA256SUMS.txt"
$manifest | ConvertTo-Json -Depth 3 | Set-Content -Path $manifestFile -Encoding utf8
"$hash  $($installer.Name)" | Set-Content -Path $hashFile -Encoding utf8
Write-Host ("PASS internal Windows candidate — " + $installer.Name)
Write-Host ("SHA256: " + $hash)
Write-Host "No live execution, no signing certificate and no public release approval."
