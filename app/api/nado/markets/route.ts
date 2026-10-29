import { NextResponse } from "next/server";
import { getNadoMarkets } from "@/lib/nado/queries";
export const runtime="nodejs"; export const dynamic="force-dynamic"; export const maxDuration=30;
export async function GET() {
  try { return NextResponse.json(await getNadoMarkets(),{headers:{"Cache-Control":"public, s-maxage=15, stale-while-revalidate=20"}}); }
  catch { return NextResponse.json({error:"Nado markets unavailable. No replacement prices shown."},{status:502,headers:{"Cache-Control":"no-store"}}); }
}
