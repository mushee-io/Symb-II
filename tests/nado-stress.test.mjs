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
  const account={address:"0x0000000000000000000000000000000000000001",
    chainId:57073,updatedAt:snapshots.accountUpdatedAt,incomplete:false,
    positionCoverageComplete:true,warnings:[],positions:[p()]};
  const markets={chainId:57073,updatedAt:snapshots.marketUpdatedAt,markets:[market()]};
  assert.equal(expected(simulateNadoFromFeeds(account,markets,nadoPositionKey(p()),-10,now)).pnlChange,"-500.00000000");
  assert.equal(simulateNadoFromFeeds({...account,positionCoverageComplete:false},markets,nadoPositionKey(p()),-10,now).ok,false);
  // Older orders being paginated is unrelated to the completeness of current positions.
  assert.equal(simulateNadoFromFeeds({...account,incomplete:true,warnings:["older orders not loaded"]},markets,nadoPositionKey(p()),-10,now).ok,true);
  assert.equal(simulateNadoFromFeeds(account,{...markets,chainId:1},nadoPositionKey(p()),-10,now).ok,false);
  assert.equal(simulateNadoFromFeeds(account,markets,"not-present",-10,now).ok,false);
});

const address="0x0000000000000000000000000000000000000001";
const feeds=()=>({
  account:{address,chainId:57073,updatedAt:snapshots.accountUpdatedAt,
    incomplete:false,positionCoverageComplete:true,warnings:[],positions:[p()]},
  markets:{chainId:57073,updatedAt:snapshots.marketUpdatedAt,markets:[market()]},
});
test("conflicting or duplicated Nado product identities cannot generate what-if PnL",()=>{
 const original=feeds();
 const key=nadoPositionKey(p());
 for(const change of [
  {account:{...original.account,positions:[p(),p()]}},
  {markets:{...original.markets,markets:[market(),market()]}},
  {account:{...original.account,address:"not-wallet"}},
  {account:{...original.account,positions:[p({symbol:"BTC-PERP"})]}},
  {account:{...original.account,positions:[p({entryPrice:"0"})]}},
  {account:{...original.account,positions:[p({marginMode:"isolated"})]}},
  {markets:{...original.markets,markets:[market({symbol:"BTC-PERP_USDT0"})]}},
 ]){
  const a=change.account??original.account;
  const m=change.markets??original.markets;
  assert.equal(simulateNadoFromFeeds(a,m,key,-20,now).ok,false);
 }
});
test("Nado ticker and account observations individually fresh but skewed over 60 sec are rejected",()=>{
 const original=feeds();
 const r=simulateNadoFromFeeds({
  ...original.account,updatedAt:new Date(now-85000).toISOString(),
 },original.markets,nadoPositionKey(p()),-20,now);
 assert.equal(r.ok,false);
});
test("exact ticker symbols with and without the product quote suffix remain supported",()=>{
 assert.equal(simulate(p(),market({symbol:"ETH-PERP"}),-20).ok,true);
 assert.equal(simulate(p(),market({symbol:"ETH-PERP_USDT0"}),-20).ok,true);
 assert.equal(simulate(p(),market({symbol:"ETH-PERP_USDC"}),-20).ok,false);
});
