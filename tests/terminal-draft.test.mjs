import test from "node:test";
import assert from "node:assert/strict";
import {parseTerminalCommand,calculateDraftIllustration} from "../lib/trading/order-draft.ts";

const markets=[
  {productId:1,symbol:"BTC-PERP",base:"BTC",quote:"USDT0",type:"perp",lastPrice:65000,change24h:0,volume24h:100000},
  {productId:2,symbol:"ETH-PERP",base:"ETH",quote:"USDT0",type:"perp",lastPrice:3000,change24h:0,volume24h:100000},
];
test("parses an explicit desktop-agent instruction without creating a transaction",()=>{
  const result=parseTerminalCommand("Prepare a $500 BTC long at 2x",markets);
  assert.deepEqual(result,{ok:true,market:markets[0],side:"long",notional:500,leverage:2});
});
test("supports shorts and uses a bounded fallback leverage",()=>{
  const result=parseTerminalCommand("short ETH for $250",markets,3);
  assert.equal(result.ok,true);
  if(result.ok){assert.equal(result.side,"short");assert.equal(result.leverage,3);assert.equal(result.market.productId,2);}
});
test("rejects incomplete or unsupported instructions",()=>{
  for(const instruction of ["", "Buy something", "Long SOL for $200", "BTC $500 2x", "short BTC at 2x"]){
    assert.equal(parseTerminalCommand(instruction,markets).ok,false,instruction);
  }
});
test("rejects invalid notionals and excessive leverage",()=>{
  for(const instruction of ["long BTC $0 2x","long BTC $100 0x","long BTC $100 11x"]){
    assert.equal(parseTerminalCommand(instruction,markets).ok,false,instruction);
  }
});
test("illustration is arithmetic only and refuses invalid prices or leverage",()=>{
  assert.deepEqual(calculateDraftIllustration(500,2,100),{
    simpleMarginDivision:250,approximateQuantity:5,grossOnePercentMove:5,
  });
  assert.equal(calculateDraftIllustration(500,2,0),null);
  assert.equal(calculateDraftIllustration(500,11,100),null);
  assert.equal(calculateDraftIllustration(Number.NaN,2,100),null);
});
