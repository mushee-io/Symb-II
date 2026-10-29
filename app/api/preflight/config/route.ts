import {NextResponse} from "next/server";
import {isPreflightConfigured} from "@/lib/preflight/store";
export const dynamic="force-dynamic";
export function GET(){
 return NextResponse.json({
   enabled:isPreflightConfigured(),network:"Ink",chainId:57073,
   supported:["Tydro: one-asset variable debt repay checks","Nado: read-only reduce-only size and product-integrity diagnostics"],
   blocked:["Nado execution signatures","Tydro stable debt","Transaction signing/broadcast"],
   walletSignatureRequiredForAcknowledgement:true,
   signerSupport:"EOA or deployed ERC-1271 contract wallet on Ink; no ERC-6492",
   supportsExecution:false,approvalMeans:"Preflight reviewed, not permission to spend",
 },{headers:{"Cache-Control":"no-store"}});
}
