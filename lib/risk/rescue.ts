import BigNumber from "bignumber.js";
import type { NadoAccountResponse, NadoMarketsResponse } from "../nado/types.ts";
import type { TydroAccountResponse } from "../tydro/types.ts";
import { simulateNadoFromFeeds } from "./nado-stress.ts";

export type RescueOutcome =
  | { ok: false; reason: string }
  | { ok: true; protocol: "Nado"; kind: "position-reduction";
      symbol: string; quote: string; shockPct: number; reductionPct: number;
      originalPositionSensitivity: string; remainingPositionSensitivity: string;
      originalSize: string; remainingSize: string; snapshotAt: string;
      assumptions: string[] }
  | { ok: true; protocol: "Tydro"; kind: "proportional-debt-reduction";
      repaymentPct: number; currentHealthFactor: string; estimatedHealthFactor: string;
      currentRisk: "urgent"|"caution"|"above-warning-level";
      estimatedRisk: "urgent"|"caution"|"above-warning-level";
      snapshotAt: string; assumptions: string[] };

const allowedReduce=[10,25,50,75] as const;
const allowedRepay=[10,25,50,75] as const;
const plausible=(iso:string,now:number)=>{
  const value=Date.parse(iso);
  return Number.isFinite(value)&&value<=now+5000&&now-value<=180000;
};
const status=(value:BigNumber):"urgent"|"caution"|"above-warning-level"=>
  value.isLessThan(1)?"urgent":value.isLessThan(1.5)?"caution":"above-warning-level";

/**
 * Isolated Nado linear perp sensitivity only. Reducing the hypothetical size
 * proportionally changes price-shock PnL, NOT Nado account collateral or
 * liquidation thresholds. Ticker quotes are not executable trade prices.
 */
export function reviewNadoReduction(args:{
  account:NadoAccountResponse;markets:NadoMarketsResponse;
  positionKey:string;shockPct:number;reductionPct:number;
  now?:number;
}):RescueOutcome {
  if(!(allowedReduce as readonly number[]).includes(args.reductionPct))
    return {ok:false,reason:"Select a reviewed reduction percentage: 10, 25, 50 or 75."};
  if(!/^0x[a-f0-9]{40}$/i.test(args.account.address))
    return {ok:false,reason:"Invalid Ink account address."};
  if(!plausible(args.account.updatedAt,args.now??Date.now()))
    return {ok:false,reason:"Account data is stale. Refresh before reviewing."};
  const existing=simulateNadoFromFeeds(args.account,args.markets,args.positionKey,args.shockPct,args.now);
  if(!existing.ok)return existing;
  try{
    const size=new BigNumber(existing.baseSize);
    const pnl=new BigNumber(existing.pnlChange);
    const remainder=new BigNumber(100-args.reductionPct).dividedBy(100);
    if(!size.isFinite()||!size.isGreaterThan(0)||!pnl.isFinite())
      return {ok:false,reason:"Invalid Nado position sensitivity data."};
    return {
      ok:true,protocol:"Nado",kind:"position-reduction",
      symbol:existing.symbol,quote:existing.quote,
      shockPct:args.shockPct,reductionPct:args.reductionPct,
      originalPositionSensitivity:pnl.toFixed(8),
      remainingPositionSensitivity:pnl.times(remainder).toFixed(8),
      originalSize:size.toFixed(),
      remainingSize:size.times(remainder).toFixed(),
      snapshotAt:existing.snapshotAt,
      assumptions:[
        "This is linear price-shock PnL sensitivity only, using the public ticker reference.",
        "The position reduction is hypothetical; no order, fill, fee, funding or slippage is simulated.",
        "It does not calculate freed collateral, Nado margin health or liquidation risk.",
        "Reducing exposure decreases hypothetical downside AND upside, not guaranteed losses.",
      ],
    };
  }catch{return {ok:false,reason:"Unable to calculate the bounded position scenario."};}
}

/**
 * Proportional reduction in ALL Tydro debt balances, with unchanged
 * liquidation-weighted collateral: HF' = HF / (1 - debtReductionFraction).
 * Not an executable repay transaction; repaying one token differs from
 * proportionally repaying every debt asset. No fiat assumptions.
 */
export function reviewTydroDebtReduction(
  account:TydroAccountResponse,
  repaymentPct:number,
  now=Date.now(),
):RescueOutcome {
  if(!(allowedRepay as readonly number[]).includes(repaymentPct))
    return {ok:false,reason:"Select 10, 25, 50 or 75% of aggregate debt."};
  if(account.chainId!==57073||!/^0x[a-f0-9]{40}$/i.test(account.address)||
     !plausible(account.updatedAt,now))
    return {ok:false,reason:"Tydro network, wallet or snapshot could not be verified as current."};
  if(account.incomplete||account.warnings.length>0)
    return {ok:false,reason:"Tydro account records are incomplete. No scenario is calculated."};
  if(account.userEModeCategory!==0)
    return {ok:false,reason:"Tydro eMode or unknown configuration is not supported by this simplified calculation."};
  if(account.healthFactor===null)
    return {ok:false,reason:"Tydro has no reported debt health factor for this wallet."};
  if(!/^\d+(?:\.\d+)?$/.test(account.healthFactor)||
     !/^\d+(?:\.\d+)?$/.test(account.debtBase))
    return {ok:false,reason:"Health-factor or debt units could not be parsed."};
  try{
    const hf=new BigNumber(account.healthFactor);
    const debt=new BigNumber(account.debtBase);
    if(!hf.isFinite()||!hf.isGreaterThan(0)||
       !debt.isFinite()||!debt.isGreaterThan(0))
      return {ok:false,reason:"A positive health factor and outstanding Tydro debt are required."};
    const remainder=new BigNumber(100-repaymentPct).dividedBy(100);
    const adjusted=hf.dividedBy(remainder);
    if(!adjusted.isFinite())
      return {ok:false,reason:"Unable to calculate a reliable debt sensitivity."};
    return {
      ok:true,protocol:"Tydro",kind:"proportional-debt-reduction",
      repaymentPct,currentHealthFactor:hf.toFixed(),
      estimatedHealthFactor:adjusted.toFixed(6),
      currentRisk:status(hf),estimatedRisk:status(adjusted),
      snapshotAt:account.updatedAt,
      assumptions:[
        "Illustrates reducing EVERY outstanding debt asset by the same percentage.",
        "Liquidation-weighted collateral, oracle prices, interest rates and protocol settings remain unchanged.",
        "Repaying one token is not equivalent to this aggregate scenario when multiple debts exist.",
        "No token amount, transaction, repayment route, borrowing permission or execution quote is produced.",
      ],
    };
  }catch{return {ok:false,reason:"Unable to calculate the bounded lending scenario."};}
}
