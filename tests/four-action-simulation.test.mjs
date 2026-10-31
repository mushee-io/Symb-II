import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {parseTydroSimulationInput,exactAtomicAmount} from "../lib/tydro/four-action-simulation.ts";

const wallet="0x3f90f099af21b96b4e58b36f630bc88326417de2";
const asset="0x000000000000000000000000000000000000dEaD";

test("each of four Tydro operations has strictly bounded request parsing",()=>{
 for(const action of ["supply","withdraw","borrow","repay"]){
  const r=parseTydroSimulationInput({wallet,asset,amount:"1.000001",action});
  assert.equal(r?.action,action);
  assert.equal(r?.amount,"1.000001");
 }
});

test("invalid methods, extra keys, mismatched addresses and numeric shortcuts fail",()=>{
 const original={wallet,asset,amount:"1",action:"repay"};
 for(const invalid of [
  {action:"approve"},{action:"liquidate"},{amount:"1e6"},
  {amount:"-1"},{amount:"01"},{amount:"1."},{amount:"Infinity"},
  {asset:"0x123"},{wallet:"0x123"},{amount:"9".repeat(91)},
  {injected:"sign"},
 ]){
  assert.equal(parseTydroSimulationInput({...original,...invalid}),null,
    JSON.stringify(invalid));
 }
 for(const input of [null,[],true,"x",{}])
  assert.equal(parseTydroSimulationInput(input),null);
});

test("exact atomic-unit calculations cannot round, overflow or accept zero",()=>{
 assert.equal(exactAtomicAmount("0.000001",6),1n);
 assert.equal(exactAtomicAmount("1.25",6),1250000n);
 for(const candidate of ["0","0.0","0.0000001","1e3","-2","01","1.","1.2345678"]){
  assert.equal(exactAtomicAmount(candidate,6),null,candidate);
 }
 assert.equal(exactAtomicAmount("1",37),null);
 assert.equal(exactAtomicAmount("9".repeat(90),18),null);
});

test("new preflight module cannot request wallet signatures or send funds",()=>{
 const source=readFileSync("lib/tydro/four-action-simulation.ts","utf8");
 const route=readFileSync("app/api/tydro/simulate/route.ts","utf8");
 for(const item of ["writeContract(","sendTransaction(","signTypedData(",
   "eth_sendRawTransaction","privateKeyToAccount("]){
  assert.ok(!source.includes(item),item+" must not appear in simulator");
  assert.ok(!route.includes(item),item+" must not appear in API");
 }
 assert.match(source,/executionEnabled:false/);
 assert.match(source,/transactionPayload:null/);
 assert.match(route,/isPreflightConfigured/);
 assert.match(route,/acquireLimit/);
});
