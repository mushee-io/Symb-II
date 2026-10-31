export type PriceObservation={productId:number;at:number;price:number};
const MAX_SAMPLES=80;
const MAX_AGE_MS=3*60*1000;

/** Actual browser-observed Nado indexer samples; never produces synthetic candles or a fabricated history. */
export function recordPriceObservation(
  history:readonly PriceObservation[],
  observation:PriceObservation,
  now=Date.now(),
):PriceObservation[]{
  const {productId,at,price}=observation;
  if(!Number.isSafeInteger(productId)||productId<0||!Number.isFinite(at)||
     at>now+5000||now-at<0||now-at>MAX_AGE_MS||
     !Number.isFinite(price)||price<=0)return history.slice(-MAX_SAMPLES);
  const existing=history.filter(s=>s.productId!==productId||(s.at!==at&&s.at<at));
  return [...existing,{productId,at,price}].slice(-MAX_SAMPLES);
}
export function chartPoints(history:readonly PriceObservation[],productId:number):PriceObservation[]{
  return history.filter(p=>p.productId===productId).sort((a,b)=>a.at-b.at);
}
