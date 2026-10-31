import {test} from "node:test";
import assert from "node:assert/strict";
import {atomicAmount,previewTydroAction} from "../lib/tydro/action-preview.ts";
const NOW=1_800_000_000_000;
const WALLET="0x1234567890123456789012345678901234567890";
const ASSET="0x1234567890123456789012345678901234567891";
const POOL="0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA";
const reserve={
 address:ASSET,symbol:"TEST",decimals:6,supplied:"10000.5",borrowed:"300",
 supplyAprPct:1,borrowAprPct:3,ltvPct:70,liquidationThresholdPct:80,
 collateralEligible:true,borrowEnabled:true,active:true,frozen:false,
};
const markets={
 source:"Tydro (Aave V3 Ink) contracts",chainId:57073,
 pool:POOL,updatedAt:new Date(NOW).toISOString(),reserves:[reserve],
 warnings:[],incomplete:false,
};
const user={address:ASSET,symbol:"TEST",decimals:6,supplied:"10.500001",
 variableDebt:"5.250001",stableDebt:"0",usingAsCollateral:true,
 liquidationThresholdBps:8000,oraclePriceRaw:"100000000",
};
const account={
 source:"Tydro (Aave V3 Ink) contracts",chainId:57073,
 pool:POOL,address:WALLET,updatedAt:new Date(NOW).toISOString(),
 collateralBase:"100",debtBase:"10",availableBorrowsBase:"25",
 baseCurrency:"Oracle base units",healthFactor:"2.0",userEModeCategory:0,
 oraclePriceDecimals:8,liquidationThresholdPct:80,ltvPct:70,
 userReserves:[user],warnings:[],incomplete:false,
};
const make=(patch={})=>previewTydroAction({
 action:"withdraw",asset:ASSET,amount:"3",wallet:WALLET,markets,account,now:NOW,...patch,
});
test("token amounts use exact decimal units without float rounding or scientific notation",()=>{
 assert.equal(atomicAmount("1.000001",6),1000001n);
 assert.equal(atomicAmount("0.000001",6),1n);
 for(const input of ["0","0.000000","-1","1e6","0.0000001","1.2345678",
  "Infinity","NaN"," 1","1 ",".1","01.2","1.2.3"])
  assert.equal(atomicAmount(input,6),null,input);
});
test("a valid read-only Tydro draft reports observations but never unlocks transactions",()=>{
 for(const action of ["supply","withdraw","borrow","repay"]){
  const result=make({action,amount:"2.1"});
  assert.equal(result.state,"blocked");
  assert.equal(result.executionEnabled,false);
  assert.equal(result.simulationVerified,false);
  assert.equal(result.transactionPayload,null);
  assert.equal(result.signatureRequested,false);
  assert.equal(result.chainId,57073);
  assert.equal(result.atomicUnits,"2100000");
  assert.ok(result.gates.some(g=>g.status==="unknown"));
  assert.ok(result.gates.some(g=>g.status==="blocked"));
 }
});
test("position exceeding reported supply or variable debt is blocked",()=>{
 for(const action of ["withdraw","repay"]){
  const result=make({action,amount:"100"});
  const bound=result.gates.find(g=>g.name==="Reported position amount");
  assert.equal(bound?.status,"blocked");
  assert.equal(result.executionEnabled,false);
 }
});
test("wrong account, stale sources, incomplete reserves and frozen assets fail closed",()=>{
 const changes=[
  {wallet:"0x000000000000000000000000000000000000dEaD"},
  {account:{...account,chainId:1}},
  {account:{...account,updatedAt:new Date(NOW-100000).toISOString()}},
  {markets:{...markets,updatedAt:new Date(NOW-100000).toISOString()}},
  {markets:{...markets,pool:"0x000000000000000000000000000000000000dEaD"}},
  {markets:{...markets,warnings:["oracle unavailable"]}},
  {markets:{...markets,reserves:[{...reserve,frozen:true}]}},
  {account:{...account,incomplete:true}},
  {asset:"0x000000000000000000000000000000000000dEaD"},
 ];
 for(const patch of changes){
  const result=make(patch);
  assert.ok(result.gates.some(g=>g.status==="blocked"),JSON.stringify(patch));
  assert.equal(result.executionEnabled,false);
  assert.equal(result.transactionPayload,null);
 }
});
test("borrow capacity or health cannot be inferred from account base units",()=>{
 const result=make({action:"borrow",amount:"0.01"});
 assert.equal(result.gates.find(g=>g.name==="Post-action collateral and health simulation")?.status,"unknown");
 assert.equal(result.state,"blocked");
});
test("no user-reserve evidence is not interpreted as zero risk or authenticated approval",()=>{
 const result=make({account:{...account,userReserves:[]},action:"repay"});
 assert.equal(result.gates.find(g=>g.name==="Reported position amount")?.status,"unknown");
 assert.equal(result.gates.find(g=>g.name==="Wallet proof and user approval")?.status,"unknown");
});
