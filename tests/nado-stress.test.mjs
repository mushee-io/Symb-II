import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateNadoPosition, simulateNadoFromFeeds, nadoPositionKey } from "../lib/risk/nado-stress.ts";

const now=Date.parse("2026-10-29T16:00:00.000Z");
const p=(overrides={})=>({
  id:"leg-1",subaccount:"default",productId:4,symbol:"ETH-PERP",side:"long",marginMode:"cross",
  size:"2",entryPrice:"2000",openedAt:null,updatedAt:null,...overrides,
});
const market=(overrides={})=>({
  productId:4,symbol:"ETH-PERP_USDT0",type:"perp",base:"ETH-PERP",quote:"USDT0",
  lastPrice:2500,change24h:-2,volume24h:1000,...overrides,
});
const snapshots={marketUpdatedAt:"2026-10-29T15:59:59.000Z",accountUpdatedAt:"2026-10-29T15:59:58.000Z"};
const simulate=(position=p(),ticker=market(),shock=-20)=>simulateNadoPosition(position,ticker,shock,snapshots,now);
const expected=(r)=>{assert.equal(r.ok,true,r.ok?"":r.reason);return r;};

test("Nado long loses quote PnL under negative price move",()=>{
  const r=expected(simulate());
  assert.equal(r.quote,"USDT0");
  assert.equal(r.shockedPrice,"2000");
  assert.equal(r.pnlChange,"-1000.00000000");
  assert.equal(r.referenceNotional,"5000.00000000");
});
test("short gains when price falls; long gains when price rises",()=>{
  assert.equal(expected(simulate(p({side:"short"}),market(),-20)).pnlChange,"1000.00000000");
  assert.equal(expected(simulate(p(),market(),20)).pnlChange,"1000.00000000");
  assert.equal(expected(simulate(p({side:"short"}),market(),20)).pnlChange,"-1000.00000000");
});
test("zero shock and fractional size are deterministic",()=>{
  assert.equal(expected(simulate(p({size:"0.001"}),market({lastPrice:0.125}),0)).pnlChange,"0.00000000");
  assert.equal(expected(simulate(p({size:"0.001"}),market({lastPrice:0.125}),50)).pnlChange,"0.00006250");
});
test("reject malformed inputs, mismatch, or out of range moves",()=>{
  for(const shock of [-51,51,1.5,NaN])assert.equal(simulate(p(),market(),shock).ok,false);
  assert.equal(simulate(p({size:"-1"})).ok,false);
  assert.equal(simulate(p({size:"not-a-number"})).ok,false);
  assert.equal(simulate(p(),market({lastPrice:0})).ok,false);
  assert.equal(simulate(p(),market({type:"spot"})).ok,false);
  assert.equal(simulate(p(),market({productId:5})).ok,false);
  assert.equal(simulate(p(),market({quote:""})).ok,false);
});
test("reject old or future-dated market and account snapshots",()=>{
  assert.equal(simulateNadoPosition(p(),market(),-10,{marketUpdatedAt:"2026-10-29T15:00:00Z",accountUpdatedAt:snapshots.accountUpdatedAt},now).ok,false);
  assert.equal(simulateNadoPosition(p(),market(),-10,{marketUpdatedAt:snapshots.marketUpdatedAt,accountUpdatedAt:"2026-10-29T16:01:00Z"},now).ok,false);
});
test("feed selector rejects partial accounts and positions that are absent",()=>{
  const account={chainId:57073,updatedAt:snapshots.accountUpdatedAt,incomplete:false,warnings:[],positions:[p()]};
  const markets={chainId:57073,updatedAt:snapshots.marketUpdatedAt,markets:[market()]};
  assert.equal(expected(simulateNadoFromFeeds(account,markets,nadoPositionKey(p()),-10,now)).pnlChange,"-500.00000000");
  assert.equal(simulateNadoFromFeeds({...account,incomplete:true},markets,nadoPositionKey(p()),-10,now).ok,false);
  assert.equal(simulateNadoFromFeeds(account,{...markets,chainId:1},nadoPositionKey(p()),-10,now).ok,false);
  assert.equal(simulateNadoFromFeeds(account,markets,"not-present",-10,now).ok,false);
});
