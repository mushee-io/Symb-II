import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");

test("Symb-II homepage uses original editorial brand and routes to genuine product pages",()=>{
 const home=read("app/page.tsx");
 const css=read("app/home-redesign.module.css");
 for(const marker of ["SYMB","MARKETS.","MARGIN.","INTELLIGENCE.","NADO","TYDRO","READ-ONLY RELEASE"]){
  assert.ok(home.includes(marker),marker);
 }
 assert.match(home,/href="\/workspace\/terminal"/);
 assert.match(home,/href="\/workspace\/rescue"/);
 assert.match(home,/home-redesign\.module\.css/);
 assert.match(css,/\.heroBody/);
 assert.match(css,/\.instrument/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.ok(!/guaranteed profit|LIVE TRADING ENABLED/i.test(home));
});

test("trading screen is chart / real L1 book / disabled ticket, with research below",()=>{
 const terminal=read("components/trading-terminal.tsx");
 const css=read("app/workspace/terminal/terminal.module.css");
 const globals=read("app/globals.css");
 for(const marker of ["TerminalCandlestickChart","TerminalOrderBook",
   "TerminalWalletPairing","TerminalAccountDesk","terminal-route"]){
  assert.ok(terminal.includes(marker),marker);
 }
 assert.match(css,/grid-template-areas:"chart book ticket"/);
 assert.match(css,/\.researchSection/);
 assert.match(globals,/\.workspace-shell:has\(\.terminal-route\)/);
 assert.match(terminal,/Order placement disabled/);
 assert.match(terminal,/No live Nado book is available/);
 assert.doesNotMatch(terminal,/sendTransaction\(|writeContract\(|signTypedData\(/);
});

test("order book uses official top of book only and never manufactures depth",()=>{
 const book=read("components/terminal-order-book.tsx");
 for(const marker of ["/api/nado/quote?productId=","assessTopOfBook",
  "BEST ASK","BEST BID","market depth","No additional"]){
  assert.ok(book.toLowerCase().includes(marker.toLowerCase()),marker);
 }
 assert.doesNotMatch(book,/sendTransaction\(|writeContract\(|signTypedData\(/);
 assert.doesNotMatch(book,/Math\.random\(/);
 assert.match(book,/refetchInterval:15000/);
});
