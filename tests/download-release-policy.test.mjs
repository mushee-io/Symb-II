import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("navbar provides discoverable download entry on desktop and mobile",()=>{
 const header=read("components/site-header.tsx");
 const global=read("app/globals.css");
 assert.match(header,/href="\/download"/);
 assert.match(header,/download-nav-link/);
 assert.match(header,/Download size=\{13\}/);
 assert.match(header,/Mobile navigation/);
 assert.match(global,/\.download-nav-link/);
});
test("Windows beta has a direct versioned release EXE and checksum asset",()=>{
 const page=read("app/download/page.tsx");
 assert.match(page,/https:\/\/github\.com\/mushee-io\/Symb-II\/releases\/download\//);
 assert.match(page,/v0\.1\.0-windows-beta/);
 assert.match(page,/Symb-II-Setup-0\.1\.0-x64\.exe/);
 assert.match(page,/SHA256SUMS\.txt/);
 assert.match(page,/DOWNLOAD FOR WINDOWS/);
 assert.match(page,/WINDOWS BETA — UNSIGNED TEST BUILD/);
 assert.match(page,/Live order submission, lending transactions and autonomous spending remain disabled/);
});
test("macOS, iOS and Linux have no fake download buttons or misleading availability",()=>{
 const page=read("app/download/page.tsx");
 for(const platform of ['name:"macOS"','name:"iOS"','name:"Linux"']){
  assert.ok(page.includes(platform),platform);
 }
 assert.match(page,/COMING SOON/);
 assert.match(page,/upcoming\.map/);
 assert.match(page,/upcomingCard/);
 assert.doesNotMatch(page,/(?:https?:\/\/)[^\s"'<>]*(?:\.dmg|\.appimage|\.deb|\.ipa)/i);
});
test("release job cannot publish from pull requests or non-main branches",()=>{
 const workflow=read(".github/workflows/windows-beta-release.yml");
 assert.match(workflow,/if: github\.event_name != 'pull_request' && github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/permissions:\s*\n\s*contents: read/);
 assert.match(workflow,/contents: write/);
 assert.match(workflow,/needs: validate-release-policy/);
 assert.match(workflow,/runs-on: windows-latest/);
 assert.match(workflow,/verify-windows-candidate\.ps1/);
 assert.match(workflow,/--prerelease/);
 assert.match(workflow,/--notes-file/);
 assert.match(workflow,/Symb-II-Setup-0\.1\.0-x64\.exe/);
 assert.match(workflow,/SHA256SUMS\.txt/);
 assert.match(workflow,/Refusing to overwrite its installer/);
 assert.doesNotMatch(workflow,/\b--latest\b|--publish always|gh release delete|--clobber/);
 const notes=read("desktop/WINDOWS_BETA_RELEASE_NOTES.md");
 assert.match(notes,/UNSIGNED BETA/);
 assert.match(notes,/Nado order submission.*remain \*\*disabled\*\*/s);
});


test("Electron packaging runs without GitHub publishing tokens; only gh upload steps receive them",()=>{
 const workflow=read(".github/workflows/windows-beta-release.yml");
 const jobEnv=workflow.slice(workflow.indexOf("    env:",workflow.indexOf("  publish-unsigned-beta:")),
    workflow.indexOf("    steps:",workflow.indexOf("  publish-unsigned-beta:")));
 assert.doesNotMatch(jobEnv,/GH_TOKEN|GITHUB_TOKEN/);
 assert.equal((workflow.match(/GH_TOKEN:/g)||[]).length,2);
 assert.match(workflow,/name: Publish beta with attached EXE and checksum\s+shell: pwsh\s+env:\s+GH_TOKEN:/);
 assert.match(workflow,/name: Verify exact public release attachments\s+shell: pwsh\s+env:\s+GH_TOKEN:/);
 assert.match(workflow,/npm run pack:win/);
});
