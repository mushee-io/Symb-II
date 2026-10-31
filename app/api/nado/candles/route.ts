import {NextRequest,NextResponse} from "next/server";
import {getNadoCandles} from "@/lib/nado/queries";
import {CANDLE_INTERVALS,type CandleInterval} from "@/lib/trading/candles";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=30;
export async function GET(request:NextRequest){
 const raw=request.nextUrl.searchParams.get("productId");
 const interval=request.nextUrl.searchParams.get("interval");
 if(!raw||!/^(0|[1-9]\d{0,6})$/.test(raw)||Number(raw)>1_000_000||
    typeof interval!=="string"||!(interval in CANDLE_INTERVALS))
  return NextResponse.json({error:"Valid productId and supported interval (1m, 5m, 15m, 1h, 4h, 1d) required."},
    {status:400,headers:{"Cache-Control":"no-store"}});
 try{
  const candles=await getNadoCandles(Number(raw),interval as CandleInterval);
  if(!candles.candles.length)
   return NextResponse.json(candles,{status:503,headers:{"Cache-Control":"no-store"}});
  return NextResponse.json(candles,{headers:{"Cache-Control":"public, s-maxage=15, stale-while-revalidate=30"}});
 }catch{
  return NextResponse.json({error:"Historical Nado candle data unavailable; no synthetic candles are provided."},
   {status:502,headers:{"Cache-Control":"no-store"}});
 }
}
