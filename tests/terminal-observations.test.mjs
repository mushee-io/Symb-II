import test from "node:test";
import assert from "node:assert/strict";
import {recordPriceObservation,chartPoints} from "../lib/trading/observations.ts";

const now=1_000_000;
test("records actual fresh price snapshots and deduplicates timestamp",()=>{
  const one=recordPriceObservation([],{productId:2,at:now-20_000,price:100},now);
  assert.equal(one.length,1);
  const again=recordPriceObservation(one,{productId:2,at:now-20_000,price:100},now);
  assert.equal(again.length,1);
  const next=recordPriceObservation(again,{productId:2,at:now-10_000,price:102},now);
  assert.deepEqual(chartPoints(next,2).map(x=>x.price),[100,102]);
});
test("rejects stale, future, impossible and fabricated zero-valued snapshots",()=>{
  const good=[{productId:2,at:now-20_000,price:100}];
  for(const bad of [
    {productId:2,at:now-200_000,price:100},
    {productId:2,at:now+100_000,price:100},
    {productId:2,at:now-1,price:0},
    {productId:2,at:now-1,price:Infinity},
    {productId:-2,at:now-1,price:100},
  ])assert.deepEqual(recordPriceObservation(good,bad,now),good);
});
test("does not combine histories across markets and caps observations",()=>{
  let history=[];
  for(let i=0;i<100;i++)history=recordPriceObservation(history,{productId:2,at:now-100+i,price:100+i},now);
  assert.equal(history.length,80);
  const other=recordPriceObservation(history,{productId:4,at:now-1,price:200},now);
  assert.deepEqual(chartPoints(other,4).map(p=>p.price),[200]);
  assert.equal(chartPoints(other,2).length,79);
});
