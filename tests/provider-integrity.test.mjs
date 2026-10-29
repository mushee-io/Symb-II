import {test} from "node:test";
import assert from "node:assert/strict";
import {assessNadoMarketIntegrity,assessTydroMarketIntegrity} from "../lib/ops/provider-integrity.ts";
import {TYDRO} from "../lib/tydro/contracts.ts";

const now=Date.parse("2026-10-29T19:55:00Z");
const updatedAt=new Date(now-2000).toISOString();
const nado=()=>({source:"Nado indexer",chainId:57073,updatedAt,markets:[
 {productId:1,symbol:"ETH-PERP",type:"perp",base:"ETH",quote:"USD",lastPrice:2500,volume24h:200,change24h:1.5},
 {productId:2,symbol:"BTC",type:"spot",base:"BTC",quote:"USD",lastPrice:67000,volume24h:100,change24h:0},
]});
const tydro=()=>({source:"Tydro (Aave V3 Ink) contracts",chainId:57073,
 updatedAt,pool:TYDRO.pool,warnings:[],incomplete:false,reserves:[
 {address:"0x0000000000000000000000000000000000000001",symbol:"USDC",decimals:6,
 supplied:"120.5",borrowed:"99",supplyAprPct:2,borrowAprPct:4,
 ltvPct:78,liquidationThresholdPct:80,
 collateralEligible:true,borrowEnabled:true,active:true,frozen:false},
]});
test("accept bounded Nado and Tydro read-only snapshots",()=>{
 assert.equal(assessNadoMarketIntegrity(nado(),now).valid,true);
 assert.equal(assessTydroMarketIntegrity(tydro(),now).valid,true);
});
test("Nado rejects duplicate product IDs, wrong chain, zero prices and stale responses",()=>{
 assert.equal(assessNadoMarketIntegrity({...nado(),chainId:1},now).valid,false);
 assert.equal(assessNadoMarketIntegrity({...nado(),markets:[nado().markets[0],nado().markets[0]]},now).valid,false);
 assert.equal(assessNadoMarketIntegrity({...nado(),markets:[{...nado().markets[0],lastPrice:0}]},now).valid,false);
 assert.equal(assessNadoMarketIntegrity({...nado(),updatedAt:new Date(now-500000).toISOString()},now).valid,false);
 assert.equal(assessNadoMarketIntegrity({...nado(),markets:[{...nado().markets[0],type:"spot"}]},now).valid,false);
});
test("Tydro refuses partial reserves, wrong Pool, stale data or invalid decimals",()=>{
 assert.equal(assessTydroMarketIntegrity({...tydro(),incomplete:true},now).valid,false);
 assert.equal(assessTydroMarketIntegrity({...tydro(),warnings:["one reserve failed"]},now).valid,false);
 assert.equal(assessTydroMarketIntegrity({...tydro(),pool:"0x0000000000000000000000000000000000000001"},now).valid,false);
 assert.equal(assessTydroMarketIntegrity({...tydro(),updatedAt:new Date(now-500000).toISOString()},now).valid,false);
 assert.equal(assessTydroMarketIntegrity({...tydro(),reserves:[{...tydro().reserves[0],decimals:255}]},now).valid,false);
});
test("Tydro refuses duplicate tokens, negative rate, zero active reserves",()=>{
 const r=tydro().reserves[0];
 assert.equal(assessTydroMarketIntegrity({...tydro(),reserves:[r,r]},now).valid,false);
 assert.equal(assessTydroMarketIntegrity({...tydro(),reserves:[{...r,supplyAprPct:-1}]},now).valid,false);
 assert.equal(assessTydroMarketIntegrity({...tydro(),reserves:[{...r,active:false}]},now).valid,false);
});
