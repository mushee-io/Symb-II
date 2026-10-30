import {test} from "node:test";
import assert from "node:assert/strict";
import {privateKeyToAccount} from "viem/accounts";
import {isValidSignedChallenge} from "../lib/agent/auth.ts";
import {finalizePreflight,preflightApprovalMessage} from "../lib/preflight/policy.ts";
import {verifyFreshPreflightReview} from "../lib/preflight/acknowledgement-flow.ts";

// Deterministic test-only EOA; mocked Ink RPC. No actual funds, transaction,
// production wallet or Upstash store is touched by this test.
const wallet=privateKeyToAccount("0x"+"3".repeat(64));
const other=privateKeyToAccount("0x"+"4".repeat(64));
const asset="0x0000000000000000000000000000000000000002";
const origin="https://symb-ii.vercel.app";
const issue=Date.parse("2026-10-30T18:00:00.000Z");
const signedNow=issue+1000;
const runtime={
 chainId:async()=>57073,
 block:async(number)=>({number:number??123456n,hash:"0x"+"ab".repeat(32)}),
 code:async()=> "0x",
 contractSignature:async()=> "0xffffffff",
};
function report(){
 return finalizePreflight({
  version:1,network:"Ink",chainId:57073,kind:"tydro-variable-repay",
  wallet:wallet.address,asset,createdAt:new Date(issue).toISOString(),
  blockNumber:"123456",reviewOnly:true,executionEnabled:false,
  transactionPayload:null,amount:{value:"1",symbol:"USDC",decimals:6},
  target:{protocol:"Tydro",name:"Verified Pool",
   address:"0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA"},
  gas:{estimatedUnits:"140000",maxEstimatedNativeFee:"0.0001",nativeBalance:"0.2"},
  allowance:{required:"1",current:"10",sufficient:true},
  gates:[{name:"Ink",state:"pass",detail:"Verified"}],
 });
}
const input=async(overrides={})=>{
 const signedReport=report();
 const message=preflightApprovalMessage(signedReport,origin);
 const signature=await wallet.signMessage({message});
 return {report:signedReport,wallet:wallet.address,origin,signature,...overrides};
};
const realSignature=args=>isValidSignedChallenge(args,runtime);
const clock=(...values)=>{
 let count=0;
 return ()=>values[Math.min(count++,values.length-1)];
};
test("real EOA signature is accepted only within the original 90-second report window",async()=>{
 const args=await input();
 let invoked=0;
 const result=await verifyFreshPreflightReview(args,{
  verifySignature:async x=>{invoked++;return realSignature(x);},
  now:clock(signedNow,signedNow+45000),
 });
 assert.equal(result,true);
 assert.equal(invoked,1);
 assert.equal(args.report.executionEnabled,false);
 assert.equal(args.report.transactionPayload,null);
});
test("a signature finishing at or after original preflight expiry can never be acknowledged",async()=>{
 const args=await input();
 for(const completedAt of [issue+90000,issue+120000]){
  let verificationCalls=0;
  assert.equal(await verifyFreshPreflightReview(args,{
   verifySignature:async x=>{verificationCalls++;return realSignature(x);},
   now:clock(signedNow,completedAt),
  }),false);
  assert.equal(verificationCalls,1);
 }
});
test("a preflight already expired before signing is rejected without invoking Ink RPC",async()=>{
 const args=await input();
 let called=0;
 const result=await verifyFreshPreflightReview(args,{
  verifySignature:async()=>{called++;return true;},
  now:clock(issue+90000,issue+90001),
 });
 assert.equal(result,false);
 assert.equal(called,0);
});
test("altered report digest, wrong wallet and wrong origin fail safely",async()=>{
 const args=await input();
 for(const change of [
  {report:{...args.report,amount:{...args.report.amount,value:"999"}}},
  {wallet:other.address},
  {origin:"https://another-domain.invalid"},
 ]){
  assert.equal(await verifyFreshPreflightReview({...args,...change},{
   verifySignature:realSignature,
   now:clock(signedNow,signedNow+100),
  }),false);
 }
});
test("failed, throwing or unavailable signature verification never succeeds",async()=>{
 const args=await input();
 for(const fn of [async()=>false,async()=>{throw Error("private-rpc-error");}]){
  const result=await verifyFreshPreflightReview(args,{
   verifySignature:fn,now:clock(signedNow,signedNow+1000),
  });
  assert.equal(result,false);
 }
});
test("missing, reversed or nonfinite server time fails closed",async()=>{
 const args=await input();
 for(const times of [
  [Number.NaN,issue+1000],
  [signedNow,Number.NaN],
  [signedNow,signedNow-1],
  [signedNow,Number.POSITIVE_INFINITY],
 ]){
  assert.equal(await verifyFreshPreflightReview(args,{
   verifySignature:realSignature,now:clock(...times),
  }),false);
 }
 for(const clockFn of [
  ()=>{throw Error("clock unavailable");},
  clock(signedNow),
 ]){
  if(clockFn===undefined)throw Error("Invalid clock test");
 }
 let samples=0;
 assert.equal(await verifyFreshPreflightReview(args,{
  verifySignature:realSignature,
  now:()=>{samples++;if(samples===2)throw Error("clock failure");return signedNow;},
 }),false);
 assert.equal(await verifyFreshPreflightReview(args,{
  verifySignature:realSignature,
  now:()=>{throw Error("clock failure");},
 }),false);
});
