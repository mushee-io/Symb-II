import "server-only";
import {
  createPublicClient,formatEther,formatUnits,formatGwei,http,parseAbi,type Address,
} from "viem";
import {ink} from "@/lib/ink";
import {getTydroAccount,getTydroMarkets} from "@/lib/tydro/queries";
import {TYDRO,providerAbi,poolDataProviderAbi} from "@/lib/tydro/contracts";
import {finalizePreflight,type Gate,type PreflightReport,type PreflightRequest} from "./policy";
import {diagnoseApproval,describeApprovalSimulation,gasBudgetWei} from "./approval";
import {reconcileDebt,exactPartialDebt,blockEvidence} from "./evidence";

const tokenAbi=parseAbi([
 "function balanceOf(address owner) view returns (uint256)",
 "function allowance(address owner,address spender) view returns (uint256)",
]);
const decimalsAbi=parseAbi(["function decimals() view returns (uint8)"]);
const approveAbi=parseAbi([
 "function approve(address spender,uint256 amount) returns (bool)",
]);
const repayAbi=parseAbi([
 "function repay(address asset,uint256 amount,uint256 interestRateMode,address onBehalfOf) returns (uint256)",
]);
const client=()=>createPublicClient({
 chain:ink,transport:http(process.env.INK_RPC_URL || ink.rpcUrls.default.http[0],{timeout:12000,retryCount:1}),
});
const gate=(name:string,state:Gate["state"],detail:string):Gate=>({name,state,detail});

/** Only reads state, simulates eth_call and estimates gas. Cannot approve or repay. */
export async function preflightTydro(request:Extract<PreflightRequest,{kind:"tydro-variable-repay"}>):Promise<PreflightReport>{
 const publicClient=client();
 const wallet=request.wallet as Address,asset=request.asset as Address;
 const [onchainPool,startBlock,chainId,account,markets]=await Promise.all([
  publicClient.readContract({address:TYDRO.poolAddressesProvider,abi:providerAbi,functionName:"getPool"}),
  publicClient.getBlockNumber(),publicClient.getChainId(),
  getTydroAccount(wallet),getTydroMarkets(),
 ]);
 if(onchainPool.toLowerCase()!==TYDRO.pool.toLowerCase())
   throw Error("Pinned Tydro Pool verification failed.");
 const reserve=markets.reserves.find(r=>r.address.toLowerCase()===asset.toLowerCase());
 const user=account.userReserves.find(r=>r.address.toLowerCase()===asset.toLowerCase());
 const decimals=reserve?.decimals??user?.decimals??0;
 const debt=user?.variableDebt??"0";
 // All safety-critical contract values below are independently read at one
 // pinned Ink block, not reconstructed from UI-formatted balances.
 const startHeader=await publicClient.getBlock({blockNumber:startBlock}).catch(()=>null);
 const pinned=await Promise.allSettled([
   publicClient.readContract({address:TYDRO.poolAddressesProvider,abi:providerAbi,
     functionName:"getPool",blockNumber:startBlock}),
   publicClient.readContract({address:TYDRO.poolDataProvider,abi:poolDataProviderAbi,
     functionName:"getUserReserveData",args:[asset,wallet],blockNumber:startBlock}),
   publicClient.readContract({address:TYDRO.poolDataProvider,abi:poolDataProviderAbi,
     functionName:"getReserveConfigurationData",args:[asset],blockNumber:startBlock}),
   publicClient.readContract({address:asset,abi:decimalsAbi,
     functionName:"decimals",blockNumber:startBlock}),
   publicClient.getCode({address:asset,blockNumber:startBlock}),
   publicClient.getCode({address:TYDRO.pool,blockNumber:startBlock}),
 ]);
 const pinnedPool=pinned[0].status==="fulfilled"?pinned[0].value:null;
 const pinnedUser=pinned[1].status==="fulfilled"?pinned[1].value:null;
 const pinnedConfig=pinned[2].status==="fulfilled"?pinned[2].value:null;
 const pinnedDecimals=pinned[3].status==="fulfilled"?Number(pinned[3].value):null;
 const tokenCode=pinned[4].status==="fulfilled"?pinned[4].value:null;
 const poolCode=pinned[5].status==="fulfilled"?pinned[5].value:null;
 const pinnedContractsValid=pinnedPool?.toLowerCase()===TYDRO.pool.toLowerCase() &&
   typeof tokenCode==="string"&&tokenCode!=="0x"&&
   typeof poolCode==="string"&&poolCode!=="0x";
 const pinnedRawDebt=pinnedUser?.[2]??0n;
 const debtEvidence=reconcileDebt({
   rawDebt:pinnedRawDebt,displayed:debt,
   sourceDecimals:decimals,
   reserveDecimals:pinnedConfig?Number(pinnedConfig[0]):-1,
   tokenDecimals:pinnedDecimals??-1,
 });
 const pinnedReserveValid=pinnedConfig?.[8]===true&&pinnedConfig?.[9]===false;
 const now=Date.now();
 const sourcesFresh=[account.updatedAt,markets.updatedAt].every(iso=>{
   const timestamp=Date.parse(iso);
   return Number.isFinite(timestamp)&&timestamp<=now+5000&&now-timestamp<90_000;
 });
 const gates:Gate[]=[
  gate("Wallet and Ink network",chainId===57073&&account.chainId===57073&&
   account.address.toLowerCase()===wallet.toLowerCase()?"pass":"fail",
   "RPC, wallet and protocol must identify Ink chain 57073."),
  gate("Pinned Pool",account.pool.toLowerCase()===TYDRO.pool.toLowerCase()&&pinnedContractsValid?"pass":"fail",
   "Provider, Pool and token bytecode must exist and the pinned Pool address must match."),
  gate("Complete coverage",!account.incomplete&&!markets.incomplete&&account.warnings.length===0?"pass":"fail",
   "Requires complete reserve and account data with no missing oracle/balance fields."),
  gate("Fresh source timestamps",sourcesFresh?"pass":"fail",
   "Account and reserve responses must be under 90 seconds old."),
  gate("Risk mode",account.userEModeCategory===0?"pass":"fail",
   "This first preflight supports only standard non-eMode accounts."),
  gate("Reserve",reserve?.active===true&&reserve?.frozen===false&&pinnedReserveValid?"pass":"fail",
   "Both the displayed and block-pinned reserve configurations must be active and unfrozen."),
  gate("Pinned debt and token decimals",debtEvidence.matched?"pass":"fail",debtEvidence.reason),
 ];
 const debtRaw=debtEvidence.matched?pinnedRawDebt:0n;
 const atomic=exactPartialDebt(debtRaw,request.percent)??0n;
 gates.push(gate("Variable debt",debtRaw>0n?"pass":"fail",
   "A positive on-chain variable debt balance is required; stable debt is excluded."));
 gates.push(gate("Exact partial amount",atomic>0n&&atomic<debtRaw?"pass":"fail",
   "Exactly 10/25/50/75% of that variable debt, rounded down to token atomic units. No full-repay sentinel."));
 let tokenBalance:bigint|null=null,allowance:bigint|null=null,native:bigint|null=null,maxFeePerGas:bigint|null=null;
 const observed=await Promise.allSettled([
   publicClient.readContract({address:asset,abi:tokenAbi,functionName:"balanceOf",args:[wallet],blockNumber:startBlock}),
   publicClient.readContract({address:asset,abi:tokenAbi,functionName:"allowance",args:[wallet,TYDRO.pool],blockNumber:startBlock}),
   publicClient.getBalance({address:wallet,blockNumber:startBlock}),
   publicClient.estimateFeesPerGas({type:"eip1559"}),
 ]);
 if(observed[0].status==="fulfilled")tokenBalance=observed[0].value;
 if(observed[1].status==="fulfilled")allowance=observed[1].value;
 if(observed[2].status==="fulfilled")native=observed[2].value;
 if(observed[3].status==="fulfilled")maxFeePerGas=observed[3].value.maxFeePerGas;
 const initialSafe=gates.every(g=>g.state==="pass");
 const approval=diagnoseApproval(atomic,allowance);
 let approvalCall:boolean|null=null,zeroResetCall:boolean|null=null,approvalGas:bigint|null=null;
 // For missing allowance, attempt only a read-only approve(pool, exactAmount) call.
 // A nonstandard token with nonzero allowance may require a separate reset-to-zero.
 // These simulated calls cannot establish sequential success or change allowances.
 if(initialSafe&&approval.kind==="missing"){
   try{
     const simulated=await publicClient.simulateContract({
       account:wallet,address:asset,abi:approveAbi,functionName:"approve",args:[TYDRO.pool,atomic],blockNumber:startBlock,
     });
     approvalCall=simulated.result===true;
     if(approvalCall){
       approvalGas=await publicClient.estimateContractGas({
         account:wallet,address:asset,abi:approveAbi,functionName:"approve",args:[TYDRO.pool,atomic],blockNumber:startBlock,
       });
     }
   }catch{approvalCall=false;}
   if(approvalCall===false&&allowance!==null&&allowance>0n){
     try{
       const reset=await publicClient.simulateContract({
         account:wallet,address:asset,abi:approveAbi,functionName:"approve",args:[TYDRO.pool,0n],blockNumber:startBlock,
       });
       zeroResetCall=reset.result===true;
     }catch{zeroResetCall=false;}
   }
 }
 const approvalInfo=describeApprovalSimulation({
   diagnosis:approval,directSimulationPassed:approvalCall,
   zeroResetSimulationPassed:zeroResetCall,gasUnits:approvalGas,
 });
 gates.push(gate("ERC20 wallet balance",
   tokenBalance===null?"unknown":tokenBalance>=atomic&&atomic>0n?"pass":"fail",
   "Borrower must already hold the exact underlying token amount."));
 gates.push(gate("Existing ERC20 Pool allowance",
   allowance===null?"unknown":allowance>=atomic&&atomic>0n?"pass":"fail",
   "An approval simulation does not change allowance; exact Pool allowance must already exist for repay simulation."));
 gates.push(gate("EIP-1559 RPC fee estimate",
   maxFeePerGas!==null&&maxFeePerGas>0n?"pass":"unknown",
   "Observed maxFeePerGas; excludes OP Stack L1 data fees and is not a guaranteed maximum."));
 let repayGas:bigint|null=null;
 let repayError="Prerequisites not met; no repay call was simulated.";
 if(gates.every(g=>g.state==="pass")&&native!==null){
   const args=[asset,atomic,2n,wallet] as const;
   try{
     const simulation=await publicClient.simulateContract({
       account:wallet,address:TYDRO.pool,abi:repayAbi,functionName:"repay",args,blockNumber:startBlock,
     });
     if(simulation.result<=0n)throw Error("Zero repayment simulated");
     repayGas=await publicClient.estimateContractGas({
       account:wallet,address:TYDRO.pool,abi:repayAbi,functionName:"repay",args,blockNumber:startBlock,
     });
   }catch{repayError="Repay eth_call or gas estimation reverted; no safe repay claim can be made.";}
 }
 gates.push(gate("Variable-debt repay eth_call",
   repayGas!==null?"pass":"fail",
   repayGas!==null?"Read-only repay(amount, mode=2, wallet) simulated and estimated; no transaction was sent.":repayError));
 const feeBudget=gasBudgetWei(repayGas,maxFeePerGas);
 gates.push(gate("Native ETH fee buffer",
   native===null||feeBudget===null?"unknown":native>=feeBudget?"pass":"fail",
   "Wallet ETH compared to 1.5× gas estimate × observed EIP-1559 maxFeePerGas, excluding L1 data fee."));
 const endBlock=await publicClient.getBlockNumber();
 let endTimestamp:bigint|null=null;
 try{endTimestamp=(await publicClient.getBlock({blockNumber:endBlock})).timestamp;}catch{}
 const startHash=startHeader?.hash??null;
 const startTimestamp=startHeader?.timestamp??null;
 let recheckHash:string|null=null;
 try{recheckHash=(await publicClient.getBlock({blockNumber:startBlock})).hash;}
 catch{/* Missing recheck causes report to fail closed. */}
 const proof=blockEvidence({
   startNumber:startBlock,endNumber:endBlock,startHash,recheckHash,
   startTimestamp,endTimestamp,nowSeconds:BigInt(Math.floor(Date.now()/1000)),
 });
 gates.push(gate("Pinned block hash and freshness",proof.matched?"pass":"fail",proof.reason));
 const approvalBudget=gasBudgetWei(approvalGas,maxFeePerGas);
 return finalizePreflight({
   version:1,network:"Ink",chainId:57073,kind:request.kind,wallet,asset,
   createdAt:new Date().toISOString(),blockNumber:endBlock.toString(),
   reviewOnly:true,executionEnabled:false,transactionPayload:null,
   amount:atomic>0n&&reserve?{value:formatUnits(atomic,decimals),symbol:reserve.symbol,decimals}:null,
   target:{protocol:"Tydro",name:"Pinned Pool — repay variable debt",address:TYDRO.pool},
   gas:{estimatedUnits:repayGas?.toString()??null,
     maxEstimatedNativeFee:feeBudget!==null?formatEther(feeBudget):null,
     nativeBalance:native!==null?formatEther(native):null,
     feeModel:maxFeePerGas!==null?"eip1559":"unavailable",
     maxFeePerGasGwei:maxFeePerGas!==null?formatGwei(maxFeePerGas):null,
     approvalEstimatedGasUnits:approvalGas?.toString()??null,
     approvalFeeScreeningEth:approvalBudget!==null?formatEther(approvalBudget):null},
   allowance:{required:atomic>0n&&reserve?formatUnits(atomic,decimals):null,
     current:allowance!==null&&reserve?formatUnits(allowance,decimals):null,
     sufficient:allowance!==null&&atomic>0n?allowance>=atomic:null},
   snapshotEvidence:{
     number:startBlock.toString(),hash:startHash,verified:proof.matched,
     variableDebtAtomic:debtEvidence.rawDebt,accountDebtDeviationAtomic:debtEvidence.deviation,
     tokenDecimals:pinnedDecimals,
     explanation:debtEvidence.reason,
   },
   approvalDiagnostics:{
     status:approvalInfo.status,
     description:approvalInfo.detail,
     tokenAddress:asset,spender:TYDRO.pool,
     required:approval.required>0n&&reserve?formatUnits(approval.required,decimals):null,
     existing:allowance!==null&&reserve?formatUnits(allowance,decimals):null,
     shortfall:approval.missing!==null&&reserve?formatUnits(approval.missing,decimals):null,
   },
   gates,
 });
}
