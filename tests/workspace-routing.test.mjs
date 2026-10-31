import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";

const read=path=>readFileSync(join(process.cwd(),path),"utf8");

const routes={
  "/workspace/nado":{component:"NadoPanel",file:"app/workspace/nado/page.tsx"},
  "/workspace/tydro":{component:"TydroPanel",file:"app/workspace/tydro/page.tsx"},
  "/workspace/actions":{component:"TydroActionPlanner",file:"app/workspace/actions/page.tsx"},
  "/workspace/risk":{component:"RiskPanel",file:"app/workspace/risk/page.tsx",mode:"risk"},
  "/workspace/rescue":{component:"RiskPanel",file:"app/workspace/rescue/page.tsx",mode:"rescue"},
  "/workspace/preflight":{component:"RiskPanel",file:"app/workspace/preflight/page.tsx",mode:"preflight"},
  "/workspace/monitor":{component:"RiskPanel",file:"app/workspace/monitor/page.tsx",mode:"monitor"},
  "/workspace/verify":{component:"WalletVerification",file:"app/workspace/verify/page.tsx"},
  "/workspace/readiness":{component:"LaunchReadiness",file:"app/workspace/readiness/page.tsx"},
};
test("every workspace section is a distinct route with the existing implementation",()=>{
  for(const [route,item] of Object.entries(routes)){
    const page=read(item.file);
    assert.match(page,/WorkspacePageHeader/,route);
    assert.ok(page.includes("<"+item.component),route+" must use its real panel");
    if(item.mode)assert.ok(page.includes('mode="'+item.mode+'"'),route);
  }
});
test("persistent accessible workspace navigation reaches each feature and the AI page",()=>{
  const nav=read("components/workspace-navigation.tsx");
  assert.match(nav,/aria-label="Workspace sections"/);
  assert.match(nav,/aria-current=\{active\?"page":undefined\}/);
  assert.ok(nav.includes('href:"/workspace"'));
  assert.ok(nav.includes('href:"/agent"'));
  for(const route of Object.keys(routes))assert.ok(nav.includes('href:"'+route+'"'),route);
  const layout=read("app/workspace/layout.tsx");
  assert.match(layout,/WorkspaceNavigation/);
  assert.match(layout,/\{children\}/);
});
test("overview no longer mounts every large data panel on one page",()=>{
  const page=read("app/workspace/page.tsx");
  for(const module of ["NadoPanel","TydroPanel","RiskPanel","WalletVerification","LaunchReadiness"])
    assert.ok(!page.includes("<"+module),module+" must not mount in the overview");
  assert.ok(page.includes("/workspace/risk"));
  assert.ok(page.includes("/workspace/nado"));
});
test("risk modes keep separate tools isolated without trading permissions",()=>{
  const source=read("components/risk-panel.tsx");
  for(const mode of ["risk","rescue","preflight","monitor"])
    assert.ok(source.includes('mode==="'+mode+'"'),mode);
  assert.match(source,/mode==="rescue" && connected && address && <RescueLab/);
  assert.match(source,/mode==="preflight" && connected && address && <PreflightPanel/);
  assert.match(source,/mode==="monitor" && connected && address && <RiskAlerts/);
  assert.match(source,/mode==="monitor" && connected && address && <PersistentWatch/);
  assert.ok(source.includes('href="/workspace/nado"'));
  assert.ok(source.includes('href="/workspace/tydro"'));
});
test("old hash deep links and homepage rescue button reach the new routes",()=>{
  const overview=read("app/workspace/page.tsx");
  for(const anchor of ["#risk","#nado","#tydro","#portfolio-rescue","#preflight","#launch-readiness"])
    assert.ok(overview.includes('"'+anchor+'"'),anchor);
  assert.ok(overview.includes("router.replace(destination)"));
  assert.ok(read("app/page.tsx").includes('href="/workspace/rescue"'));
  assert.ok(read("app/agent/page.tsx").includes('href="/workspace/risk"'));
});
test("responsive navigation and read-only boundaries remain visible",()=>{
  const css=read("app/globals.css");
  assert.match(css,/\.workspace-shell/);
  assert.match(css,/\.workspace-nav-active/);
  assert.match(css,/@media\(max-width:820px\)/);
  const nav=read("components/workspace-navigation.tsx");
  assert.match(nav,/READ ONLY/);
  const layout=read("app/workspace/layout.tsx");
  assert.ok(layout.includes("SiteHeader")&&layout.includes("SiteFooter"));
});
