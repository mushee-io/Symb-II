import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {ALLOWED_ORIGIN,TERMINAL_URL,isAllowedAppNavigation}=require("../desktop/security-policy.cjs");

test("the native shell opens only the owned HTTPS trading terminal",()=>{
  assert.equal(ALLOWED_ORIGIN,"https://symb-ii.vercel.app");
  assert.equal(TERMINAL_URL,"https://symb-ii.vercel.app/workspace/terminal");
  assert.equal(isAllowedAppNavigation(TERMINAL_URL),true);
  assert.equal(isAllowedAppNavigation("https://symb-ii.vercel.app/workspace/risk"),true);
  assert.equal(isAllowedAppNavigation("https://symb-ii.vercel.app/agent"),true);
});
test("the desktop renderer cannot navigate to outside sites, lookalike domains or URI schemes",()=>{
  for(const url of [
    "https://nado.finance/",
    "https://symb-ii.vercel.app.evil.com/workspace/terminal",
    "http://symb-ii.vercel.app/workspace/terminal",
    "https://symb-ii.vercel.app/",
    "https://symb-ii.vercel.app/workspace-sneaky",
    "javascript:alert(1)","file:///etc/passwd","data:text/plain,evil","not-a-url",
  ])assert.equal(isAllowedAppNavigation(url),false,url);
});
