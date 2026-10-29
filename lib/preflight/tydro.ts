import "server-only";
import {
  createPublicClient,formatEther,formatUnits,formatGwei,http,parseAbi,parseUnits,type Address,
} from "viem";
import {ink} from "@/lib/ink";
import {getTydroAccount,getTydroMarkets} from "@/lib/tydro/queries";
import {TYDRO,providerAbi} from "@/lib/tydro/contracts";
import {finalizePreflight,type Gate,type PreflightReport,type PreflightRequest} from "./policy";
import {diagnoseApproval,describeApprovalSimulation,gasBudgetWei} from "./approval";

const tokenAbi=parseAbi([
 "function balanceOf(address owner) view returns (uint256)",
 "function allowance(address owner,address spender) view returns (uint256)",
]);
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
 const now=Date.now();
 const sourcesFresh=[account.updatedAt,markets.updatedAt].every(iso=>{
   const timestamp=Date.parse(iso);
   return Number.isFinite(timestamp)&&timestamp<=now+5000&&now-timestamp<90_000;
 });
 const gates:Gate[]=[
  gate("Wallet and Ink network",chainId===57073&&account.chainId===57073&&
   account.address.toLowerCase()===wallet.toLowerCase()?"pass":"fail",
   "RPC, wallet and protocol must identify Ink chain 57073."),
  gate("Pinned Pool",account.pool.toLowerCase()===TYDRO.pool.toLowerCase()?"pass":"fail",
   "Read-only on-chain PoolAddressesProvider must match the pinned Tydro Pool."),
  gate("Complete coverage",!account.incomplete&&!markets.incomplete&&account.warnings.length===0?"pass":"fail",
   "Requires complete reserve and account data with no missing oracle/balance fields."),
  gate("Fresh source timestamps",sourcesFresh?"pass":"fail",
   "Account and reserve responses must be under 90 seconds old."),
  gate("Risk mode",account.userEModeCategory===0?"pass":"fail",
   "This first preflight supports only standard non-eMode accounts."),
  gate("Reserve",reserve?.active===true&&reserve?.frozen===false?"pass":"fail",
   "Borrowed asset must belong to a known active unfrozen reserve."),
 ];
 let debtRaw=0n,atomic=0n;
 if(user&&reserve&&Number.isInteger(decimals)&&decimals>=0&&decimals<=36){
   try{debtRaw=parseUnits(debt,decimals);atomic=debtRaw*BigInt(request.percent)/100n;}
   catch{/* invalid decimal: fail closed */}
 }
 gates.push(gate("Variable debt",debtRaw>0n?"pass":"fail",
   "A positive on-chain variable debt balance is required; stable debt is excluded."));
 gates.push(gate("Exact partial amount",atomic>0n&&atomic<debtRaw?"pass":"fail",
   "Exactly 10/25/50/75% of that variable debt, rounded down to token atomic units. No full-repay sentinel."));
 let tokenBalance:bigint|null=null,allowance:bigint|null=null,native:bigint|null=null,maxFeePerGas:bigint|null=null;
 const observed=await Promise.allSettled([
   publicClient.readContract({address:asset,abi:tokenAbi,functionName:"balanceOf",args:[wallet]}),
   publicClient.readContract({address:asset,abi:tokenAbi,functionName:"allowance",args:[wallet,TYDRO.pool]}),
   publicClient.getBalance({address:wallet}),
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
       account:wallet,address:asset,abi:approveAbi,functionName:"approve",args:[TYDRO.pool,atomic],
     });
     approvalCall=simulated.result===true;
     if(approvalCall){
       approvalGas=await publicClient.estimateContractGas({
         account:wallet,address:asset,abi:approveAbi,functionName:"approve",args:[TYDRO.pool,atomic],
       });
     }
   }catch{approvalCall=false;}
   if(approvalCall===false&&allowance!==null&&allowance>0n){
     try{
       const reset=await publicClient.simulateContract({
         account:wallet,address:asset,abi:approveAbi,functionName:"approve",args:[TYDRO.pool,0n],
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
       account:wallet,address:TYDRO.pool,abi:repayAbi,functionName:"repay",args,
     });
     if(simulation.result<=0n)throw Error("Zero repayment simulated");
     repayGas=await publicClient.estimateContractGas({
       account:wallet,address:TYDRO.pool,abi:repayAbi,functionName:"repay",args,
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
 const blockAge=endTimestamp===null?null:BigInt(Math.floor(Date.now()/1000))-endTimestamp;
 const blockFresh=endBlock>=startBlock&&endBlock-startBlock<=3n&&
   blockAge!==null&&blockAge>=-5n&&blockAge<=90n;
 gates.push(gate("Block-span and timestamp guard",blockFresh?"pass":"fail",
   "At most three blocks elapsed; final block timestamp within 90s. Cross-contract reads are NOT atomic."));
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
