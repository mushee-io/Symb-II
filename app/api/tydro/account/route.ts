import { NextRequest, NextResponse } from "next/server";
import { getAddress, isAddress } from "viem";
import { getTydroAccount } from "@/lib/tydro/queries";
export const runtime="nodejs"; export const dynamic="force-dynamic"; export const maxDuration=30;
export async function GET(request:NextRequest) {
  const raw=request.nextUrl.searchParams.get("address");
  if(!raw||!isAddress(raw,{strict:false}))
    return NextResponse.json({error:"Valid EVM wallet address required."},{status:400});
  try {
    const data=await getTydroAccount(getAddress(raw));
    return NextResponse.json(data,{headers:{"Cache-Control":"private, no-store"}});
  }catch{
    return NextResponse.json({error:"Tydro on-chain account data unavailable. No substitute balances displayed."},{status:502,headers:{"Cache-Control":"private, no-store"}});
  }
}
