import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("production smoke validates the actual post-redesign terminal interface",()=>{
 const smoke=read("scripts/smoke.mjs");
 const terminal=read("components/trading-terminal.tsx");
 const header=read("components/site-header.tsx");
 for(const token of ["PERPETUALS","EXECUTION LOCKED","Order placement disabled",
  'aria-label="Nado market watchlist"','aria-label="Local order draft"']){
  assert.ok(smoke.includes(token),"Smoke missing "+token);
  assert.ok(terminal.includes(token),"Terminal missing "+token);
 }
 assert.ok(smoke.includes('aria-label="Primary navigation"'));
 assert.ok(header.includes('aria-label="Primary navigation"'));
 assert.ok(!smoke.includes('html.includes("Trading terminal")'));
});
