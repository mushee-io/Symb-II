import {test} from "node:test";
import assert from "node:assert/strict";
import {assessAgentDraft} from "../lib/execution/agent-policy.ts";
const now=1793440800000;
const wallet="0x3f90f099af21b96b4e58b36f630bc88326417de2";
const scope={
 wallet,chainId:57073,action:"nado-reduce",instrument:"NADO:BTC-PERP",
 maxPerActionAtomic:"100",maxDailyAtomic:"300",
 expiresAt:now+3600000,revokedAt:null,humanApprovalRequired:true,
};
const request={
 wallet,chainId:57073,action:"nado-reduce",instrument:"NADO:BTC-PERP",
 amountAtomic:"60",spentTodayAtomic:"20",
};
test("bounded agent draft is possible, transaction authority is NEVER granted",()=>{
 const r=assessAgentDraft(scope,request,now);
 assert.equal(r.canPrepareDraft,true);
 assert.equal(r.canExecute,false);
 assert.equal(r.executionEnabled,false);
 assert.equal(r.requiresFreshHumanApproval,true);
});
test("wallet, chain, action, venue, expiry, revoke, budget and owner controls fail closed",()=>{
 const patches=[
 [{wallet:"0x000000000000000000000000000000000000dEaD"},{}],
 [{chainId:1},{}],[{action:"tydro-repay"},{}],
 [{instrument:"TYDRO:USDC"},{}],
 [{expiresAt:now-1},{}],[{expiresAt:now+90000000},{}],
 [{revokedAt:now},{}],[{revokedAt:undefined},{}],
 [{humanApprovalRequired:false},{}],
 [{maxPerActionAtomic:"0"},{}],
 [{}, {amountAtomic:"0"}],[{}, {amountAtomic:"101"}],
 [{}, {spentTodayAtomic:"250"}],[{}, {instrument:"NADO:ETH-PERP"}],
 [{}, {wallet:"0x000000000000000000000000000000000000dEaD"}],
 [{}, {amountAtomic:"1e9"}],[{}, {chainId:1}],
 ];
 for(const [a,b] of patches){
  const r=assessAgentDraft({...scope,...a},{...request,...b},now);
  assert.equal(r.canPrepareDraft,false,JSON.stringify([a,b]));
  assert.equal(r.canExecute,false);
 }
});
test("untrusted or missing scope cannot enable any automation",()=>{
 for(const item of [null,undefined,{},[],true,"grant"]){
  const r=assessAgentDraft(item,request,now);
  assert.equal(r.canPrepareDraft,false);
  assert.equal(r.canExecute,false);
 }
});
