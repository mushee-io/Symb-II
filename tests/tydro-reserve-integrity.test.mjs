import {test} from "node:test";
import assert from "node:assert/strict";
import {validTydroReserveInventory} from "../lib/verification/tydro-reserve-integrity.ts";
import {assessWalletVerification} from "../lib/verification/account.ts";
import {TYDRO} from "../lib/tydro/contracts.ts";

const wallet="0x0000000000000000000000000000000000000001";
const now=Date.parse("2026-10-30T19:30:00.000Z");
const observedAt=new Date(now-2000).toISOString();
const one={address:"0x0000000000000000000000000000000000000003",
 symbol:"USDC",supplied:"100",variableDebt:"50",stableDebt:"0",
 decimals:6,liquidationThresholdBps:8000,usingAsCollateral:true,
 oraclePriceRaw:"100000000"};
const account=()=>({
 source:"Tydro (Aave V3 Ink) contracts",chainId:57073,updatedAt:observedAt,
 address:wallet,pool:TYDRO.pool,collateralBase:"100",debtBase:"50",
 availableBorrowsBase:"30",healthFactor:"1.5",baseCurrency:"Oracle base units",
 userEModeCategory:0,oraclePriceDecimals:8,liquidationThresholdPct:80,ltvPct:70,
 userReserves:[{...one}],warnings:[],incomplete:false
});
const direct={
 chainId:57073,observedAt,blockTimestamp:observedAt,blockNumber:"123",
 blockHash:"0x"+"cd".repeat(32),verifiedProviderPool:TYDRO.pool,
 oracleBaseUnit:"100000000",collateralBaseRaw:"10000000000",
 debtBaseRaw:"5000000000",availableBorrowsBaseRaw:"3000000000",
 healthFactorRaw:"1500000000000000000",emodeCategory:"0",
};
const assess=tydro=>assessWalletVerification({
 wallet,connectionChainId:57073,now,
 rpc:{status:"success",data:{chainId:57073,blockNumber:"123",
  blockHash:"0x"+"ab".repeat(32),blockTimestamp:observedAt,
  observedAt,code:"0x",nativeBalanceWei:"0"}},
 nado:{status:"error"},tydro:{status:"success",data:tydro},
 tydroDirect:{status:"success",data:direct},
});
test("unique valid Tydro reserve balances support read-only variable debt reconciliation",()=>{
 const a=account();
 assert.equal(validTydroReserveInventory(a),true);
 const report=assess(a);
 assert.equal(report.checks.find(c=>c.id==="tydro").state,"pass");
 assert.equal(report.checks.find(c=>c.id==="tydro-variable-debt").state,"pass");
 assert.equal(report.canExecute,false);
 assert.equal(report.completeRealWalletValidation,false);
});
test("two reserve rows for the same asset cannot masquerade as two borrow sources",()=>{
 const a=account();
 a.userReserves.push({...one,address:one.address.toUpperCase().replace("0X","0x")});
 assert.equal(validTydroReserveInventory(a),false);
 const report=assess(a);
 assert.equal(report.checks.find(c=>c.id==="tydro").state,"fail");
 assert.equal(report.checks.find(c=>c.id==="tydro-variable-debt").state,"fail");
});
test("malformed reserve monetary fields, decimals and liquidation configuration fail closed",()=>{
 const edits=[
  {variableDebt:"NaN"},{stableDebt:"-1"},{supplied:"Infinity"},
  {decimals:-1},{decimals:37},{decimals:6.5},
  {liquidationThresholdBps:10001},{liquidationThresholdBps:-1},
  {oraclePriceRaw:"0"},{oraclePriceRaw:"not-price"},
  {address:"not-an-address"},{symbol:""},{usingAsCollateral:"true"},
 ];
 for(const change of edits){
  const a=account();a.userReserves=[{...one,...change}];
  assert.equal(validTydroReserveInventory(a),false,JSON.stringify(change));
  const report=assess(a);
  assert.equal(report.checks.find(c=>c.id==="tydro").state,"fail",JSON.stringify(change));
  assert.equal(report.checks.find(c=>c.id==="tydro-variable-debt").state,"fail",JSON.stringify(change));
 }
});
test("unsupported oversized reserve lists are not accepted even if each entry looks valid",()=>{
 const a=account();a.userReserves=Array.from({length:33},(_,i)=>({
  ...one,address:"0x"+String(i+1).padStart(40,"0"),
 }));
 assert.equal(validTydroReserveInventory(a),false);
});
test("an empty Tydro reserve list is structurally valid but cannot prove any active debt",()=>{
 const a={...account(),userReserves:[],debtBase:"0",healthFactor:null,
  collateralBase:"0",availableBorrowsBase:"0"};
 assert.equal(validTydroReserveInventory(a),true);
 const result=assess(a);
 assert.equal(result.checks.find(c=>c.id==="tydro-variable-debt").state,"not-tested");
});
