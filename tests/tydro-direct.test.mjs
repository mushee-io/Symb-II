import {test} from "node:test";
import assert from "node:assert/strict";
import {reconcileTydroDirect} from "../lib/verification/tydro-direct.ts";
import {TYDRO} from "../lib/tydro/contracts.ts";
const now=Date.parse("2026-10-29T18:35:00Z"),updatedAt=new Date(now-5000).toISOString();
const a={chainId:57073,updatedAt,source:"Tydro",address:"0x0000000000000000000000000000000000000001",pool:TYDRO.pool,
 collateralBase:"100",debtBase:"50",availableBorrowsBase:"30",baseCurrency:"Oracle base units",
 healthFactor:"1.5",userEModeCategory:0,oraclePriceDecimals:8,
 liquidationThresholdPct:70,ltvPct:65,userReserves:[],warnings:[],incomplete:false};
const d={chainId:57073,observedAt:updatedAt,blockTimestamp:updatedAt,blockNumber:"123",blockHash:"0x"+"cd".repeat(32),
 verifiedProviderPool:TYDRO.pool,oracleBaseUnit:"100000000",
 collateralBaseRaw:"10000000000",debtBaseRaw:"5000000000",availableBorrowsBaseRaw:"3000000000",
 healthFactorRaw:"1500000000000000000",emodeCategory:"0"};
const compare=(v=a,w=d)=>reconcileTydroDirect(v,w,now);
test("independent Aave Pool reconciliation passes exact onchain data",()=>{
 const r=compare();assert.equal(r.state,"pass");assert.equal(r.matchedFields,5);assert.equal(r.comparedFields,5);
 assert.equal(JSON.stringify(r).includes("10000000000"),false);
});
test("detects mismatched debt, health factor and emode without exposing amounts",()=>{
 assert.equal(compare(a,{...d,debtBaseRaw:"9000000000"}).state,"fail");
 assert.equal(compare(a,{...d,healthFactorRaw:"1000000000000000000"}).state,"fail");
 assert.equal(compare(a,{...d,emodeCategory:"1"}).state,"fail");
});
test("fails wrong pool, oracle unit, chain and stale block",()=>{
 assert.equal(compare(a,{...d,verifiedProviderPool:"0x0000000000000000000000000000000000000001"}).state,"fail");
 assert.equal(compare(a,{...d,oracleBaseUnit:"1000000"}).state,"fail");
 assert.equal(compare(a,{...d,chainId:1}).state,"fail");
 assert.equal(reconcileTydroDirect(a,d,now+600000).state,"fail");
});
test("missing or malformed Ink block hashes never validate pinned Pool reads",()=>{
 for(const blockHash of ["","0x1234","0x"+"gg".repeat(32)]){
  assert.equal(compare(a,{...d,blockHash}).state,"fail");
 }
 assert.equal(compare(a,{...d,blockHash:"0x"+"ef".repeat(32)}).state,"pass");
});
test("partial adapter and missing contract observation cannot claim reconciliation",()=>{
 assert.equal(compare({...a,incomplete:true},d).state,"not-tested");
 assert.equal(compare({...a,warnings:["oracle unknown"]},d).state,"not-tested");
 assert.equal(reconcileTydroDirect(a,undefined,now).state,"not-tested");
});
test("no-debt accounts reconcile without inventing health-factor values",()=>{
 const empty={...a,debtBase:"0",healthFactor:null};
 const direct={...d,debtBaseRaw:"0",healthFactorRaw:(2n**256n-1n).toString()};
 assert.equal(compare(empty,direct).state,"pass");
 assert.equal(compare({...empty,healthFactor:"1"},direct).state,"fail");
});
test("bounded accrued interest tolerance, no floating-point rounding",()=>{
 assert.equal(compare(a,{...d,debtBaseRaw:"5005000000"}).state,"pass");
 assert.equal(compare(a,{...d,debtBaseRaw:"5020000000"}).state,"fail");
});

test("malformed account eMode fails cleanly rather than throwing from BigInt conversion",()=>{
 for(const invalid of [Number.NaN,-1,0.5,"not-a-number"]){
  assert.equal(compare({...a,userEModeCategory:invalid},d).state,"fail");
 }
});
