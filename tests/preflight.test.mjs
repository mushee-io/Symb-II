import {test} from "node:test";
import assert from "node:assert/strict";
import {privateKeyToAccount} from "viem/accounts";
import {isValidSignedChallenge} from "../lib/agent/auth.ts";
import {parsePreflightRequest,finalizePreflight,validatePreflightDigest,
 canAcknowledgePreflight,preflightApprovalMessage} from "../lib/preflight/policy.ts";

const wallet=privateKeyToAccount("0x"+"3".repeat(64));
const other=privateKeyToAccount("0x"+"4".repeat(64));
const asset="0x0000000000000000000000000000000000000002";
const valid={wallet:wallet.address,asset,percent:25,kind:"tydro-variable-repay"};
const issuedAt="2026-10-29T16:00:00.000Z",now=Date.parse(issuedAt);
function report(gates=[{name:"Ink",state:"pass",detail:"Verified"}]){
 return finalizePreflight({
   version:1,network:"Ink",chainId:57073,kind:"tydro-variable-repay",
   wallet:wallet.address,asset,createdAt:issuedAt,blockNumber:"123",
   reviewOnly:true,executionEnabled:false,transactionPayload:null,
   amount:{value:"1",symbol:"USDC",decimals:6},
   target:{protocol:"Tydro",name:"Verified Pool",address:"0x2816cf15F6d2A220E789aA011D5EE4eB6c47FEbA"},
   gas:{estimatedUnits:"140000",maxEstimatedNativeFee:"0.0001",nativeBalance:"0.2"},
   allowance:{required:"1",current:"10",sufficient:true},
   gates,
 });
}
test("only Ink wallet and bounded single-token variable debt or Nado position accepted",()=>{
 assert.deepEqual(parsePreflightRequest(valid),{...valid,asset});
 assert.equal(parsePreflightRequest({...valid,percent:100}),null);
 assert.equal(parsePreflightRequest({...valid,spender:other.address}),null);
 assert.equal(parsePreflightRequest({...valid,asset:"0x1"}),null);
 assert.equal(parsePreflightRequest({...valid,kind:"tydro-stable-repay"}),null);
 assert.deepEqual(parsePreflightRequest({wallet:wallet.address,kind:"nado-position-reduce",positionKey:"main:4:leg-1",percent:50}),
  {wallet:wallet.address,kind:"nado-position-reduce",positionKey:"main:4:leg-1",percent:50});
 assert.equal(parsePreflightRequest({wallet:wallet.address,kind:"nado-position-reduce",positionKey:"unsafe\ntrade",percent:50}),null);
});
test("all checks must pass; unknown and failed gates never create approval-worthy results",()=>{
 const p=report();assert.equal(p.readyForHumanReview,true);
 assert.equal(p.executionEnabled,false);assert.equal(p.transactionPayload,null);
 assert.equal(validatePreflightDigest(p),true);
 assert.equal(report([{name:"allowance",state:"unknown",detail:"RPC failure"}]).readyForHumanReview,false);
 assert.equal(report([{name:"simulation",state:"fail",detail:"eth_call reverted"}]).readyForHumanReview,false);
});
test("digest commits exact wallet, conditions, chain, fee and amount",()=>{
 const p=report();
 assert.equal(validatePreflightDigest({...p,wallet:other.address}),false);
 assert.equal(validatePreflightDigest({...p,chainId:1}),false);
 assert.equal(validatePreflightDigest({...p,amount:{...p.amount,value:"999"}}),false);
 assert.equal(validatePreflightDigest({...p,gas:{...p.gas,estimatedUnits:"1"}}),false);
 assert.equal(validatePreflightDigest({...p,transactionPayload:"0x123"}),false);
 assert.equal(validatePreflightDigest({...p,executionEnabled:true}),false);
 assert.equal(canAcknowledgePreflight(p,wallet.address,now+30_000),true);
 assert.equal(canAcknowledgePreflight(p,wallet.address,now+90_000),false);
 assert.equal(canAcknowledgePreflight(p,other.address,now),false);
});
test("signed human preflight review cannot double as a transaction permission",async()=>{
 const p=report();
 const message=preflightApprovalMessage(p,"https://symb-ii.vercel.app");
 assert.match(message,/PREFLIGHT ACKNOWLEDGEMENT ONLY/);
 assert.match(message,/NOT an ERC20 approval/);
 assert.match(message,/Ink Chain ID: 57073/);
 const signature=await wallet.signMessage({message});
 assert.equal(await isValidSignedChallenge({wallet:wallet.address,challenge:message,expectedMessage:message,signature}),true);
 assert.equal(await isValidSignedChallenge({wallet:other.address,challenge:message,expectedMessage:message,signature}),false);
 const altered=preflightApprovalMessage({...p,digest:"0x"+"0".repeat(64)},"https://symb-ii.vercel.app");
 assert.equal(await isValidSignedChallenge({wallet:wallet.address,challenge:altered,expectedMessage:altered,signature}),false);
});
test("unknown Nado execution path cannot be acknowledged",()=>{
 const p=finalizePreflight({
  version:1,network:"Ink",chainId:57073,kind:"nado-position-reduce",wallet:wallet.address,
  asset:null,createdAt:issuedAt,blockNumber:null,reviewOnly:true,
  executionEnabled:false,transactionPayload:null,amount:null,
  target:{protocol:"Nado",name:"not configured",address:null},
  gas:{estimatedUnits:null,maxEstimatedNativeFee:null,nativeBalance:null},
  allowance:{required:null,current:null,sufficient:null},
  gates:[{name:"Signature support",state:"unknown",detail:"Unverified"}],
 });
 assert.equal(p.readyForHumanReview,false);
 assert.equal(canAcknowledgePreflight(p,wallet.address,now),false);
});

test("approval diagnostics and EIP1559 fee fields are bound to preflight digest",()=>{
 const original=report();
 const extended=finalizePreflight({
   version:original.version,network:original.network,chainId:original.chainId,
   kind:original.kind,wallet:original.wallet,asset:original.asset,
   createdAt:original.createdAt,blockNumber:original.blockNumber,
   reviewOnly:true,executionEnabled:false,transactionPayload:null,
   amount:original.amount,target:original.target,
   allowance:original.allowance,gates:original.gates,
   gas:{...original.gas,feeModel:"eip1559",maxFeePerGasGwei:"0.1",
    approvalEstimatedGasUnits:"45000",approvalFeeScreeningEth:"0.00001"},
   approvalDiagnostics:{status:"not-required",description:"Existing allowance is sufficient",
    tokenAddress:asset,spender:original.target.address,required:"1",
    existing:"2",shortfall:"0"},
 });
 assert.equal(validatePreflightDigest(extended),true);
 assert.equal(validatePreflightDigest({...extended,approvalDiagnostics:{
    ...extended.approvalDiagnostics,spender:other.address
 }}),false);
 assert.equal(validatePreflightDigest({...extended,gas:{
    ...extended.gas,maxFeePerGasGwei:"999"
 }}),false);
});

test("pinned block hash, atomic debt and token metadata cannot be edited after review",()=>{
 const original=report();
 const extended=finalizePreflight({
  version:original.version,network:original.network,chainId:original.chainId,
  kind:original.kind,wallet:original.wallet,asset:original.asset,
  createdAt:original.createdAt,blockNumber:original.blockNumber,
  reviewOnly:true,executionEnabled:false,transactionPayload:null,
  amount:original.amount,target:original.target,allowance:original.allowance,
  gas:original.gas,gates:original.gates,
  snapshotEvidence:{
    number:"123",hash:"0x"+"a".repeat(64),verified:true,
    variableDebtAtomic:"1000000",accountDebtDeviationAtomic:"0",
    tokenDecimals:6,explanation:"Debt reconciled within tolerance.",
  },
 });
 assert.equal(validatePreflightDigest(extended),true);
 assert.equal(validatePreflightDigest({...extended,snapshotEvidence:{
  ...extended.snapshotEvidence,hash:"0x"+"b".repeat(64),
 }}),false);
 assert.equal(validatePreflightDigest({...extended,snapshotEvidence:{
  ...extended.snapshotEvidence,variableDebtAtomic:"1000000000",
 }}),false);
});
