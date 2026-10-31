import type {EngineMarketEvidence} from "@/lib/preflight/nado-evidence";

export type SafeTopOfBook={status:"ready";bid:number;ask:number;spreadPct:number;observedAt:string}
  |{status:"unknown";reason:string};

/** Reject incomplete or stale top-of-book. Quotes are observations only, never executable orders. */
export function assessTopOfBook(evidence:EngineMarketEvidence|null,productId:number,now=Date.now()):SafeTopOfBook{
  if(!evidence||!Number.isSafeInteger(productId)||evidence.productId!==productId||
    evidence.productType!=="perp"||evidence.engineChainId!==57073||
    !Array.isArray(evidence.warnings)||evidence.warnings.length>0)
    return {status:"unknown",reason:"Nado engine quote evidence is incomplete, wrong-chain or for a different product."};
  const t=Date.parse(evidence.observedAt);
  if(!Number.isFinite(t)||t>now+5000||now-t<0||now-t>90_000)
    return {status:"unknown",reason:"Top-of-book evidence is stale or has an invalid timestamp."};
  if(typeof evidence.bid!=="string"||typeof evidence.ask!=="string"||
    !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(evidence.bid)||
    !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(evidence.ask))
    return {status:"unknown",reason:"Bid and ask evidence is missing or malformed."};
  const bid=Number(evidence.bid),ask=Number(evidence.ask);
  if(!Number.isFinite(bid)||!Number.isFinite(ask)||bid<=0||ask<=0||bid>ask)
    return {status:"unknown",reason:"Nado engine bid/ask are missing, invalid or crossed."};
  const spreadPct=100*(ask-bid)/((ask+bid)/2);
  if(!Number.isFinite(spreadPct))return {status:"unknown",reason:"Spread could not be calculated."};
  return {status:"ready",bid,ask,spreadPct,observedAt:evidence.observedAt};
}
