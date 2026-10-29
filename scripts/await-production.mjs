import {releaseMatches,validatedProductionUrl} from "./release-policy.mjs";
const origin=(process.env.SMOKE_URL||"https://symb-ii.vercel.app").replace(/\/$/,"");
validatedProductionUrl(origin);
const sha=process.env.EXPECTED_COMMIT_SHA;
if(!sha){console.log("No expected commit; skipping release wait.");process.exit(0);}
const maxWait=Number(process.env.DEPLOY_WAIT_MS||300000);
if(!Number.isFinite(maxWait)||maxWait<0||maxWait>600000)throw Error("Invalid wait window");
const stop=Date.now()+maxWait;
let last="deployment not visible";
do{
 try{
  const res=await fetch(origin+"/api/health",{headers:{"Accept":"application/json"},
    cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(res.ok){
   const v=await res.json();
   if(releaseMatches(v.release,sha)&&v.network?.chainId===57073){
    console.log("Verified production revision:",v.release);process.exit(0);
   }
   last="live commit does not match successful Build";
  }else last="HTTP "+res.status;
 }catch{last="health endpoint unavailable";}
 if(Date.now()>=stop)break;
 await new Promise(resolve=>setTimeout(resolve,Math.min(10000,stop-Date.now())));
}while(Date.now()<=stop);
throw Error("Production commit not verified: "+last);
