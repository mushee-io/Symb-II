import test from "node:test";
import assert from "node:assert/strict";
import {normalizeNadoCandles,calculateCandleIndicators,CANDLE_INTERVALS} from "../lib/trading/candles.ts";
const now=1_800_000_000_000;
const bar=(time,open=100,high=110,low=95,close=104,volume=25)=>({
 time:String(time),open:String(open),high:String(high),low:String(low),close:String(close),volume:String(volume)
});
test("supports exactly the bounded public historical periods",()=>{
 assert.deepEqual(Object.keys(CANDLE_INTERVALS),["1m","5m","15m","1h","4h","1d"]);
 assert.throws(()=>normalizeNadoCandles([],2,"2m",now));
});
test("normalizes real provider-shaped bars to ascending timestamp order",()=>{
 const a=1_799_999_900,b=a+60;
 const value=normalizeNadoCandles([bar(b),bar(a)],2,"1m",now);
 assert.equal(value.candles.length,2);
 assert.deepEqual(value.candles.map(c=>c.time),[a,b]);
 assert.equal(value.incomplete,false);
 assert.equal(value.executionEnabled,false);
 assert.equal(value.source,"Nado official indexer");
});
test("rejects fabricated invalid OHLC volume timestamp and duplicate bars",()=>{
 const t=1_799_999_940;
 const r=normalizeNadoCandles([
 bar(t),bar(t),
 bar(t+60,101,90,80,100,1),
 bar(t+120,101,110,96,100,-1),
 bar(t+180,101,110,96,100,Infinity),
 bar(0),
 ],2,"1m",now);
 assert.equal(r.candles.length,1);
 assert.equal(r.incomplete,true);
 assert.ok(r.warnings.length>0);
});
test("never fabricates candles or fills holes",()=>{
 const t=1_799_990_000;
 const r=normalizeNadoCandles([bar(t),bar(t+300)],2,"1m",now);
 assert.equal(r.candles.length,2);
 assert.ok(r.warnings.some(w=>w.includes("missing time intervals")));
});
test("calculates simple SMA only from twenty actual OHLC closes",()=>{
 const t=1_799_997_000;
 const c=Array.from({length:20},(_,i)=>({time:t+i*60,open:100+i,high:110+i,low:90+i,close:100+i,volume:10}));
 assert.equal(calculateCandleIndicators(c.slice(0,19)),null);
 const r=calculateCandleIndicators(c);
 assert.equal(r?.sma20,109.5);
 assert.equal(r?.rangeHigh,129);
 assert.equal(r?.rangeLow,90);
});
