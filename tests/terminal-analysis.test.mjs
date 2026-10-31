import test from "node:test";
import assert from "node:assert/strict";
import {reviewMarketEvidence} from "../lib/trading/analysis.ts";

const now=1_800_000_000_000;
const candles=Array.from({length:24},(_,i)=>({
 time:Math.floor(now/1000)-3600+900*i,
 open:100+i,high:110+i,low:90+i,close:101+i,volume:10,
}));
// Last candle must be current; arrange a recent 24-candle 15-minute range.
const validCandles=Array.from({length:24},(_,i)=>({
 time:Math.floor(now/1000)-23*900+i*900,
 open:100+i,high:110+i,low:90+i,close:101+i,volume:10,
}));
const evidence={
 source:"Nado official indexer",chainId:57073,productId:2,interval:"15m",periodSeconds:900,
 observedAt:new Date(now).toISOString(),candles:validCandles,incomplete:false,warnings:[],executionEnabled:false,
};
const quote={
 observedAt:new Date(now).toISOString(),engineChainId:57073,
 engineEndpoint:"0x0000000000000000000000000000000000000001",
 productId:2,productType:"perp",oraclePrice:"100",
 priceIncrement:"0.01",sizeIncrement:"0.01",minSize:"0.01",
 bid:"125",ask:"126",warnings:[],
};
const base={productId:2,side:"long",notional:1000,leverage:2,candles:evidence,engine:quote,now};
test("synthesizes bounded market context using only two official sources",()=>{
 const r=reviewMarketEvidence(base);
 assert.equal(r.status,"observed");
 assert.equal(r.metrics?.referencePrice,126);
 assert.equal(r.metrics?.observedSpreadPct>0,true);
 assert.equal(r.metrics?.sma20>0,true);
 assert.equal(r.metrics?.observedVolume,240);
 assert.equal(r.executionEnabled,false);
 assert.equal(r.authenticated,false);
 assert.equal(r.simulationVerified,false);
});
test("fails closed on stale, wrong network, wrong product, wrong interval and missing source",()=>{
 const bad=[
  {...base,candles:null},
  {...base,engine:null},
  {...base,candles:{...evidence,chainId:1}},
  {...base,candles:{...evidence,productId:7}},
  {...base,candles:{...evidence,interval:"1h"}},
  {...base,candles:{...evidence,executionEnabled:true}},
  {...base,candles:{...evidence,incomplete:true,warnings:["missing"]}},
  {...base,candles:{...evidence,candles:validCandles.slice(0,10)}},
  {...base,engine:{...quote,engineChainId:1}},
  {...base,engine:{...quote,observedAt:new Date(now-180000).toISOString()}},
  {...base,notional:0},{...base,leverage:20},
 ];
 for(const item of bad){
  const result=reviewMarketEvidence(item);
  assert.equal(result.status,"insufficient",JSON.stringify(item).slice(0,120));
  assert.equal(result.metrics,null);
  assert.equal(result.executionEnabled,false);
 }
});
test("direction selects bid for short but never calls it an executable price",()=>{
 const r=reviewMarketEvidence({...base,side:"short"});
 assert.equal(r.status,"observed");
 assert.equal(r.metrics?.referencePrice,125);
 assert.equal(r.simulationVerified,false);
});
