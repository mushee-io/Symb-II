import {test} from "node:test";
import assert from "node:assert/strict";
import {assessTydroPreflightSources} from "../lib/preflight/tydro-source-policy.ts";
import {TYDRO} from "../lib/tydro/contracts.ts";

const now=Date.parse("2026-10-30T19:40:00.000Z");
const updatedAt=new Date(now-2000).toISOString();
const wallet="0x0000000000000000000000000000000000000001";
const asset="0x0000000000000000000000000000000000000003";
function fixtures(){
 const reserve={
  address:asset,symbol:"USDC",decimals:6,supplied:"1000",borrowed:"300",
  supplyAprPct:1,borrowAprPct:3,ltvPct:75,liquidationThresholdPct:80,
  collateralEligible:true,borrowEnabled:true,active:true,frozen:false,
 };
 const borrower={
  address:asset,symbol:"USDC",decimals:6,
  supplied:"100",stableDebt:"0",variableDebt:"50",
  liquidationThresholdBps:8000,usingAsCollateral:true,
  oraclePriceRaw:"100000000",
 };
 return {
  wallet,asset,now,
  account:{
   source:"Tydro (Aave V3 Ink) contracts",chainId:57073,address:wallet,
   pool:TYDRO.pool,updatedAt,collateralBase:"100",debtBase:"50",
   availableBorrowsBase:"30",baseCurrency:"Oracle base units",
   healthFactor:"1.5",userEModeCategory:0,oraclePriceDecimals:8,
   liquidationThresholdPct:80,ltvPct:75,
   userReserves:[borrower],warnings:[],incomplete:false,
  },
  markets:{
   source:"Tydro (Aave V3 Ink) contracts",chainId:57073,
   pool:TYDRO.pool,updatedAt,reserves:[reserve],warnings:[],
   incomplete:false,
  },
 };
}
const assess=changes=>assessTydroPreflightSources({...fixtures(),...changes});
test("same account wallet, Ink chain, Pool, reserve and fresh source times qualify for read-only screening",()=>{
 const result=assess();
 assert.equal(result.valid,true);
 assert.equal(JSON.stringify(result).includes("50"),false);
 assert.equal(JSON.stringify(result).includes(wallet),false);
 assert.equal(JSON.stringify(result).includes("executionEnabled"),false);
});
test("mismatched wallet, chain or pinned Pool fails before any positive preflight",()=>{
 const original=fixtures();
 for(const change of [
  {wallet:"0x0000000000000000000000000000000000000002"},
  {account:{...original.account,address:"0x0000000000000000000000000000000000000002"}},
  {account:{...original.account,chainId:1}},
  {markets:{...original.markets,chainId:1}},
  {account:{...original.account,pool:"0x0000000000000000000000000000000000000002"}},
  {markets:{...original.markets,pool:"0x0000000000000000000000000000000000000002"}},
 ]){
  assert.equal(assess(change).valid,false,JSON.stringify(change).slice(0,100));
 }
});
test("unique debt asset is mandatory in both Tydro account and market inventories",()=>{
 const f=fixtures();
 for(const change of [
  {account:{...f.account,userReserves:[]}},
  {markets:{...f.markets,reserves:[]}},
  {markets:{...f.markets,reserves:[f.markets.reserves[0],f.markets.reserves[0]]}},
  {account:{...f.account,userReserves:[f.account.userReserves[0],f.account.userReserves[0]]}},
  {account:{...f.account,userReserves:[{...f.account.userReserves[0],address:"0x0000000000000000000000000000000000000004"}]}},
  {markets:{...f.markets,reserves:[{...f.markets.reserves[0],address:"0x0000000000000000000000000000000000000004"}]}},
  {markets:{...f.markets,reserves:[{...f.markets.reserves[0],decimals:18}]}},
  {account:{...f.account,userReserves:[{...f.account.userReserves[0],symbol:"USDT"}]}},
 ]){
  assert.equal(assess(change).valid,false,JSON.stringify(change).slice(0,100));
 }
});
test("incomplete or contradictory source metadata can never qualify",()=>{
 const f=fixtures();
 for(const change of [
  {account:{...f.account,warnings:["missing reserve"]}},
  {markets:{...f.markets,warnings:["partial"]}},
  {account:{...f.account,incomplete:true}},
  {markets:{...f.markets,incomplete:true}},
  {markets:{...f.markets,reserves:[{...f.markets.reserves[0],decimals:37}]}},
  {markets:{...f.markets,reserves:[{...f.markets.reserves[0],active:"true"}]}},
  {account:{...f.account,userReserves:[{...f.account.userReserves[0],variableDebt:"NaN"}]}},
  {account:{...f.account,userReserves:[{...f.account.userReserves[0],oraclePriceRaw:"0"}]}},
 ]){
  assert.equal(assess(change).valid,false);
 }
});
test("Tydro account and market snapshots cannot be independently fresh yet too far apart",()=>{
 const f=fixtures();
 const older=new Date(now-80000).toISOString();
 assert.equal(assess({account:{...f.account,updatedAt:older}}).valid,false);
 assert.equal(assess({markets:{...f.markets,updatedAt:older}}).valid,false);
 const acceptable=new Date(now-58000).toISOString();
 assert.equal(assess({account:{...f.account,updatedAt:acceptable}}).valid,true);
 assert.equal(assess({markets:{...f.markets,updatedAt:acceptable}}).valid,true);
});
test("an initially valid report fails after asynchronous RPC work makes the source stale",()=>{
 const f=fixtures();
 assert.equal(assessTydroPreflightSources(f).valid,true);
 assert.equal(assessTydroPreflightSources({...f,now:now+90000}).valid,false);
 assert.equal(assessTydroPreflightSources({...f,now:Number.NaN}).valid,false);
 assert.equal(assessTydroPreflightSources({...f,now:now-8000}).valid,false);
});
