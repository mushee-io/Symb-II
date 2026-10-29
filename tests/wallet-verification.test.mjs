import {test} from "node:test";
import assert from "node:assert/strict";
import {assessWalletVerification} from "../lib/verification/account.ts";
const wallet="0x0000000000000000000000000000000000000001";
const now=Date.parse("2026-10-29T19:00:00Z");
const observedAt=new Date(now-2000).toISOString();
const rpc={status:"success",data:{chainId:57073,blockNumber:"123",blockTimestamp:observedAt,
 code:"0x",nativeBalanceWei:"0",observedAt}};
const nado={status:"success",data:{address:wallet,chainId:57073,updatedAt:observedAt,
 source:"Nado engine + indexer",positions:[],subaccounts:[],subaccountHealth:[],openOrders:[],
 indexedOrders:[],incomplete:false,positionCoverageComplete:true,warnings:[]}};
const tydro={status:"success",data:{address:wallet,chainId:57073,updatedAt:observedAt,
 source:"Tydro (Aave V3 Ink) contracts",pool:"0x0000000000000000000000000000000000000002",
 healthFactor:null,collateralBase:"0",debtBase:"0",availableBorrowsBase:"0",baseCurrency:"Oracle base units",
 userEModeCategory:0,oraclePriceDecimals:8,liquidationThresholdPct:0,ltvPct:0,
 userReserves:[],warnings:[],incomplete:false}};
const make=(extra={})=>assessWalletVerification({
 wallet,connectionChainId:57073,rpc,nado,tydro,now,...extra
});
test("valid empty wallet is not falsely called a full real-wallet test",()=>{
 const x=make();
 assert.equal(x.checks.find(c=>c.id==="nado").state,"pass");
 assert.equal(x.checks.find(c=>c.id==="nado-open-position").state,"not-tested");
 assert.equal(x.checks.find(c=>c.id==="tydro-variable-debt").state,"not-tested");
 assert.equal(x.ownerProved,false);
 assert.equal(x.completeRealWalletValidation,false);
 assert.equal(x.canExecute,false);
});
test("unreconciled positions and debt never pass on API claims alone",()=>{
 const position={id:"p",subaccount:"main",productId:2,marginMode:"cross",
  symbol:"ETH-PERP",size:"10",side:"long",entryPrice:"100",openedAt:null,updatedAt:null};
 const n={...nado,data:{...nado.data,positions:[position],subaccounts:["main"],
  subaccountHealth:[{subaccount:"main",exists:true,maintenanceHealth:"100",
  initialHealth:"100",maintenanceAssets:"200",maintenanceLiabilities:"100"}]}};
 const t={...tydro,data:{...tydro.data,debtBase:"1.5",userReserves:[{
  address:"0x0000000000000000000000000000000000000003",
  symbol:"USDC",variableDebt:"1.5",stableDebt:"0",supplied:"0",
  decimals:6,liquidationThresholdBps:0,usingAsCollateral:false,oraclePriceRaw:null
 }]}};
 const x=make({nado:n,tydro:t});
 assert.equal(x.checks.find(c=>c.id==="nado-open-position").state,"not-tested");
 assert.equal(x.checks.find(c=>c.id==="tydro-variable-debt").state,"not-tested");
 assert.equal(x.completeRealWalletValidation,false);
});
test("contradictory reserve debt and account debt fail rather than pass",()=>{
 const t={...tydro,data:{...tydro.data,debtBase:"0",userReserves:[{
  address:"0x0000000000000000000000000000000000000003",
  symbol:"USDC",variableDebt:"0.0000000000000000000000001",stableDebt:"0",supplied:"0",
  decimals:6,liquidationThresholdBps:0,usingAsCollateral:false,oraclePriceRaw:null
 }]}};
 const x=make({tydro:t});
 assert.equal(x.checks.find(c=>c.id==="tydro-variable-debt").state,"fail");
});
test("invalid RPC observation cannot qualify as live Ink verification",()=>{
 const x=make({rpc:{...rpc,data:{...rpc.data,observedAt:"not-a-date"}}});
 assert.equal(x.checks.find(c=>c.id==="rpc").state,"fail");
});
test("wrong chain and mismatching wallet fail closed",()=>{
 const x=make({connectionChainId:1,
  nado:{...nado,data:{...nado.data,address:"0x0000000000000000000000000000000000000002"}}});
 assert.equal(x.checks.find(c=>c.id==="connection").state,"fail");
 assert.equal(x.checks.find(c=>c.id==="nado").state,"fail");
 assert.equal(x.checks.find(c=>c.id==="nado-open-position").state,"not-tested");
});
test("stale or partial accounts are not considered verified",()=>{
 const x=make({now:now+400000,tydro:{...tydro,data:{...tydro.data,incomplete:true}}});
 assert.equal(x.checks.find(c=>c.id==="rpc").state,"fail");
 assert.equal(x.checks.find(c=>c.id==="tydro").state,"fail");
 assert.equal(x.checks.find(c=>c.id==="nado").state,"fail");
});
test("read-only RPC failure never implies safe identity verification",()=>{
 const x=make({rpc:{status:"error"}});
 assert.equal(x.checks.find(c=>c.id==="rpc").state,"fail");
 assert.equal(x.checks.find(c=>c.id==="code").state,"fail");
 assert.equal(x.checks.find(c=>c.id==="wallet-signature").state,"not-tested");
});
test("export excludes raw positions, balances, permissions and private keys",()=>{
 const x=make();const serialized=JSON.stringify(x);
 assert.equal(serialized.includes("nativeBalanceWei"),false);
 assert.equal(serialized.includes("privateKey"),false);
 assert.equal(serialized.includes('"canExecute":false'),true);
});

test("M8 independent Tydro Pool status is explicitly not tested without a second contract read",()=>{
 const x=make();
 assert.equal(x.checks.find(c=>c.id==="tydro-independent-pool").state,"not-tested");
 assert.equal(x.completeRealWalletValidation,false);
});

test("Nado product consistency is separately not-tested without a market read",()=>{
 const x=make();
 assert.equal(x.checks.find(c=>c.id==="nado-position-market").state,"not-tested");
});
test("Nado cross-check does not claim a valid position when product reference is missing",()=>{
 const pos={id:"p",subaccount:"main",productId:3,marginMode:"cross",symbol:"ETH-PERP",
  size:"1000000000000000000",side:"long",entryPrice:"2500",openedAt:null,updatedAt:null};
 const a={...nado,data:{...nado.data,positions:[pos],subaccounts:["main"],
  subaccountHealth:[{subaccount:"main",exists:true,initialHealth:"100",maintenanceHealth:"100",
   maintenanceAssets:"200",maintenanceLiabilities:"100"}]}};
 const markets={status:"success",data:{source:"Nado indexer",chainId:57073,updatedAt:observedAt,markets:[]}};
 const result=make({nado:a,nadoMarkets:markets});
 assert.equal(result.checks.find(c=>c.id==="nado-position-market").state,"fail");
 assert.equal(result.completeRealWalletValidation,false);
});
