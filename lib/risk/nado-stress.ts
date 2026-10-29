import BigNumber from "bignumber.js";
import type { NadoMarket, NadoPosition, NadoAccountResponse, NadoMarketsResponse } from "../nado/types.ts";

/**
 * Read-only linear perpetual sensitivity, in the ticker's quote currency.
 *
 * This is NOT a Nado margin health, liquidation-price, fill-price or funding
 * calculation. Ticker last price is not asserted to be Nado's liquidation mark.
 * No cross-margin or collateral balances are changed.
 */
export type NadoStressResult =
  | { ok: true; symbol: string; quote: string; side: NadoPosition["side"];
      shockPct: number; lastPrice: string; shockedPrice: string; baseSize: string;
      referenceNotional: string; pnlChange: string; snapshotAt: string }
  | { ok: false; reason: string };

const MAX_SNAPSHOT_AGE_MS=120_000;
const MAX_POSITION_AGE_MS=180_000;
function recent(iso: string, now: number, maxAge: number) {
  const ts=Date.parse(iso);
  return Number.isFinite(ts) && ts<=now+5000 && now-ts<=maxAge;
}

export function simulateNadoPosition(
  position: NadoPosition,
  market: NadoMarket,
  shockPct: number,
  snapshots: { marketUpdatedAt: string; accountUpdatedAt: string },
  now=Date.now(),
): NadoStressResult {
  if(!Number.isInteger(shockPct)||shockPct < -50||shockPct>50)
    return {ok:false,reason:"Select a whole-number price change from -50% to +50%."};
  if(market.type!=="perp"||position.productId!==market.productId)
    return {ok:false,reason:"No matching perpetual market quote for this Nado position."};
  if(!recent(snapshots.marketUpdatedAt,now,MAX_SNAPSHOT_AGE_MS)||
     !recent(snapshots.accountUpdatedAt,now,MAX_POSITION_AGE_MS))
    return {ok:false,reason:"Market or position snapshot is stale. Refresh Nado data to continue."};
  if(!/^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(position.size) ||
     !Number.isFinite(market.lastPrice) || !["long","short"].includes(position.side))
    return {ok:false,reason:"Invalid position size, side or Nado market price."};
  const size=new BigNumber(position.size);
  const price=new BigNumber(market.lastPrice);
  if(!size.isFinite()||!size.isGreaterThan(0)||
     !price.isFinite()||!price.isGreaterThan(0)||
     !market.quote||!/^[a-z0-9]+$/i.test(market.quote))
    return {ok:false,reason:"The position size, ticker price or quote unit is unavailable."};
  if(!Number.isFinite(market.lastPrice)||(size.decimalPlaces() ?? 99)>24)
    return {ok:false,reason:"Position size precision or quote data is unsupported."};
  const scenarioMultiplier=new BigNumber(100+shockPct).dividedBy(100);
  const shockedPrice=price.multipliedBy(scenarioMultiplier);
  const change=shockedPrice.minus(price).multipliedBy(size)
    .multipliedBy(position.side==="long"?1:-1);
  if(!change.isFinite()||!shockedPrice.isFinite())
    return {ok:false,reason:"Could not compute the hypothetical price sensitivity."};
  return {
    ok:true, symbol:market.symbol, quote:market.quote, side:position.side,
    shockPct, lastPrice:price.toFixed(), shockedPrice:shockedPrice.toFixed(),
    baseSize:size.toFixed(),
    referenceNotional:size.multipliedBy(price).toFixed(8),
    pnlChange:change.toFixed(8),
    snapshotAt:snapshots.marketUpdatedAt,
  };
}

/**
 * Refuses partial data instead of silently calling a filtered or missing
 * position/market set complete. Returned risk sensitivity is position-level.
 */
export function simulateNadoFromFeeds(
  account: NadoAccountResponse,
  markets: NadoMarketsResponse,
  positionKey: string,
  shockPct: number,
  now=Date.now(),
): NadoStressResult {
  if(account.chainId!==57073||markets.chainId!==57073||
    account.positionCoverageComplete!==true||markets.markets.length===0)
    return {ok:false,reason:"Nado account or market coverage is incomplete."};
  if(!Array.isArray(account.positions)||!Array.isArray(markets.markets))
    return {ok:false,reason:"Invalid Nado response shape."};
  const position=account.positions.find(p=>nadoPositionKey(p)===positionKey);
  if(!position) return {ok:false,reason:"Choose an open perpetual position from the latest wallet records."};
  const market=markets.markets.find(m=>m.productId===position.productId && m.type==="perp");
  if(!market) return {ok:false,reason:"This position has no corresponding live perpetual ticker."};
  return simulateNadoPosition(position,market,shockPct,{
    marketUpdatedAt:markets.updatedAt,accountUpdatedAt:account.updatedAt,
  },now);
}

export function nadoPositionKey(p:NadoPosition){
  return [p.subaccount,p.productId,p.id].join(":");
}
