import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateTydroShock } from "../lib/risk/stress.ts";

const account = () => ({
  source:"Tydro (Aave V3 Ink) contracts",
  chainId:57073, updatedAt:new Date(0).toISOString(), address:"0x0000000000000000000000000000000000000001",
  pool:"0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA",
  collateralBase:"2000",debtBase:"1000",availableBorrowsBase:"0",baseCurrency:"Oracle base units",
  healthFactor:"1.6", userEModeCategory:0,oraclePriceDecimals:8,
  liquidationThresholdPct:80,ltvPct:70,warnings:[],incomplete:false,
  userReserves:[
    {address:"0x0000000000000000000000000000000000000002",symbol:"WETH",decimals:18,liquidationThresholdBps:8000,
     oraclePriceRaw:"200000000000",supplied:"1",stableDebt:"0",variableDebt:"0",usingAsCollateral:true},
    {address:"0x0000000000000000000000000000000000000003",symbol:"USDC",decimals:6,liquidationThresholdBps:0,
     oraclePriceRaw:"100000000",supplied:"0",stableDebt:"0",variableDebt:"1000",usingAsCollateral:false},
  ],
});
const weth="0x0000000000000000000000000000000000000002";
const usdc="0x0000000000000000000000000000000000000003";
function ok(r){assert.equal(r.ok,true, r.ok?"":r.reason);return r;}

test("zero shock reproduces on-chain health factor",()=>{
  const r=ok(simulateTydroShock(account(),weth,0));
  assert.equal(r.currentHealthFactor,"1.6");
  assert.equal(r.projectedHealthFactor,"1.6");
  assert.equal(r.baselineDeviationBps,0);
});
test("falling collateral price reduces health factor and crosses threshold",()=>{
  const r=ok(simulateTydroShock(account(),weth,-50));
  assert.equal(r.projectedHealthFactor,"0.8");
  assert.equal(r.state,"urgent");
});
test("increasing debt-asset price reduces health factor",()=>{
  const r=ok(simulateTydroShock(account(),usdc,50));
  const x=Number(r.projectedHealthFactor);
  assert.ok(x<1.1&&x>1.06);
  assert.equal(r.state,"caution");
});
test("positive collateral shock increases health factor",()=>{
  const r=ok(simulateTydroShock(account(),weth,25));
  assert.equal(r.projectedHealthFactor,"2");
});
test("invalid or outside-range shocks are refused",()=>{
  for(const n of [-51,51,1.2,NaN]){
    assert.equal(simulateTydroShock(account(),weth,n).ok,false);
  }
});
test("unreconciled baseline is refused instead of false precision",()=>{
  const a=account();a.healthFactor="2.2";
  const r=simulateTydroShock(a,weth,-20);
  assert.equal(r.ok,false);
  assert.match(r.reason,/reconcile/);
});
test("emodes, stale partial inputs, unknown prices and no debt are blocked",()=>{
  const a=account();a.userEModeCategory=1;
  assert.equal(simulateTydroShock(a,weth,-20).ok,false);
  const b=account();b.warnings.push("Unknown reserve");
  assert.equal(simulateTydroShock(b,weth,-20).ok,false);
  const c=account();c.userReserves[0].oraclePriceRaw=null;
  assert.equal(simulateTydroShock(c,weth,-20).ok,false);
  const d=account();d.healthFactor=null;
  assert.equal(simulateTydroShock(d,weth,-20).ok,false);
});
test("other wallet assets cannot be selected",()=>{
  assert.equal(simulateTydroShock(account(),"0x0000000000000000000000000000000000000004",-20).ok,false);
});
