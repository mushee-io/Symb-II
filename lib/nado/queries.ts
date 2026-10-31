import "server-only";
import { EngineClient, ENGINE_CLIENT_ENDPOINTS } from "@nadohq/engine-client";
import { IndexerClient, INDEXER_CLIENT_ENDPOINTS, type CandlestickPeriod } from "@nadohq/indexer-client";
import {normalizeNadoCandles,CANDLE_INTERVALS,type CandleInterval,type HistoricalCandleResponse} from "@/lib/trading/candles";
import { isAddress } from "viem";
import BigNumber from "bignumber.js";
import type {ReduceOnlyObservation} from "../preflight/nado-reduce";
import type { EngineMarketEvidence } from "../preflight/nado-evidence";
import type { NadoMarket, NadoMarketsResponse, NadoAccountResponse, NadoPosition, NadoOrder, NadoSubaccountHealth } from "./types";

const chainId = 57073 as const;
const ACCOUNT_LIMIT = 6;
const POSITION_LIMIT = 100;
const ORDER_LIMIT = 25;
const PRODUCT_LIMIT = 160;

function indexer() {
  const c = new IndexerClient({ url: INDEXER_CLIENT_ENDPOINTS.inkMainnet, clientType: "symb-ii-readonly" });
  c.axiosInstance.defaults.timeout = 10000;
  return c;
}
function engine() {
  const c = new EngineClient({ url: ENGINE_CLIENT_ENDPOINTS.inkMainnet, clientType: "symb-ii-readonly" });
  c.axiosInstance.defaults.timeout = 10000;
  return c;
}
const ts = (n: number) => Number.isFinite(n) && n > 0 ? n : null;

export async function getNadoMarkets(): Promise<NadoMarketsResponse> {
  const tickers = await indexer().getV2Tickers({});
  const markets: NadoMarket[] = Object.values(tickers).filter(t => t.lastPrice > 0 && Number.isFinite(t.lastPrice))
    .map(t => ({
      productId: t.productId, symbol: t.tickerId,
      type: t.tickerId.toUpperCase().includes("PERP") ? "perp" as const : "spot" as const,
      base: t.baseCurrency, quote: t.quoteCurrency, lastPrice: t.lastPrice,
      change24h: Number.isFinite(t.priceChangePercent24h) ? t.priceChangePercent24h : 0,
      volume24h: Number.isFinite(t.quoteVolume) ? t.quoteVolume : 0,
    })).sort((a,b)=>b.volume24h-a.volume24h);
  return { source: "Nado indexer", chainId, updatedAt: new Date().toISOString(), markets };
}

/** Read-only provider OHLCV. Verify product membership on Ink and never derive bars from last-price guesses. */
export async function getNadoCandles(productId:number,interval:CandleInterval):Promise<HistoricalCandleResponse>{
  if(!Number.isSafeInteger(productId)||productId<0||productId>1_000_000||!CANDLE_INTERVALS[interval])
    throw Error("Invalid Nado candle request");
  const markets=await getNadoMarkets();
  const matches=markets.markets.filter(m=>m.productId===productId&&m.type==="perp");
  if(matches.length!==1)throw Error("A verified live Nado perp product is required");
  const bars=await indexer().getCandlesticks({
    productId,period:CANDLE_INTERVALS[interval] as CandlestickPeriod,limit:96,
  });
  return normalizeNadoCandles(bars,productId,interval);
}

/**
 * Public wallet-address subaccount discovery is not identity verification.
 * Never use this read-only result as authorisation to sign or execute anything.
 */
export async function getNadoAccount(address: string): Promise<NadoAccountResponse> {
  if (!isAddress(address,{strict:false})) throw Error("Invalid address");
  const idx = indexer();
  const eng = engine();
  const [discovered,symbols] = await Promise.all([
    idx.listSubaccounts({address, limit:50, start:0}),
    eng.getSymbols({}),
  ]);
  const crossAccounts = discovered.filter(s=>!s.isolated);
  const selected = crossAccounts.slice(0,ACCOUNT_LIMIT);
  const warnings: string[] = [];
  let positionCoverageComplete=true;
  if (discovered.length === 50) { warnings.push("Nado subaccount discovery reached its page limit."); positionCoverageComplete=false; }
  if (crossAccounts.length > ACCOUNT_LIMIT) { warnings.push("Additional subaccounts are not included in this first-page view."); positionCoverageComplete=false; }
  if (discovered.some(s=>s.isolated)) { warnings.push("Isolated Nado subaccounts are not included in the cross-margin position view."); positionCoverageComplete=false; }
  const names = new Map(Object.values(symbols.symbols).map(s=>[s.productId,s.symbol]));
  const productIds = Array.from(names.keys()).slice(0,PRODUCT_LIMIT);
  if (names.size > PRODUCT_LIMIT) warnings.push("Open orders from some products were not queried.");
  const positions: NadoPosition[] = [], openOrders: NadoOrder[] = [], indexedOrders: NadoOrder[] = [];
  const subaccountHealth: NadoSubaccountHealth[] = [];

  for (const sub of selected) {
    const id = {subaccountOwner:sub.subaccountOwner,subaccountName:sub.subaccountName};
    const label = sub.subaccountName || "(unnamed)";
    const [p,o,h,accountSummary] = await Promise.allSettled([
      idx.getPositions({subaccount:id,open:true,limit:POSITION_LIMIT}),
      productIds.length ? eng.getSubaccountMultiProductOrders({...id,productIds}) : Promise.resolve({productOrders:[]}),
      idx.getPaginatedSubaccountOrders({...id,limit:ORDER_LIMIT}),
      eng.getSubaccountSummary(id),
    ]);
    if (p.status === "fulfilled") {
      if (p.value.positions.length >= POSITION_LIMIT) { warnings.push(label+": position limit reached"); positionCoverageComplete=false; }
      positions.push(...p.value.positions.filter(v=>!v.amount.isZero()).map(v=>({
        id:v.openId,subaccount:label,productId:v.productId,symbol:names.get(v.productId)??"Product #"+v.productId,
        side:v.direction?"long" as const:"short" as const,marginMode:v.isolated?"isolated" as const:"cross" as const,
        size:v.amount.toString(),entryPrice:v.averageEntryPrice.toString(),
        openedAt:ts(v.openTimestamp.toNumber()),updatedAt:ts(v.updateTimestamp.toNumber()),
      })));
    } else { warnings.push(label+": positions unavailable from Nado"); positionCoverageComplete=false; }
    if (o.status === "fulfilled") {
      for (const row of o.value.productOrders) for (const v of row.orders) openOrders.push({
        id:v.digest,subaccount:label,productId:row.productId,symbol:names.get(row.productId)??"Product #"+row.productId,
        side:v.totalAmount.isNegative()?"sell":"buy",size:v.unfilledAmount.abs().toString(),
        price:v.price.toString(),timestamp:ts(v.placementTime),kind:"open",
      });
    } else warnings.push(label+": open orders unavailable from Nado");
    if (h.status === "fulfilled") {
      if (h.value.meta.hasMore) warnings.push(label+": older indexed orders not loaded");
      indexedOrders.push(...h.value.orders.map(v=>({
        id:v.digest,subaccount:label,productId:v.productId,symbol:names.get(v.productId)??"Product #"+v.productId,
        side:v.amount.isNegative()?"sell" as const:"buy" as const,
        size:v.amount.abs().toString(),price:v.price.toString(),filled:v.baseFilled.abs().toString(),
        timestamp:ts(v.lastFillTimestamp.toNumber()||v.recvTimeSeconds),kind:"indexed" as const,
      })));
    } else warnings.push(label+": indexed orders unavailable from Nado");
    if(accountSummary.status==="fulfilled") {
      const s=accountSummary.value;
      subaccountHealth.push({subaccount:label,exists:s.exists,maintenanceHealth:s.health.maintenance.health.toString(),initialHealth:s.health.initial.health.toString(),maintenanceAssets:s.health.maintenance.assets.toString(),maintenanceLiabilities:s.health.maintenance.liabilities.toString()});
    } else warnings.push(label+": Nado maintenance health unavailable");
  }
  positions.sort((a,b)=>(b.updatedAt??0)-(a.updatedAt??0));
  openOrders.sort((a,b)=>(b.timestamp??0)-(a.timestamp??0));
  indexedOrders.sort((a,b)=>(b.timestamp??0)-(a.timestamp??0));
  return {
    source:"Nado engine + indexer",chainId,address,updatedAt:new Date().toISOString(),
    subaccounts:selected.map(s=>s.subaccountName||"(unnamed)"),subaccountHealth,
    positions,openOrders,indexedOrders,warnings,incomplete:warnings.length>0,positionCoverageComplete,
  };
}


/**
 * Read-only, independent Nado engine provenance for a SINGLE discovered perp
 * product. These SDK values are observations, not executable order parameters.
 */
export async function getNadoPreflightEngineEvidence(productId:number):Promise<EngineMarketEvidence>{
  if(!Number.isSafeInteger(productId)||productId<0||productId>1000000)
    throw Error("Invalid Nado product ID");
  const eng=engine();
  const [contracts,allMarkets,quote]=await Promise.allSettled([
    eng.getContracts(),
    eng.getAllMarkets(),
    eng.getMarketPrice({productId}),
  ]);
  const warnings:string[]=[];
  if(contracts.status==="rejected")warnings.push("Nado engine contract/chain verification unavailable.");
  if(allMarkets.status==="rejected")warnings.push("Nado engine product configuration unavailable.");
  if(quote.status==="rejected")warnings.push("Nado best bid/ask unavailable.");
  const match=allMarkets.status==="fulfilled"?
    allMarkets.value.filter(m=>m.productId===productId):[];
  if(match.length!==1)warnings.push("Engine did not return exactly one matching product.");
  const market=match.length===1?match[0]:null;
  return {
    observedAt:new Date().toISOString(),
    engineChainId:contracts.status==="fulfilled"?contracts.value.chainId:null,
    engineEndpoint:contracts.status==="fulfilled"?contracts.value.endpointAddr:null,
    productId,
    productType:market?.type===1?"perp":market?.type===0?"spot":null,
    oraclePrice:market?.product.oraclePrice.toString()??null,
    priceIncrement:market?.priceIncrement.toString()??null,
    sizeIncrement:market?.sizeIncrement.toString()??null,
    minSize:market?.minSize.toString()??null,
    bid:quote.status==="fulfilled"&&quote.value.productId===productId?quote.value.bid.toString():null,
    ask:quote.status==="fulfilled"&&quote.value.productId===productId?quote.value.ask.toString():null,
    warnings,
  };
}


/**
 * Queries the engine's official reduce-only maximum for a uniquely discovered
 * CROSS-MARGIN subaccount whose owner is exactly the inspected Ink address.
 * No linked-signer assumptions or executable order material are returned.
 */
export async function getNadoReduceOnlyObservation(args:{
 address:string;subaccount:string;productId:number;positionSide:"long"|"short"
}):Promise<ReduceOnlyObservation>{
 const {address,subaccount,productId,positionSide}=args;
 const fallback=(warning:string):ReduceOnlyObservation=>({
   observedAt:new Date().toISOString(),walletSubaccountMatched:false,
   engineMaxSize:null,priceReference:null,orderSide:null,warning,
 });
 if(!isAddress(address,{strict:false})||typeof subaccount!=="string"||
    subaccount.length>60||!Number.isSafeInteger(productId)||productId<0||
    productId>1_000_000||!["long","short"].includes(positionSide))
   return fallback("Invalid wallet, product or subaccount.");
 const idx=indexer(),eng=engine();
 try{
   const discovered=await idx.listSubaccounts({address,limit:50,start:0});
   if(discovered.length>=50)return fallback("Subaccount discovery reached the page limit.");
   const matching=discovered.filter(s=>
     !s.isolated&&s.subaccountOwner.toLowerCase()===address.toLowerCase()&&
     (s.subaccountName||"(unnamed)")===subaccount);
   if(matching.length!==1)return fallback("Subaccount owner/name could not be uniquely confirmed against the wallet.");
   const actual=matching[0];
   const side=positionSide==="long"?"short" as const:"long" as const;
   const quote=await eng.getMarketPrice({productId});
   if(quote.productId!==productId)return fallback("Engine quote product ID differs from the position.");
   const candidate=side==="short"?quote.bid:quote.ask;
   if(!candidate.isFinite()||!candidate.gt(0))
     return fallback("No positive Nado reference price for the requested reduction side.");
   const maximum=await eng.getMaxOrderSize({
     subaccountOwner:actual.subaccountOwner,
     subaccountName:actual.subaccountName,
     productId,side,price:new BigNumber(candidate.toString()),
     reduceOnly:true,isolated:false,
   });
   if(!maximum.isFinite()||maximum.isNegative())
     return fallback("Nado returned an invalid reduce-only maximum.");
   return {
     observedAt:new Date().toISOString(),walletSubaccountMatched:true,
     engineMaxSize:maximum.toString(),priceReference:candidate.toString(),
     orderSide:side,warning:null,
   };
 }catch{
   return fallback("Nado read-only reduce-only maximum query unavailable or rejected.");
 }
}
