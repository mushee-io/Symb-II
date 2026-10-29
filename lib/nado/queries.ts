import "server-only";
import { EngineClient, ENGINE_CLIENT_ENDPOINTS } from "@nadohq/engine-client";
import { IndexerClient, INDEXER_CLIENT_ENDPOINTS } from "@nadohq/indexer-client";
import { isAddress } from "viem";
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
