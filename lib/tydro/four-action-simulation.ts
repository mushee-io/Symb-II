import {
 createPublicClient,formatEther,getAddress,http,isAddress,parseAbi,parseUnits,
 type Address,
} from "viem";
import {ink} from "../ink.ts";
import {TYDRO,providerAbi,poolAbi,poolDataProviderAbi} from "./contracts.ts";

/**
 * Read-only Aave V3 Tydro Ink preflight. No wallet client, signing key,
 * ERC20 approval, transaction broadcaster or calldata is ever returned.
 * A successful eth_call is not a guarantee of a future mined transaction.
 */
export type TydroSimulationAction="supply"|"withdraw"|"borrow"|"repay";
export type TydroSimulationInput={
 wallet:Address;asset:Address;amount:string;action:TydroSimulationAction;
};
export type SimulationGate={name:string;passed:boolean;detail:string};
export type TydroSimulationReport={
 chainId:57073;wallet:string;asset:string;amount:string;action:TydroSimulationAction;
 blockNumber:string|null;blockHash:string|null;atomicAmount:string|null;
 gasEstimate:string|null;nativeFeeBufferEth:string|null;
 simulated:boolean;readyForHumanReview:boolean;
 executionEnabled:false;transactionPayload:null;signatureRequested:false;
 gates:SimulationGate[];note:string;
};
const tokenAbi=parseAbi([
 "function decimals() view returns (uint8)",
 "function balanceOf(address owner) view returns (uint256)",
 "function allowance(address owner,address spender) view returns (uint256)",
]);
const poolActionsAbi=parseAbi([
 "function supply(address asset,uint256 amount,address onBehalfOf,uint16 referralCode)",
 "function withdraw(address asset,uint256 amount,address to) returns (uint256)",
 "function borrow(address asset,uint256 amount,uint256 interestRateMode,uint16 referralCode,address onBehalfOf)",
 "function repay(address asset,uint256 amount,uint256 interestRateMode,address onBehalfOf) returns (uint256)",
]);
const decimal=/^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const UINT256_MAX=(1n<<256n)-1n;
export function parseTydroSimulationInput(value:unknown):TydroSimulationInput|null{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const data=value as Record<string,unknown>;
 if(Object.keys(data).length!==4||
    !Object.keys(data).every(k=>["action","wallet","asset","amount"].includes(k))||
    !["supply","withdraw","borrow","repay"].includes(data.action as string)||
    typeof data.wallet!=="string"||!isAddress(data.wallet,{strict:false})||
    typeof data.asset!=="string"||!isAddress(data.asset,{strict:false})||
    typeof data.amount!=="string"||data.amount.length<1||data.amount.length>90||
    !decimal.test(data.amount))return null;
 return {
  wallet:getAddress(data.wallet),asset:getAddress(data.asset),
  amount:data.amount,action:data.action as TydroSimulationAction,
 };
}
export function exactAtomicAmount(amount:string,decimals:number):bigint|null{
 if(!Number.isInteger(decimals)||decimals<0||decimals>36||
    amount.length<1||amount.length>90||!decimal.test(amount)||
    (amount.split(".")[1]??"").length>decimals)return null;
 try{
  const value=parseUnits(amount,decimals);
  return value>0n&&value<=UINT256_MAX?value:null;
 }catch{return null;}
}
function client(){
 return createPublicClient({
  chain:ink,
  transport:http(process.env.INK_RPC_URL||
    process.env.NEXT_PUBLIC_INK_RPC_URL||ink.rpcUrls.default.http[0],
    {timeout:12000,retryCount:0}),
 });
}
export async function simulateTydroAction(input:TydroSimulationInput):Promise<TydroSimulationReport>{
 const gates:SimulationGate[]=[];
 const result:TydroSimulationReport={
  chainId:57073,wallet:input.wallet,asset:input.asset,amount:input.amount,action:input.action,
  blockNumber:null,blockHash:null,atomicAmount:null,gasEstimate:null,nativeFeeBufferEth:null,
  simulated:false,readyForHumanReview:false,executionEnabled:false,transactionPayload:null,
  signatureRequested:false,gates,note:"Read-only simulation only. No transaction may be signed or broadcast.",
 };
 const ensure=(name:string,ok:boolean,detail:string)=>{
  gates.push({name,passed:ok,detail});
  if(!ok)throw Error("Unsafe or unverified: "+name);
 };
 if(!parseTydroSimulationInput(input)){
  gates.push({name:"Request",passed:false,detail:"Invalid action, wallet, asset or amount."});
  return result;
 }
 try{
  const rpc=client();
  const [chainId,number]=await Promise.all([rpc.getChainId(),rpc.getBlockNumber()]);
  ensure("Ink network",chainId===57073,"RPC chain must be Ink 57073.");
  const block=await rpc.getBlock({blockNumber:number});
  const ageMs=Date.now()-Number(block.timestamp)*1000;
  result.blockNumber=number.toString();
  result.blockHash=block.hash;
  ensure("Canonical recent block",Boolean(block.hash&&/^0x[0-9a-f]{64}$/i.test(block.hash))&&
    ageMs>=-10000&&ageMs<=120000,
    "Require recent pinned block with a valid hash.");

  const [pool,reserves,config,user,eMode,tokenDecimals,tokenCode,poolCode]=await Promise.all([
   rpc.readContract({address:TYDRO.poolAddressesProvider,abi:providerAbi,
     functionName:"getPool",blockNumber:number}),
   rpc.readContract({address:TYDRO.pool,abi:poolAbi,
     functionName:"getReservesList",blockNumber:number}),
   rpc.readContract({address:TYDRO.poolDataProvider,abi:poolDataProviderAbi,
     functionName:"getReserveConfigurationData",args:[input.asset],blockNumber:number}),
   rpc.readContract({address:TYDRO.poolDataProvider,abi:poolDataProviderAbi,
     functionName:"getUserReserveData",args:[input.asset,input.wallet],blockNumber:number}),
   rpc.readContract({address:TYDRO.pool,abi:poolAbi,
     functionName:"getUserEMode",args:[input.wallet],blockNumber:number}),
   rpc.readContract({address:input.asset,abi:tokenAbi,
     functionName:"decimals",blockNumber:number}),
   rpc.getCode({address:input.asset,blockNumber:number}),
   rpc.getCode({address:TYDRO.pool,blockNumber:number}),
  ]);
  ensure("Pinned Pool and listed reserve",
   pool.toLowerCase()===TYDRO.pool.toLowerCase()&&
   reserves.some(a=>a.toLowerCase()===input.asset.toLowerCase())&&
   tokenCode!==undefined&&tokenCode!=="0x"&&poolCode!==undefined&&poolCode!=="0x",
   "Pool provider, reserve inventory and deployed bytecode must all match.");
  ensure("Reserve active and permitted",
   config[8]===true&&config[9]===false&&
   (input.action!=="borrow"||config[6]===true),
   "Conservatively require active unfrozen reserve; borrowing must be enabled.");
  ensure("Standard risk mode",eMode===0n,
   "eMode is not yet covered by this conservative preflight.");
  const units=exactAtomicAmount(input.amount,Number(config[0]));
  ensure("Token decimals",Number(config[0])===Number(tokenDecimals)&&units!==null,
   "On-chain reserve/token decimals must agree with a strictly exact positive amount.");
  const atomic=units!;
  result.atomicAmount=atomic.toString();

  if(input.action==="withdraw")
   ensure("Existing aToken supply",user[0]>=atomic,
    "Pinned supplied amount must cover requested withdrawal.");
  if(input.action==="repay")
   ensure("Existing variable debt",user[2]>0n&&user[2]>=atomic,
    "Repay uses existing variable-mode debt only; no max uint sentinel.");
  if(input.action==="supply"||input.action==="repay"){
   const [balance,allowance]=await Promise.all([
    rpc.readContract({address:input.asset,abi:tokenAbi,
      functionName:"balanceOf",args:[input.wallet],blockNumber:number}),
    rpc.readContract({address:input.asset,abi:tokenAbi,
      functionName:"allowance",args:[input.wallet,TYDRO.pool],blockNumber:number}),
   ]);
   ensure("Underlying wallet balance",balance>=atomic,
    "Existing underlying amount must cover exact action amount.");
   ensure("Existing Pool allowance",allowance>=atomic,
    "No ERC20 approval is constructed; an already sufficient allowance is required.");
  }

  let gas:bigint;
  const common={account:input.wallet,address:TYDRO.pool,abi:poolActionsAbi,
    blockNumber:number} as const;
  if(input.action==="supply"){
   const args=[input.asset,atomic,input.wallet,0] as const;
   await rpc.simulateContract({...common,functionName:"supply",args});
   gas=await rpc.estimateContractGas({...common,functionName:"supply",args});
  }else if(input.action==="withdraw"){
   const args=[input.asset,atomic,input.wallet] as const;
   const sim=await rpc.simulateContract({...common,functionName:"withdraw",args});
   ensure("Positive withdrawal",sim.result>0n,
    "Pool must simulate a positive withdrawal, not just a successful read.");
   gas=await rpc.estimateContractGas({...common,functionName:"withdraw",args});
  }else if(input.action==="borrow"){
   const args=[input.asset,atomic,2n,0,input.wallet] as const;
   await rpc.simulateContract({...common,functionName:"borrow",args});
   gas=await rpc.estimateContractGas({...common,functionName:"borrow",args});
  }else{
   const args=[input.asset,atomic,2n,input.wallet] as const;
   const sim=await rpc.simulateContract({...common,functionName:"repay",args});
   ensure("Positive repayment",sim.result>0n,
    "Aave Pool must simulate positive repayment in variable-rate mode.");
   gas=await rpc.estimateContractGas({...common,functionName:"repay",args});
  }
  ensure("Pinned eth_call and gas",gas>0n&&gas<10000000n,
   "On-chain simulation and gas estimate must succeed for the exact action.");
  result.simulated=true;
  result.gasEstimate=gas.toString();
  const [native,fees]=await Promise.all([
   rpc.getBalance({address:input.wallet,blockNumber:number}),
   rpc.estimateFeesPerGas({type:"eip1559"}),
  ]);
  const maxFee=fees.maxFeePerGas;
  ensure("EIP-1559 fee",typeof maxFee==="bigint"&&maxFee>0n,
   "A positive EIP-1559 fee observation is required.");
  if(typeof maxFee!=="bigint"||maxFee<=0n)throw Error("Unavailable gas fee");
  const twoTimesBuffer=gas*maxFee*2n;
  result.nativeFeeBufferEth=formatEther(twoTimesBuffer);
  ensure("ETH fee buffer",native>=twoTimesBuffer,
   "Wallet holds 2x observed L2 gas estimate; L1 data fees are additional.");
  const [recheck,finalChain]=await Promise.all([
   rpc.getBlock({blockNumber:number}),rpc.getChainId(),
  ]);
  ensure("Recheck pinned hash and chain",recheck.number===number&&
   recheck.hash===block.hash&&finalChain===57073,
   "Reject chain switches and reorgs while simulating.");
  result.readyForHumanReview=true;
  result.note="This exact action passed a pinned eth_call, not a trade execution. State, oracle, allowance and L1 fees can change. A wallet signature, security audit and transaction receipt remain outstanding.";
 }catch{
  result.readyForHumanReview=false;
  result.note="A read-only RPC, reserve, risk, allowance, gas or freshness check did not pass. Never execute from this report.";
  if(!gates.some(g=>!g.passed))
   gates.push({name:"Contract simulation",passed:false,
    detail:"Pinned RPC call or gas estimation failed; no positive simulation claim."});
 }
 return result;
}
