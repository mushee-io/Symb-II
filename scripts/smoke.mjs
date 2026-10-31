/**
 * M7 public production smoke. Never sends auth secrets or wallet signatures.
 * Usage: SMOKE_URL=https://symb-ii.vercel.app npm run smoke
 */
const root=(process.env.SMOKE_URL||"https://symb-ii.vercel.app").replace(/\/$/,"");
import {releaseMatches,validatedProductionUrl} from "./release-policy.mjs";
const parsed=validatedProductionUrl(root);
// URL was checked before requesting production data; no secrets are sent.
async function read(path){
 const response=await fetch(root+path,{
  headers:{"Accept":"application/json"},signal:AbortSignal.timeout(25000),cache:"no-store",
 });
 if(!response.ok)throw Error(path+" status "+response.status);
 return response.json();
}
const checks=[
 ["health",async()=>{
   const v=await read("/api/health");
   if(v.product!=="Symb-II"||v.network?.chainId!==57073)throw Error("Incorrect Ink deployment");
   if(!releaseMatches(v.release,process.env.EXPECTED_COMMIT_SHA))
     throw Error("Production revision differs from the triggering successful Build");
   return "Ink 57073 · release "+(v.release||"unknown");
 }],
 ["readiness",async()=>{
   const v=await read("/api/ops/readiness");
   if(v.chainId!==57073||v.executionEnabled!==false||!Array.isArray(v.services))
     throw Error("Unsafe readiness state");
   if(JSON.stringify(v).includes("UPSTASH_REDIS_REST_TOKEN="))
     throw Error("Configuration appears to expose a credential");
   return v.services.length+" configuration gates";
 }],
 ["WalletConnect QR readiness without execution",async()=>{
   const report=await read("/api/ops/readiness");
   const wallet=report.services?.find(s=>s.id==="walletconnect");
   if(!wallet||!["configured","blocked"].includes(wallet.status)||
      wallet.verifiedLive!==false||report.executionEnabled!==false)
     throw Error("Native wallet pairing readiness is missing or falsely marked verified");
   return wallet.status==="configured"?
      "public WalletConnect ID configured; real native pairing still unverified":
      "public WalletConnect ID missing; watch-only desktop observation remains available";
 }],
 ["preflight config",async()=>{
   const v=await read("/api/preflight/config");
   if(v.supportsExecution!==false)throw Error("Preflight unexpectedly enables execution");
   return v.enabled?"read-only preflight configured (requires private validation)":"preflight safely disabled";
 }],
 ["proposal config",async()=>{
   const v=await read("/api/proposals/config");
   if(v.supportsExecution!==false||v.supportsBroadcast!==false)
     throw Error("Proposal API unexpectedly allows trading");
   return v.enabled?"signed receipts configured":"signed receipts safely disabled";
 }],
 ["agent config",async()=>{
   const v=await read("/api/agent/config");
   if(v.tradingEnabled!==false||v.chainId!==57073)throw Error("Unsafe agent configuration");
   return v.modelEnabled?"model config present (untested)":"guided-only agent";
 }],
 ["watch config",async()=>{
   const v=await read("/api/watch/config");
   if(v.executionEnabled!==false||v.notificationsDelivered!==false)
     throw Error("Unexpected watch permissions or delivery");
   return v.enabled?"watch configured (not real-time)":"watch safely disabled";
 }],
 ["M13/M14 outbound notification safety",async()=>{
   const v=await read("/api/notifications/config");
   if(v.milestone!=="M13"||v.chainId!==57073||
      !releaseMatches(v.release,process.env.EXPECTED_COMMIT_SHA)||
      v.policyImplemented!==true||v.recipientProofPolicyImplemented!==true||
      v.revocationPolicyImplemented!==true||
      v.deliveryEnabled!==false||v.notificationsDelivered!==false||
      v.providerConfigured!==false||v.verifiedConsentStore!==false||
      v.externalDeliveryVerified!==false||v.executionEnabled!==false||
      v.recipientVerificationAvailable!==false||
      v.recipientOwnershipVerified!==false||
      v.signedRevocationEndpointAvailable!==false||
      v.atomicRevocationVerified!==false||v.privacyDeletionVerified!==false||
      !Array.isArray(v.channels)||v.channels.length!==2||
      !v.channels.includes("email")||!v.channels.includes("web-push"))
      throw Error("M13/M14 notification route indicates unaccepted delivery, recipient access or invalid release");
   return "external delivery, recipient verification and revocation safely disabled";
 }],
 ["M8 wallet verification config",async()=>{
   const v=await read("/api/verification/config");
   if(v.chainId!==57073||typeof v.enabled!=="boolean"||
      v.serverSessionIssued!==false||v.permissionGranted!==false||
      v.executionEnabled!==false||v.redisOneUseNonce!==true)
     throw Error("M8 server proof configuration exposes unsafe behavior");
   return v.enabled?"opt-in proof configured (private acceptance untested)":"one-use server proof safely disabled";
 }],
 ["M8 proof challenge cross-origin rejection",async()=>{
   const v=await read("/api/verification/config");
   const response=await fetch(root+"/api/verification/challenge",{
    method:"POST",headers:{"Origin":"https://cross-origin-probe.invalid",
     "Content-Type":"application/json"},
    body:JSON.stringify({wallet:"0x0000000000000000000000000000000000000001"}),
    cache:"no-store",signal:AbortSignal.timeout(15000),
   });
   const expected=v.enabled?403:503;
   if(response.status!==expected)throw Error("M8 cross-origin challenge response "+response.status+" (expected "+expected+")");
   const body=await response.json();
   if(body.challengeId||body.message||body.permissionGranted||body.executionEnabled)
     throw Error("M8 cross-origin challenge returned private or unsafe fields");
   return "cross-origin request rejected without consuming a nonce";
 }],
 ["M8 proof confirmation cross-origin rejection",async()=>{
   const v=await read("/api/verification/config");
   const response=await fetch(root+"/api/verification/verify",{
    method:"POST",headers:{"Origin":"https://cross-origin-probe.invalid",
     "Content-Type":"application/json"},
    body:JSON.stringify({wallet:"0x0000000000000000000000000000000000000001"}),
    cache:"no-store",signal:AbortSignal.timeout(15000),
   });
   const expected=v.enabled?403:503;
   if(response.status!==expected)throw Error("M8 cross-origin verify response "+response.status+" (expected "+expected+")");
   const body=await response.json();
   if(body.verified||body.oneUseNonceConsumed||body.permissionGranted||body.executionEnabled)
     throw Error("M8 cross-origin verification granted permissions");
   return "cross-origin proof refused before signature verification";
 }],
 ["M15 standalone workspace pages",async()=>{
   const routes=[
    ["/workspace","Capital, without the clutter"],
    ["/workspace/nado","Nado markets"],
    ["/workspace/tydro","Tydro lending"],
    ["/workspace/risk","Risk intelligence"],
    ["/workspace/rescue","Portfolio Rescue Lab"],
    ["/workspace/preflight","Transaction preflight"],
    ["/workspace/monitor","Risk alerts"],
    ["/workspace/verify","Wallet verification lab"],
    ["/workspace/readiness","Launch readiness"],
   ];
   const results=await Promise.all(routes.map(async ([path,heading])=>{
    const response=await fetch(root+path,{
      method:"GET",redirect:"error",cache:"no-store",
      headers:{"Accept":"text/html"},signal:AbortSignal.timeout(20000),
    });
    if(!response.ok||!(response.headers.get("content-type")||"").includes("text/html"))
      throw Error("Standalone workspace page unavailable: "+path);
    const html=await response.text();
    if(!html.includes(heading)||!html.includes('aria-label="Workspace sections"'))
      throw Error("Page is missing its heading or accessible workspace navigation: "+path);
    return path;
   }));
   return results.length+" standalone workspace routes return server-rendered headings and navigation";
 }],
 ["Unified desktop terminal read-only release",async()=>{
   const response=await fetch(root+"/workspace/terminal",{
     method:"GET",redirect:"error",cache:"no-store",
     headers:{"Accept":"text/html"},signal:AbortSignal.timeout(20000),
   });
   if(!response.ok||!(response.headers.get("content-type")||"").includes("text/html"))
     throw Error("Native-agent terminal route unavailable");
   const html=await response.text();
   if(!html.includes("PERPETUALS")||
      !html.includes("EXECUTION LOCKED")||
      !html.includes("Order placement disabled")||
      !html.includes('aria-label="Primary navigation"')||
      !html.includes('aria-label="Nado market watchlist"')||
      !html.includes('aria-label="Local order draft"'))
     throw Error("Terminal missing source, navigation or no-execution safety boundaries");
   return "Redesigned market terminal renders real-market sections, accessible navigation and explicit disabled execution";
 }],
 ["Desktop Nado quote denies invalid product IDs",async()=>{
   const response=await fetch(root+"/api/nado/quote?productId=not-a-product",{
      headers:{"Accept":"application/json"},cache:"no-store",signal:AbortSignal.timeout(15000),
   });
   if(response.status!==400)throw Error("Unvalidated quote product ID accepted");
   const body=await response.json();
   if(body.executionEnabled===true||body.ordersEnabled===true||body.bid||body.ask)
     throw Error("Invalid quote yielded unsafe or fabricated prices");
   return "Invalid Nado product rejected without engine call or execution";
 }],
 ["Market AI refuses cross-origin/unauthenticated generation",async()=>{
   const config=await read("/api/agent/config");
   const response=await fetch(root+"/api/agent/market",{
     method:"POST",
     headers:{"Origin":"https://untrusted-market-client.invalid","Content-Type":"application/json"},
     body:JSON.stringify({
       productId:2,side:"long",notional:1000,leverage:2,
       wallet:"0x0000000000000000000000000000000000000001"
     }),
     cache:"no-store",signal:AbortSignal.timeout(15000),
   });
   const expected=config.modelEnabled?403:503;
   if(response.status!==expected)throw Error("AI market request returned "+response.status+"; expected "+expected);
   const body=await response.json();
   if(body.executionEnabled===true||body.permissionGranted||body.narrative||body.signature)
     throw Error("Unauthorized or disabled market request released a model reply or spending permission");
   return "Protected AI endpoint rejects disabled or cross-origin requests before model access";
 }],
 ["Nado historical OHLCV integrity",async()=>{
   const markets=await read("/api/nado/markets");
   const selected=markets.markets?.find(m=>m.type==="perp"&&m.symbol.toUpperCase().includes("BTC"))||
                  markets.markets?.find(m=>m.type==="perp");
   if(!Number.isSafeInteger(selected?.productId))throw Error("No validated Nado perp product for historical chart");
   const bad=await fetch(root+"/api/nado/candles?productId="+selected.productId+"&interval=invalid",{
     cache:"no-store",signal:AbortSignal.timeout(15000),
   });
   if(bad.status!==400)throw Error("Unsupported candle interval accepted");
   const v=await read("/api/nado/candles?productId="+selected.productId+"&interval=15m");
   if(v.chainId!==57073||v.source!=="Nado official indexer"||
      v.productId!==selected.productId||v.interval!=="15m"||
      v.executionEnabled!==false||!Array.isArray(v.candles)||!v.candles.length)
     throw Error("Historical Nado indexer response lacks required provenance or disables execution boundary");
   for(const b of v.candles){
     if(!Number.isSafeInteger(b.time)||![b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)||
        b.open<=0||b.low<=0||b.high<b.low||b.volume<0||
        b.high<b.close||b.high<b.open||b.low>b.close||b.low>b.open)
       throw Error("Invalid historical Nado candle detected");
   }
   return v.candles.length+" real 15m Nado candles; no synthetic data or execution";
 }],
 ["Tydro action lab is separate and cannot execute",async()=>{
   const response=await fetch(root+"/workspace/actions",{
      method:"GET",redirect:"error",cache:"no-store",
      headers:{"Accept":"text/html"},signal:AbortSignal.timeout(20000),
   });
   if(!response.ok||!(response.headers.get("content-type")||"").includes("text/html"))
     throw Error("Dedicated Tydro action lab route unavailable");
   const html=await response.text();
   if(!html.includes("Lending Action Lab")||
      !html.includes("All lending execution is disabled.")||
      !html.includes("NO TRANSACTION")||
      !html.includes("Approvals, wallet signing and execution are unavailable."))
      throw Error("Lending action lab missing explicit no-execution boundaries");
   return "Tydro supply/withdraw/borrow/repay drafts are isolated and read-only";
 }],
 ["Nado public markets",async()=>{
   const v=await read("/api/nado/markets");
   if(v.chainId!==57073||v.source!=="Nado indexer"||!Array.isArray(v.markets)||!v.markets.length)
     throw Error("No verified Ink Nado markets");
   const ids=new Set();
   for(const m of v.markets){
    if(!Number.isSafeInteger(m.productId)||ids.has(m.productId)||
       !Number.isFinite(m.lastPrice)||m.lastPrice<=0)
      throw Error("Invalid or duplicate Nado product");
    ids.add(m.productId);
   }
   if(!v.markets.some(m=>m.type==="perp"))throw Error("No Nado perpetual product");
   return v.markets.length+" public markets observed";
 }],
 ["Tydro public reserves",async()=>{
   const v=await read("/api/tydro/markets");
   if(v.chainId!==57073||v.pool?.toLowerCase()!=="0x2816cf15f6d2a220e789aa011d5ee4eb6c47feba"||
      v.incomplete||v.warnings?.length||!Array.isArray(v.reserves)||!v.reserves.length)
     throw Error("No verified Ink Tydro reserves");
   const ids=new Set();
   for(const r of v.reserves){
     const token=r.address?.toLowerCase();
     if(!/^0x[a-f0-9]{40}$/.test(token??"")||ids.has(token)||
        !Number.isInteger(r.decimals)||r.decimals<0||r.decimals>36)
       throw Error("Invalid or duplicate Tydro token");
     ids.add(token);
   }
   return v.reserves.length+" public reserves observed";
 }],
];
let failed=0;
for(const [name,fn] of checks){
 try{console.log("PASS",name,"—",await fn());}
 catch(e){failed++;console.error("FAIL",name,"—",e instanceof Error?e.message:"unknown error");}
}
console.log("Smoke:",checks.length-failed,"/",checks.length,"checks passed");
if(failed)process.exitCode=1;
