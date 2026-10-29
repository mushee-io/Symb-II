import {test} from "node:test";
import assert from "node:assert/strict";
import {assessNadoEvidence} from "../lib/preflight/nado-evidence.ts";
const now=Date.parse("2026-10-29T17:25:00Z");
const updatedAt=new Date(now-1000).toISOString();
const wallet="0x0000000000000000000000000000000000000001";
const position={id:"leg",subaccount:"main",productId:3,symbol:"ETH-PERP",side:"long",marginMode:"cross",size:"2",entryPrice:"2500",openedAt:null,updatedAt:null};
const account=()=>({address:wallet,chainId:57073,updatedAt,incomplete:false,positionCoverageComplete:true,warnings:[],positions:[position],
  subaccounts:["main"],subaccountHealth:[{subaccount:"main",exists:true,maintenanceHealth:"100",initialHealth:"200"}],openOrders:[],indexedOrders:[]});
const markets=()=>({chainId:57073,updatedAt,markets:[{productId:3,symbol:"ETH-PERP",type:"perp",base:"ETH",quote:"USDT0",lastPrice:2500,change24h:0,volume24h:10}]});
const engine=()=>({observedAt:updatedAt,engineChainId:57073,engineEndpoint:"0x0000000000000000000000000000000000000009",productId:3,productType:"perp",oraclePrice:"2490",priceIncrement:"0.1",sizeIncrement:"100000000000000000",minSize:"100000000000000000",bid:"2498",ask:"2502",warnings:[]});
const inspect=(overrides={})=>assessNadoEvidence({wallet,account:account(),markets:markets(),positionKey:"main:3:leg",engine:engine(),now,...overrides});
test("consistent live engine observations pass read-only gates but NEVER authorize execution",()=>{
 const result=inspect();
 assert.ok(result.marketEvidence);
 assert.equal(result.marketEvidence.spreadPercent,"0.16");
 assert.equal(result.gates.find(x=>x.name==="Exact perp product mapping").state,"pass");
 assert.equal(result.gates.at(-1).state,"fail");
});
test("wrong chain, wallet and product fail closed",()=>{
 let a=inspect({account:{...account(),address:"0x0000000000000000000000000000000000000002"}});
 assert.equal(a.gates[0].state,"fail");
 a=inspect({engine:{...engine(),engineChainId:1}});
 assert.equal(a.gates.find(x=>x.name==="Official Nado engine chain and endpoint").state,"unknown");
 a=inspect({engine:{...engine(),productId:4}});
 assert.equal(a.gates.find(x=>x.name==="Exact perp product mapping").state,"fail");
});
test("missing and crossed BBO cannot be treated as a valid market",()=>{
 let result=inspect({engine:{...engine(),bid:null,ask:null}});
 assert.equal(result.marketEvidence.spreadPercent,null);
 assert.equal(result.gates.find(x=>x.name==="Read-only best bid/ask").state,"unknown");
 result=inspect({engine:{...engine(),bid:"2600",ask:"2490"}});
 assert.equal(result.gates.find(x=>x.name==="Read-only best bid/ask").state,"unknown");
});
test("heuristic flags excessive spread or oracle/indexer last-trade divergence",()=>{
 let result=inspect({engine:{...engine(),bid:"100",ask:"120",oraclePrice:"110"}});
 assert.equal(result.gates.find(x=>x.name==="Observed price divergence heuristic").state,"fail");
 result=inspect({engine:{...engine(),oraclePrice:"1800"}});
 assert.equal(result.gates.find(x=>x.name==="Observed price divergence heuristic").state,"fail");
});
test("partial or stale Nado feeds and duplicate positions block readiness",()=>{
 let result=inspect({account:{...account(),incomplete:true,warnings:["orders missing"]}});
 assert.equal(result.gates.find(x=>x.name==="Complete position coverage").state,"fail");
 result=inspect({account:{...account(),updatedAt:new Date(now-180000).toISOString()}});
 assert.equal(result.gates.find(x=>x.name==="Read timestamp checks").state,"fail");
 result=inspect({account:{...account(),positions:[position,position]}});
 assert.equal(result.gates.find(x=>x.name==="Unique open position").state,"fail");
});
test("missing engine increments and subaccount health return unknown",()=>{
 const result=inspect({account:{...account(),subaccountHealth:[]},engine:{...engine(),sizeIncrement:"0"}});
 assert.equal(result.gates.find(x=>x.name==="Cross-margin health observation").state,"unknown");
 assert.equal(result.gates.find(x=>x.name==="Product increments and minimum size").state,"unknown");
});
test("never treats a plausible ticker as validated signed execution",()=>{
 const result=inspect();
 assert.equal(result.gates.some(g=>g.name==="Authenticated order and execution constraints"&&g.state==="fail"),true);
});
