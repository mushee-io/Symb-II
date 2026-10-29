import "server-only";
import {
  createPublicClient, formatUnits, getAddress, http, isAddress, type Address,
} from "viem";
import { ink } from "@/lib/ink";
import {
  TYDRO, erc20SymbolAbi, oracleAbi, poolAbi, poolDataProviderAbi, providerAbi,
} from "./contracts";
import type {
  TydroAccountResponse, TydroMarketsResponse, TydroReserve, TydroUserReserve,
} from "./types";

const RAY = 10n ** 27n;
const MAX_RESERVES = 32;
const GROUP_SIZE = 4;

function getClient() {
  return createPublicClient({
    chain: ink,
    transport: http(process.env.INK_RPC_URL || process.env.NEXT_PUBLIC_INK_RPC_URL || ink.rpcUrls.default.http[0], {
      timeout: 12000,
      retryCount: 1,
    }),
  });
}
function apr(rate: bigint) {
  const value = Number(rate) / Number(RAY) * 100;
  return Number.isFinite(value) ? value : 0;
}
function ratio(bps: bigint) { return Number(bps) / 100; }
function powerOfTenDecimals(unit: bigint): number {
  if (unit <= 0n) throw new Error("Invalid oracle base currency unit");
  let current = unit;
  let decimals = 0;
  while (current > 1n && current % 10n === 0n) { current /= 10n; decimals++; }
  if (current !== 1n || decimals > 36) throw new Error("Unrecognised oracle base currency unit");
  return decimals;
}
async function checkedPool() {
  const client = getClient();
  const deployed = await client.readContract({
    address: TYDRO.poolAddressesProvider,
    abi: providerAbi,
    functionName: "getPool",
  });
  if (deployed.toLowerCase() !== TYDRO.pool.toLowerCase()) {
    throw new Error("Tydro pool differs from the pinned, independently verified address");
  }
  return client;
}
async function batches<T,U>(items: readonly T[], fn:(item:T)=>Promise<U>):Promise<PromiseSettledResult<U>[]> {
  const results: PromiseSettledResult<U>[] = [];
  for(let i=0;i<items.length;i+=GROUP_SIZE){
    results.push(...await Promise.allSettled(items.slice(i,i+GROUP_SIZE).map(fn)));
  }
  return results;
}
function marketFailure(label: string) {
  return label + " reserve data was unavailable; results are partial.";
}

/** Always query the configured Ink pool; never return synthetic rates. */
export async function getTydroMarkets(): Promise<TydroMarketsResponse> {
  const client = await checkedPool();
  const assets = await client.readContract({
    address: TYDRO.pool,
    abi: poolAbi,
    functionName: "getReservesList",
  });
  if (assets.length > MAX_RESERVES) {
    throw new Error("Reserve count exceeded the reviewed query limit. Update adapter before showing partial markets.");
  }
  const results = await batches(assets, async (asset): Promise<TydroReserve> => {
    const calls = await client.multicall({
      contracts: [
        { address: asset, abi: erc20SymbolAbi, functionName: "symbol" },
        { address: TYDRO.poolDataProvider, abi: poolDataProviderAbi, functionName: "getReserveConfigurationData", args: [asset] },
        { address: TYDRO.poolDataProvider, abi: poolDataProviderAbi, functionName: "getReserveData", args: [asset] },
      ],
      multicallAddress: TYDRO.multicall3,
      allowFailure: true,
    });
    if (calls[1].status !== "success" || calls[2].status !== "success") {
      throw Error("Tydro reserve data could not be decoded");
    }
    const config = calls[1].result;
    const data = calls[2].result;
    const decimals = Number(config[0]);
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw Error("Invalid reserve decimals");
    const name = calls[0].status === "success" ? calls[0].result : asset.slice(0,8)+"…";
    return {
      address: getAddress(asset),
      symbol: name,
      decimals,
      supplied: formatUnits(data[2],decimals),
      borrowed: formatUnits(data[3] + data[4],decimals),
      supplyAprPct: apr(data[5]),
      borrowAprPct: apr(data[6]),
      ltvPct: ratio(config[1]),
      liquidationThresholdPct: ratio(config[2]),
      collateralEligible: config[5],
      borrowEnabled: config[6],
      active: config[8],
      frozen: config[9],
    };
  });
  const reserves:TydroReserve[] = [];
  const warnings:string[] = [];
  for (let i=0;i<results.length;i++) {
    const r = results[i];
    if (r.status==="fulfilled") {
      reserves.push(r.value);
      if (r.value.symbol.endsWith("…")) warnings.push("Token metadata unavailable for "+r.value.address);
    } else warnings.push(marketFailure(assets[i]));
  }
  return {
    source:"Tydro (Aave V3 Ink) contracts", chainId:57073,
    updatedAt:new Date().toISOString(),pool:TYDRO.pool,
    reserves,warnings,incomplete:warnings.length>0,
  };
}

/** Public on-chain inspection. A supplied address is not an authenticated session. */
export async function getTydroAccount(address:string):Promise<TydroAccountResponse> {
  if (!isAddress(address,{strict:false})) throw Error("Invalid address");
  const account = getAddress(address);
  const client = await checkedPool();
  const [market,accountData,unit,eModeQuery] = await Promise.all([
    getTydroMarkets(),
    client.readContract({address:TYDRO.pool,abi:poolAbi,functionName:"getUserAccountData",args:[account]}),
    client.readContract({address:TYDRO.oracle,abi:oracleAbi,functionName:"BASE_CURRENCY_UNIT"}),
    client.readContract({address:TYDRO.pool,abi:poolAbi,functionName:"getUserEMode",args:[account]}).catch(() => null),
  ]);
  const decimals=powerOfTenDecimals(unit);
  const results=await batches(market.reserves,async (reserve):Promise<TydroUserReserve>=>{
    const result=await client.readContract({
      address:TYDRO.poolDataProvider,abi:poolDataProviderAbi,
      functionName:"getUserReserveData",args:[getAddress(reserve.address) as Address,account],
    });
    const active = result[0] > 0n || result[1] > 0n || result[2] > 0n;
    const price = active ? await client.readContract({
      address:TYDRO.oracle, abi:oracleAbi, functionName:"getAssetPrice",
      args:[getAddress(reserve.address) as Address],
    }).catch(()=>null) : null;
    return {
      address:reserve.address,symbol:reserve.symbol,
      decimals:reserve.decimals,
      liquidationThresholdBps:Math.round(reserve.liquidationThresholdPct*100),
      oraclePriceRaw:price===null||price<=0n?null:price.toString(),
      supplied:formatUnits(result[0],reserve.decimals),
      stableDebt:formatUnits(result[1],reserve.decimals),
      variableDebt:formatUnits(result[2],reserve.decimals),
      usingAsCollateral:result[8],
    };
  });
  const warnings=market.warnings.slice();
  const userReserves:TydroUserReserve[]=[];
  for(let i=0;i<results.length;i++){
    const result=results[i];
    if(result.status==="fulfilled") {
      const r=result.value;
      if(Number(r.supplied)>0||Number(r.stableDebt)>0||Number(r.variableDebt)>0){
        userReserves.push(r);
        if(r.oraclePriceRaw===null) warnings.push("Oracle price for "+r.symbol+" unavailable; stress simulation disabled.");
      }
    } else warnings.push("Could not read user balance for "+market.reserves[i].symbol);
  }
  if(eModeQuery===null) warnings.push("Tydro eMode status could not be read; stress simulation disabled.");
  const hasDebt=accountData[1]>0n;
  return {
    source:"Tydro (Aave V3 Ink) contracts",chainId:57073,
    updatedAt:new Date().toISOString(),address:account,pool:TYDRO.pool,
    collateralBase:formatUnits(accountData[0],decimals),
    debtBase:formatUnits(accountData[1],decimals),
    availableBorrowsBase:formatUnits(accountData[2],decimals),
    baseCurrency:"Oracle base units",
    healthFactor:hasDebt?formatUnits(accountData[5],18):null,
    userEModeCategory:eModeQuery===null?null:Number(eModeQuery),
    oraclePriceDecimals:decimals,
    liquidationThresholdPct:ratio(accountData[3]),
    ltvPct:ratio(accountData[4]),
    userReserves,warnings,incomplete:warnings.length>0,
  };
}
