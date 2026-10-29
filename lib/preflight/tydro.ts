import "server-only";
import {
  createPublicClient, formatEther,formatUnits,http,parseAbi,
  type Address,
} from "viem";
import {ink} from "@/lib/ink";
import {getTydroAccount,getTydroMarkets} from "@/lib/tydro/queries";
import {TYDRO,poolAbi,providerAbi} from "@/lib/tydro/contracts";
import {finalizePreflight,type Gate,type PreflightReport,type PreflightRequest} from "./policy";

const tokenAbi=parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
]);
const repayAbi=parseAbi([
  "function repay(address asset,uint256 amount,uint256 interestRateMode,address onBehalfOf) returns (uint256)"
]);
const client=()=>createPublicClient({
  chain:ink,transport:http(process.env.INK_RPC_URL || ink.rpcUrls.default.http[0],{timeout:12000,retryCount:1}),
});
const gate=(name:string,state:Gate["state"],detail:string):Gate=>({name,state,detail});

export async function preflightTydro(request:Extract<PreflightRequest,{kind:"tydro-variable-repay"}>):Promise<PreflightReport>{
 const publicClient=client();
 const wallet=request.wallet as Address,asset=request.asset as Address;
 const [onchainPool,blockNumber,account,markets]=await Promise.all([
   publicClient.readContract({address:TYDRO.poolAddressesProvider,abi:providerAbi,functionName:"getPool"}),
   publicClient.getBlockNumber(),
   getTydroAccount(wallet),getTydroMarkets(),
 ]);
 if(onchainPool.toLowerCase()!==TYDRO.pool.toLowerCase())throw Error("Pinned Tydro Pool verification failed");
 const reserve=markets.reserves.find(x=>x.address.toLowerCase()===asset.toLowerCase());
 const user=account.userReserves.find(x=>x.address.toLowerCase()===asset.toLowerCase());
 const debt=user?.variableDebt??"0";
 const decimals=reserve?.decimals??user?.decimals??0;
 const now=new Date().toISOString();
 const gates:Gate[]=[
   gate("Wallet and Ink network",account.chainId===57073&&account.address.toLowerCase()===wallet.toLowerCase()?"pass":"fail","Wallet, protocol and chain 57073 must match"),
   gate("Verified Pool",account.pool.toLowerCase()===TYDRO.pool.toLowerCase()?"pass":"fail","Contract address matched the independently pinned Ink deployment"),
   gate("Coverage",!account.incomplete&&!markets.incomplete&&account.warnings.length===0?"pass":"fail","All queried reserve/account data must be complete"),
   gate("Risk mode",account.userEModeCategory===0?"pass":"fail","Only standard non-eMode accounts are supported in this initial preflight"),
   gate("Reserve",reserve?.active===true&&reserve?.frozen===false?"pass":"fail","Reserve must be known, active and unfrozen"),
   gate("Debt mode",!!user&&/^\d+(\.\d+)?$/.test(debt)&&Number(debt)>0?"pass":"fail","A positive on-chain variable debt balance is required; stable debt is not part of this action"),
 ];
 // viem parseUnits guarantees integer atomic amount with strict token precision.
 let atomic=0n, debtRaw=0n;
 if(user&&reserve&&Number.isInteger(decimals)&&decimals>=0&&decimals<=36){
   const {parseUnits}=await import("viem");
   try{
     debtRaw=parseUnits(debt,decimals);
     atomic=debtRaw*BigInt(request.percent)/100n;
   }catch{/*invalid onchain formatted decimal*/}
 }
 gates.push(gate("Exact repayment amount",atomic>0n&&atomic<debtRaw?"pass":"fail",
   "Rounded down to native token units and strictly less than one current variable-debt balance"));
 let tokenBalance:bigint|null=null,allowance:bigint|null=null,gasPrice:bigint|null=null,gas:bigint|null=null,native:bigint|null=null;
 // Read only. Never expose repay calldata, target transaction, wallet
 // signing request or token approval instructions to a client.
 const settled=await Promise.allSettled([
   publicClient.readContract({address:asset,abi:tokenAbi,functionName:"balanceOf",args:[wallet]}),
   publicClient.readContract({address:asset,abi:tokenAbi,functionName:"allowance",args:[wallet,TYDRO.pool]}),
   publicClient.getBalance({address:wallet}),
   publicClient.getGasPrice(),
 ]);
 if(settled[0].status==="fulfilled")tokenBalance=settled[0].value;
 if(settled[1].status==="fulfilled")allowance=settled[1].value;
 if(settled[2].status==="fulfilled")native=settled[2].value;
 if(settled[3].status==="fulfilled")gasPrice=settled[3].value;
 gates.push(gate("ERC20 balance",tokenBalance===null?"unknown":tokenBalance>=atomic&&atomic>0n?"pass":"fail",
   tokenBalance===null?"Token balance could not be read":"Wallet must have enough of the exact borrowed underlying token"));
 gates.push(gate("ERC20 Pool allowance",allowance===null?"unknown":allowance>=atomic&&atomic>0n?"pass":"fail",
   allowance===null?"Allowance could not be read":"Checks allowance for the *verified Tydro Pool* only; never requests approval"));
 let gasError="Unavailable until all token gates and RPC requirements pass";
 const tokenReady=atomic>0n&&gates.every(g=>g.state==="pass")&&native!==null&&gasPrice!==null;
 if(tokenReady){
   const args=[asset,atomic,2n,wallet] as const;
   try{
     // eth_call simulation with caller set to the wallet. This does not
     // submit a transaction and the app never sends a signing payload.
     await publicClient.simulateContract({account:wallet,address:TYDRO.pool,abi:repayAbi,functionName:"repay",args});
     gas=await publicClient.estimateContractGas({account:wallet,address:TYDRO.pool,abi:repayAbi,functionName:"repay",args});
   }catch{gasError="Pool simulation or on-chain gas estimation reverted; no executable approval can be inferred";}
 }
 gates.push(gate("Pool eth_call and gas estimate",gas===null?"fail":"pass",gas===null?gasError:"Live repay call simulated and gas estimated without broadcasting"));
 // Gas price is a CURRENT observation, not an actual maxFeePerGas or
 // guaranteed fee. Buffer is a screening heuristic, never a fee quote.
 const padded=gas!==null&&gasPrice!==null?gas*gasPrice*150n/100n:null;
 gates.push(gate("Ink gas balance",native===null||padded===null?"unknown":native>=padded?"pass":"fail",
   "Current ETH balance compared against estimated gas × gas price × 1.5; not a guaranteed max fee"));
 const end=await publicClient.getBlockNumber();
 gates.push(gate("Fresh on-chain snapshot",end-blockNumber<=3n?"pass":"fail",
   "Block number remained within 3 Ink blocks during the read; rerun for up-to-date execution conditions"));
 return finalizePreflight({
   version:1,network:"Ink",chainId:57073,kind:request.kind,wallet,asset,
   createdAt:now,blockNumber:end.toString(),reviewOnly:true,
   executionEnabled:false,transactionPayload:null,
   amount:atomic>0n&&reserve?{value:formatUnits(atomic,decimals),symbol:reserve.symbol,decimals}:null,
   target:{protocol:"Tydro",name:"Verified Pool — repay variable debt",address:TYDRO.pool},
   gas:{estimatedUnits:gas?.toString()??null,
     maxEstimatedNativeFee:padded!==null?formatEther(padded):null,
     nativeBalance:native!==null?formatEther(native):null},
   allowance:{required:atomic>0n&&reserve?formatUnits(atomic,decimals):null,
     current:allowance!==null&&reserve?formatUnits(allowance,decimals):null,
     sufficient:allowance!==null&&atomic>0n?allowance>=atomic:null},
   gates,
 });
}
