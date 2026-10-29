import BigNumber from "bignumber.js";

/**
 * A conservative read-only reduction feasibility check in Nado SDK-native
 * units. Never return a signed order, transaction calldata or price target.
 * Market liquidity, fees, margin, and execution are NOT verified.
 */
export type ReduceOnlyObservation={
  observedAt:string;
  walletSubaccountMatched:boolean;
  engineMaxSize:string|null;
  priceReference:string|null;
  orderSide:"long"|"short"|null;
  warning:string|null;
};
export type ReductionPreview={
  checked:boolean;
  requestedPercent:number;
  currentPositionSize:string;
  floorToIncrement:string|null;
  minimumSize:string|null;
  engineMaxReduceOnly:string|null;
  side:"long"|"short"|null;
  priceReference:string|null;
  sizeIncrement:string|null;
  feasibleBySize:boolean;
  reason:string;
  warnings:string[];
};
const positive=(value:unknown):BigNumber|null=>{
  if(typeof value!=="string"||! /^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value))return null;
  try{
    const n=new BigNumber(value);
    return n.isFinite()&&n.gt(0)&&n.decimalPlaces()!==null&&
      (n.decimalPlaces()??99)<=24?n:null;
  }catch{return null;}
};
const recent=(s:string,now:number)=>{
  const ts=Date.parse(s);
  return Number.isFinite(ts)&&ts<=now+5000&&now-ts<=90_000;
};
export function assessReductionSize(args:{
  positionSize:string;positionSide:"long"|"short";
  minSize:string|null;sizeIncrement:string|null;
  percent:number;observation:ReduceOnlyObservation;
  now?:number;
}):ReductionPreview{
  const {positionSize,positionSide,minSize,sizeIncrement,percent,observation}=args;
  const now=args.now??Date.now();
  const warnings=[
    "Nado engine-native amounts are reference units, not a wallet-authorized order.",
    "Matching engine maximums do not establish margin, liquidity, fees, spread, filled quantity or execution eligibility.",
  ];
  const base={checked:false,requestedPercent:percent,currentPositionSize:positionSize,
    floorToIncrement:null,minimumSize:minSize,engineMaxReduceOnly:observation.engineMaxSize,
    side:observation.orderSide,priceReference:observation.priceReference,
    sizeIncrement,feasibleBySize:false,reason:"Unavailable or inconsistent SDK inputs.",warnings};
  if(![10,25,50,75].includes(percent))
    return {...base,reason:"Unsupported percentage; only 10, 25, 50 and 75 are permitted."};
  if(!observation.walletSubaccountMatched)
    return {...base,reason:"No unique cross-margin subaccount owned by the requested Ink wallet."};
  if(!recent(observation.observedAt,now))
    return {...base,reason:"Engine size observation is stale."};
  const expectedSide=positionSide==="long"?"short":"long";
  if(observation.orderSide!==expectedSide)
    return {...base,reason:"Reduce-only query side did not oppose the existing position."};
  if(!positive(observation.priceReference))
    return {...base,reason:"A valid, current engine best bid/ask price is unavailable."};
  if(observation.warning)warnings.push(observation.warning);
  const position=positive(positionSize),step=positive(sizeIncrement),
    min=positive(minSize),max=positive(observation.engineMaxSize);
  if(!position||!step||!min||!max)
    return {...base,reason:"Position, increment, minimum or engine maximum is missing or invalid.",warnings};
  if(step.gt(position))
    return {...base,reason:"Engine size increment exceeds the currently observed position.",warnings};
  const target=position.times(percent).div(100);
  const steps=target.div(step).integerValue(BigNumber.ROUND_DOWN);
  const floored=steps.times(step);
  if(!floored.isFinite()||floored.lte(0)||floored.gte(position))
    return {...base,reason:"Rounded amount is zero, invalid or not a partial reduction.",warnings};
  if(floored.lt(min))
    return {...base,checked:true,floorToIncrement:floored.toFixed(),
      reason:"Rounded hypothetical reduction is below the engine's minimum resting order size.",warnings};
  if(floored.gt(max))
    return {...base,checked:true,floorToIncrement:floored.toFixed(),
      reason:"Rounded hypothetical reduction exceeds the engine-reported reduce-only maximum.",warnings};
  return {...base,checked:true,floorToIncrement:floored.toFixed(),feasibleBySize:true,
    reason:"Indicative size is within observed engine increments, resting minimum and reduce-only maximum. This does not validate an order.",warnings};
}
