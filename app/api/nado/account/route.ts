import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { getNadoAccount } from "@/lib/nado/queries";
export const runtime="nodejs"; export const dynamic="force-dynamic"; export const maxDuration=30;
export async function GET(request:NextRequest) {
  const raw=request.nextUrl.searchParams.get("address");
  if (!raw || !isAddress(raw,{strict:false})) return NextResponse.json({error:"Valid wallet address required."},{status:400});
  try { return NextResponse.json(await getNadoAccount(getAddress(raw)),{headers:{"Cache-Control":"private, no-store"}}); }
  catch { return NextResponse.json({error:"Could not query public Nado subaccounts for this wallet."},{status:502,headers:{"Cache-Control":"private, no-store"}}); }
}
