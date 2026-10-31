import test from "node:test";
import assert from "node:assert/strict";
import {assessTopOfBook} from "../lib/trading/quote.ts";
const now=1_000_000;
const good={observedAt:new Date(now-1000).toISOString(),engineChainId:57073,engineEndpoint:"0x0000000000000000000000000000000000000001",productId:2,productType:"perp",oraclePrice:"100",priceIncrement:"0.1",sizeIncrement:"0.01",minSize:"0.01",bid:"99",ask:"101",warnings:[]};
test("accepts official current non-crossed top-of-book without creating orders",()=>{
  const r=assessTopOfBook(good,2,now);
  assert.equal(r.status,"ready");
  if(r.status==="ready"){assert.equal(r.bid,99);assert.equal(r.ask,101);assert.equal(r.spreadPct,2);}
});
test("rejects wrong network, wrong asset, stale, crossed and incomplete quotes",()=>{
  const changes=[
    [{engineChainId:1},2],[{productId:4},2],[{observedAt:new Date(now-120000).toISOString()},2],
    [{bid:"102",ask:"101"},2],[{bid:null},2],[{warnings:["missing quote"]},2],
    [{productType:"spot"},2],[{ask:"Infinity"},2],[{bid:"-1"},2],
  ];
  for(const [patch,productId] of changes){
    assert.equal(assessTopOfBook({...good,...patch},productId,now).status,"unknown",JSON.stringify(patch));
  }
  assert.equal(assessTopOfBook(null,2,now).status,"unknown");
});
