import {test} from "node:test";
import assert from "node:assert/strict";
import {parseMarketReviewInput,buildMarketModelInput,validateMarketNarrative} from "../lib/agent/market-policy.ts";

const request={productId:2,side:"long",notional:1000,leverage:2};
const observed={
 status:"observed",source:"Nado indexer + Nado engine",productId:2,side:"long",
 reasons:[],metrics:{
  referencePrice:101,estimatedBaseQuantity:9.9,observedSpreadPct:.14,
  sma20:100,deviationFromSmaPct:1.2,observedRangeLow:95,observedRangeHigh:106,
  observedVolume:25.7,
 },
 executionEnabled:false,authenticated:false,simulationVerified:false,
};
test("accepts only explicitly bounded market-analysis parameters",()=>{
 assert.deepEqual(parseMarketReviewInput(request),request);
 for(const data of [
  {...request,productId:-1},{...request,productId:2.5},
  {...request,side:"buy"},{...request,notional:Infinity},
  {...request,notional:0},{...request,notional:1_000_001},
  {...request,leverage:11},{...request,leverage:0},
  {...request,walletPrivateKey:"secret"},null,[],
 ])assert.equal(parseMarketReviewInput(data),null);
});
test("market model receives only bounded numerical evidence; no wallet, signing or tools",()=>{
 const p=buildMarketModelInput(observed);
 assert.ok(p);
 assert.match(p.system,/never give buy, sell/i);
 assert.match(p.prompt,/"executionAvailable":false/);
 assert.match(p.prompt,/"toolsAvailable":\[\]/);
 assert.doesNotMatch(p.prompt,/privateKey|walletAddress|signature/);
 assert.doesNotMatch(p.prompt,/"notional"/);
});
test("incomplete or unsafe trading evidence is never sent to the model",()=>{
 for(const e of [
  {...observed,status:"insufficient"},
  {...observed,executionEnabled:true},
  {...observed,authenticated:true},
  {...observed,simulationVerified:true},
  {...observed,metrics:null},
  {...observed,reasons:["stale quotes"]},
  {...observed,metrics:{...observed.metrics,referencePrice:Infinity}},
 ])assert.equal(buildMarketModelInput(e),null);
});
test("generative output screening refuses financial orders and sensitive text",()=>{
 assert.equal(validateMarketNarrative("The historical price remains above the observed SMA, but spreads and liquidity can change rapidly." )?.startsWith("The historical"),true);
 for(const s of [
  "Buy now, this is risk-free profit.",
  "Go long and place an order immediately.",
  "Sign this wallet order to proceed.",
  "-----BEGIN PRIVATE KEY-----",
  "",
 ])assert.equal(validateMarketNarrative(s),null,s);
});
test("market endpoint explicitly shares the protected single-use challenge and 45-second model budget",async()=>{
 const {readFileSync}=await import("node:fs");
 const file=readFileSync(new URL("../app/api/agent/market/route.ts",import.meta.url),"utf8");
 assert.match(file,/consumeNonce\(b\.challengeId\)/);
 assert.match(file,/isValidSignedChallenge/);
 assert.match(file,/acquireLimit\("model:"\+wallet\.toLowerCase\(\),45\)/);
 assert.match(file,/getNadoCandles\(marketInput.productId,"15m"\)/);
 assert.match(file,/getNadoPreflightEngineEvidence\(marketInput.productId\)/);
 assert.doesNotMatch(file,/writeContract\(|sendTransaction\(|signTypedData\(/);
});
