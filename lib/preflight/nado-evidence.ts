import BigNumber from "bignumber.js";
import type {NadoAccountResponse,NadoMarketsResponse,NadoPosition} from "../nado/types.ts";
import type {Gate} from "./policy.ts";
import {crosscheckNadoPositions} from "../verification/nado-positions.ts";

/** Only information returned by the official Nado engine. All values are
 * observations, NOT executable order values, mark-to-liquidation prices,
 * or authorization to use a trading subaccount.
 */
export type EngineMarketEvidence={
  observedAt:string;
  engineChainId:number|null;
  engineEndpoint:string|null;
  productId:number;
  productType:"perp"|"spot"|null;
  oraclePrice:string|null;
  priceIncrement:string|null;
  sizeIncrement:string|null;
  minSize:string|null;
  bid:string|null;
  ask:string|null;
  warnings:string[];
};
export type NadoDiagnostic={
  gates:Gate[];
  marketEvidence:{
    productId:number;
    symbol:string;
    subaccount:string;
    side:"long"|"short";
    sourceObservedAt:string;
    sdkObservedAt:string;
    engineEndpoint:string|null;
    engineOracle:string|null;
    tickerLast:string;
    bestBid:string|null;
    bestAsk:string|null;
    priceIncrement:string|null;
    sizeIncrement:string|null;
    minimumBookSize:string|null;
    spreadPercent:string|null;
    tickerOracleDivergencePercent:string|null;
    priceSource:"indexer-last-trade-vs-engine-oracle";
    limitations:string[];
  }|null;
};
const gate=(name:string,state:Gate["state"],detail:string):Gate=>({name,state,detail});
const valid=(s:string|null)=> {
  if(typeof s!=="string"||!/^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))return null;
  const n=new BigNumber(s);
  return n.isFinite()&&n.gt(0)?n:null;
};
const fresh=(s:string,now:number,maxAge=90_000)=>{
  const t=Date.parse(s);
  return Number.isFinite(t)&&t<=now+5000&&now-t<=maxAge;
};
const NUMERIC_LIMITS= {
  maxSpreadPercent:"5",
  maxTickerOracleDivergencePercent:"15",
};
/** Diagnostic thresholds are only conservative review heuristics. They are
 * not Nado protocol rules or promises of available liquidity. */
export function assessNadoEvidence(args:{
  wallet:string;account:NadoAccountResponse;markets:NadoMarketsResponse;
  positionKey:string;engine:EngineMarketEvidence;
  now?:number;
}):NadoDiagnostic {
  const {wallet,account,markets,positionKey,engine}=args;
  const now=args.now??Date.now();
  const positions=account.positions.filter(p=>[p.subaccount,p.productId,p.id].join(":")===positionKey);
  const position=positions.length===1?positions[0]:null;
  const tickerMatches=position?markets.markets.filter(m=>m.productId===position.productId&&m.type==="perp"):[];
  const ticker=tickerMatches.length===1?tickerMatches[0]:null;
  const isWallet=/^0x[a-f0-9]{40}$/i.test(wallet)&&account.address.toLowerCase()===wallet.toLowerCase()&&
    account.chainId===57073&&markets.chainId===57073;
  const complete=account.incomplete===false&&account.positionCoverageComplete===true&&
    account.warnings.length===0;
  const crosscheck=crosscheckNadoPositions(account,markets,now);
  const hasHealth=Boolean(position&&account.subaccountHealth.filter(h=>h.subaccount===position.subaccount&&h.exists===true).length===1&&crosscheck.state==="pass");
  const sourceFresh=fresh(account.updatedAt,now)&&fresh(markets.updatedAt,now);
  const engineFresh=fresh(engine.observedAt,now);
  const timestamps=[account.updatedAt,markets.updatedAt,engine.observedAt].map(x=>Date.parse(x));
  const sourceSkewOk=timestamps.every(Number.isFinite)&&
    Math.max(...timestamps)-Math.min(...timestamps)<=60_000;
  const validEngine=engine.engineChainId===57073&&
    typeof engine.engineEndpoint==="string"&&/^0x[a-f0-9]{40}$/i.test(engine.engineEndpoint);
  const tickerMatchesPosition=Boolean(position&&ticker&&
    typeof position.symbol==="string"&&typeof ticker.symbol==="string"&&
    position.symbol.trim().toUpperCase()===ticker.symbol.trim().toUpperCase()&&
    !/^PRODUCT #/i.test(position.symbol.trim()));
  const exactProduct=Boolean(position&&ticker&&tickerMatchesPosition&&
    engine.productId===position.productId&&engine.productType==="perp");
  const oracle=valid(engine.oraclePrice),bid=valid(engine.bid),ask=valid(engine.ask);
  const price= ticker&&Number.isFinite(ticker.lastPrice)&&ticker.lastPrice>0?new BigNumber(ticker.lastPrice):null;
  const stepPrice=valid(engine.priceIncrement),stepSize=valid(engine.sizeIncrement),minSize=valid(engine.minSize);
  const spread=bid&&ask&&ask.gte(bid)?
    ask.minus(bid).div(ask.plus(bid).div(2)).times(100):null;
  const deviation=price&&oracle?
    price.minus(oracle).abs().div(oracle).times(100):null;
  const priceOk=spread!==null&&spread.lte(NUMERIC_LIMITS.maxSpreadPercent)&&
    deviation!==null&&deviation.lte(NUMERIC_LIMITS.maxTickerOracleDivergencePercent);
  const sideOk=position?.side==="long"||position?.side==="short";
  const gates:Gate[]=[
    gate("Exact Ink wallet",isWallet?"pass":"fail",
      "Nado account and indexer market data must both belong to Ink chain 57073 and the requested wallet."),
    gate("Complete position coverage",complete?"pass":"fail",
      "All relevant subaccounts and account queries must complete; missing orders or isolated subaccounts block readiness."),
    gate("Unique open position",positions.length===1&&sideOk?"pass":"fail",
      "Review requires exactly one matching open position. Duplicate IDs or missing positions are refused."),
    gate("Cross-margin health observation",hasHealth?"pass":"unknown",
      "A matching existing subaccount health observation is required; this does not calculate post-order margin."),
    gate("Read timestamp checks",sourceFresh&&engineFresh?"pass":"fail",
      "Local response retrieval timestamps must be within 90 seconds; this does not prove the engine's underlying price freshness."),
    gate("Official Nado engine chain and endpoint",validEngine?"pass":"unknown",
      "Engine getContracts() must identify Ink 57073 and a valid endpoint address."),
    gate("Engine diagnostic coverage",Array.isArray(engine.warnings)&&engine.warnings.length===0?"pass":"unknown",
      "No partial Nado engine market, chain or quote diagnostics can be treated as a complete read."),
    gate("Exact perp product mapping",exactProduct&&tickerMatches.length===1?"pass":"fail",
      "The position and ticker must match in product ID, canonical symbol and perpetual type, with the same product confirmed by the Nado engine."),
    gate("Product increments and minimum size",stepPrice&&stepSize&&minSize?"pass":"unknown",
      "Official engine increments must be positive. This does not verify order sizing or match precision."),
    gate("Read-only best bid/ask",spread!==null?"pass":"unknown",
      "Best bid and ask must both be positive, on the same product and not crossed."),
    gate("Observed price divergence heuristic",priceOk?"pass":spread===null||deviation===null?"unknown":"fail",
      "Observed bid/ask spread must be ≤5%, and indexer last-trade vs engine oracle divergence ≤15% (informational heuristic, not Nado rules)."),
    gate("Authenticated order and execution constraints","fail",
      "Protocol-approved reduce-only orders, signing keys, actual margin impact, price bands, execution fees, counterparty liquidity and matched fills have NOT been verified. No execution allowed."),
  ];
  const limitations=[
    "Nado ticker last trade, engine oracle and top-of-book prices serve different functions; none is a guaranteed fill or liquidation mark.",
    "No orderbook depth, fee quote, order signature, matching-engine validation or post-trade maintenance margin is calculated.",
    "Engine increments are exposed as SDK values; no assertion is made that a hypothetical fraction can be placed as an order.",
    ...(Array.isArray(engine.warnings)?engine.warnings:[]).map(x=>"Engine: "+x),
  ];
  return {
    gates,
    marketEvidence:position&&ticker?{
      productId:position.productId,symbol:position.symbol,
      subaccount:position.subaccount,side:position.side,
      sourceObservedAt:markets.updatedAt,sdkObservedAt:engine.observedAt,
      engineEndpoint:engine.engineEndpoint,engineOracle:engine.oraclePrice,
      tickerLast:price?.toFixed()??"unavailable",
      bestBid:engine.bid,bestAsk:engine.ask,
      priceIncrement:engine.priceIncrement,sizeIncrement:engine.sizeIncrement,
      minimumBookSize:engine.minSize,
      spreadPercent:spread?.decimalPlaces(3).toFixed()??null,
      tickerOracleDivergencePercent:deviation?.decimalPlaces(3).toFixed()??null,
      priceSource:"indexer-last-trade-vs-engine-oracle",
      limitations,
    }:null,
  };
}

/** Allow only a bounded, read-only hypothetical reduce-only size request.
 * This does NOT mean the wallet is authorised to trade or sign an order.
 * The independent execution gate is intentionally always failing.
 */
export function canInspectNadoReduction(assessment:NadoDiagnostic):boolean {
 const execution=assessment.gates.filter(g=>g.name==="Authenticated order and execution constraints");
 const diagnostic=assessment.gates.filter(g=>g.name!=="Authenticated order and execution constraints");
 return execution.length===1&&execution[0].state==="fail"&&
   diagnostic.length===12&&diagnostic.every(g=>g.state==="pass");
}
