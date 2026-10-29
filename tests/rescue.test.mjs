import {test} from "node:test";
import assert from "node:assert/strict";
import {reviewNadoReduction,reviewTydroDebtReduction} from "../lib/risk/rescue.ts";
const now=Date.parse("2026-10-29T15:00:00Z");
const wallet="0x0000000000000000000000000000000000000001";
const updatedAt="2026-10-29T14:59:55Z";
const position={id:"leg-1",subaccount:"main",productId:4,symbol:"ETH-PERP",
  side:"long",marginMode:"cross",size:"2",entryPrice:"2000",openedAt:null,updatedAt:null};
const nado=()=>({address:wallet,chainId:57073,updatedAt,positions:[position],
  positionCoverageComplete:true,incomplete:false,warnings:[],subaccounts:["main"],subaccountHealth:[],
  openOrders:[],indexedOrders:[]});
const markets=()=>({chainId:57073,updatedAt,markets:[{productId:4,symbol:"ETH-PERP",type:"perp",
  base:"ETH",quote:"USDT0",lastPrice:2500,change24h:0,volume24h:1}]});
const reduced=(overrides={})=>reviewNadoReduction({account:nado(),markets:markets(),
  positionKey:"main:4:leg-1",shockPct:-20,reductionPct:50,now,...overrides});
const tydro=()=>({address:wallet,chainId:57073,updatedAt,healthFactor:"1.2",debtBase:"500",
  userEModeCategory:0,incomplete:false,warnings:[],userReserves:[]});
test("Nado review uses a real matched position and halves downside sensitivity",()=>{
  const s=reduced();
  assert.equal(s.ok,true);
  if(!s.ok)return;
  assert.equal(s.originalPositionSensitivity,"-1000.00000000");
  assert.equal(s.remainingPositionSensitivity,"-500.00000000");
  assert.equal(s.remainingSize,"1");
  assert.equal(s.quote,"USDT0");
});
test("Nado reduction also proportionally reduces hypothetical upside",()=>{
  const s=reduced({shockPct:20});
  assert.equal(s.ok,true);
  if(s.ok)assert.equal(s.remainingPositionSensitivity,"500.00000000");
});
test("Nado refuses partial positions, missing tickers, unsupported sizes and stale snapshots",()=>{
  assert.equal(reduced({account:{...nado(),positionCoverageComplete:false}}).ok,false);
  assert.equal(reduced({markets:{...markets(),markets:[]}}).ok,false);
  assert.equal(reduced({reductionPct:100}).ok,false);
  assert.equal(reduced({now:now+3600000}).ok,false);
});
test("Tydro proportional aggregate debt reduction scales health factor correctly",()=>{
  const s=reviewTydroDebtReduction(tydro(),25,now);
  assert.equal(s.ok,true);
  if(!s.ok)return;
  assert.equal(s.currentHealthFactor,"1.2");
  assert.equal(s.estimatedHealthFactor,"1.600000");
  assert.equal(s.estimatedRisk,"above-warning-level");
});
test("Tydro never simulates no debt, eMode, partial data, bad percent or stale snapshots",()=>{
  assert.equal(reviewTydroDebtReduction({...tydro(),healthFactor:null},25,now).ok,false);
  assert.equal(reviewTydroDebtReduction({...tydro(),userEModeCategory:1},25,now).ok,false);
  assert.equal(reviewTydroDebtReduction({...tydro(),warnings:["rpc"]},25,now).ok,false);
  assert.equal(reviewTydroDebtReduction(tydro(),100,now).ok,false);
  assert.equal(reviewTydroDebtReduction(tydro(),25,now+240000).ok,false);
  assert.equal(reviewTydroDebtReduction({...tydro(),debtBase:"0"},25,now).ok,false);
});
test("Tydro stressed health remains adverse if debt reduction does not restore the buffer",()=>{
  const s=reviewTydroDebtReduction({...tydro(),healthFactor:"0.5"},25,now);
  assert.equal(s.ok,true);
  if(s.ok){assert.equal(s.estimatedRisk,"urgent");assert.equal(s.estimatedHealthFactor,"0.666667");}
});
