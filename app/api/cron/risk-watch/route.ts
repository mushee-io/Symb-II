import {NextRequest,NextResponse} from "next/server";
import {getNadoAccount} from "@/lib/nado/queries";
import {getTydroAccount} from "@/lib/tydro/queries";
import {evaluateRiskAlerts} from "@/lib/risk/alerts";
import {isWatchConfigured} from "@/lib/watch/policy";
import {leastRecentlyChecked,recordWatchCheck} from "@/lib/watch/store";
import {redis} from "@/lib/agent/redis";

export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
const MAX_WALLETS=3;
const headers={"Cache-Control":"no-store"};
export async function GET(req:NextRequest){
  const secret=process.env.CRON_SECRET;
  if(!secret||secret.length<16||req.headers.get("authorization")!=="Bearer "+secret)
    return NextResponse.json({error:"Unauthorized"},{status:401,headers});
  if(!isWatchConfigured())return NextResponse.json({error:"Watch worker not configured."},{status:503,headers});
  try{
    if(await redis(["SET","symb-ii:watch:worker-lock","1","EX",240,"NX"])!=="OK")
      return NextResponse.json({status:"already-running"},{headers});
    const wallets=await leastRecentlyChecked(MAX_WALLETS);
    let processed=0,failed=0;
    for(const wallet of wallets){
      const [n,t]=await Promise.allSettled([
        getNadoAccount(wallet),getTydroAccount(wallet)
      ]);
      const alerts=evaluateRiskAlerts({
        wallet,nado:n.status==="fulfilled"?{status:"success",data:n.value}:{status:"error"},
        tydro:t.status==="fulfilled"?{status:"success",data:t.value}:{status:"error"},
      });
      try{
        // Store only risk status and brief labels, never balances or full positions.
        if(await recordWatchCheck(wallet,new Date().toISOString(),alerts))processed++;
      }catch{failed++;}
    }
    return NextResponse.json({status:"complete",processed,failed,capacity:MAX_WALLETS,
      note:"Scheduled diagnostic snapshots, not real-time warnings or notification delivery."},{headers});
  }catch{
    return NextResponse.json({error:"Monitoring service unavailable."},{status:503,headers});
  }
}
