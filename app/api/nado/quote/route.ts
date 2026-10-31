import {NextRequest,NextResponse} from "next/server";
import {getNadoPreflightEngineEvidence} from "@/lib/nado/queries";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=30;
export async function GET(request:NextRequest){
  const raw=request.nextUrl.searchParams.get("productId");
  if(!raw||!/^(0|[1-9]\d{0,6})$/.test(raw))
    return NextResponse.json({error:"Valid Nado product ID required."},{status:400,headers:{"Cache-Control":"no-store"}});
  const productId=Number(raw);
  if(!Number.isSafeInteger(productId)||productId>1_000_000)
    return NextResponse.json({error:"Unsupported Nado product ID."},{status:400,headers:{"Cache-Control":"no-store"}});
  try{
    const evidence=await getNadoPreflightEngineEvidence(productId);
    return NextResponse.json({source:"Nado official engine (read-only)",chainId:57073, ...evidence,
      executionEnabled:false,ordersEnabled:false},{
      headers:{"Cache-Control":"public, s-maxage=8, stale-while-revalidate=8"},
    });
  }catch{
    return NextResponse.json({error:"Nado engine market evidence is unavailable. No substitute quote."},
      {status:502,headers:{"Cache-Control":"no-store"}});
  }
}
