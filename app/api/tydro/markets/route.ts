import { NextResponse } from "next/server";
import { getTydroMarkets } from "@/lib/tydro/queries";
export const runtime="nodejs"; export const dynamic="force-dynamic"; export const maxDuration=30;
export async function GET() {
  try {
    const data=await getTydroMarkets();
    return NextResponse.json(data,{headers:{"Cache-Control":"public, s-maxage=30, stale-while-revalidate=30"}});
  } catch {
    return NextResponse.json({error:"Tydro on-chain market data unavailable or contract verification failed. No substitute data displayed."},{status:502,headers:{"Cache-Control":"no-store"}});
  }
}
