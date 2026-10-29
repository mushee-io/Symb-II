import {NextResponse} from "next/server";
import {isServerProofConfigured} from "@/lib/verification/server-policy";
export const runtime="nodejs";export const dynamic="force-dynamic";
export function GET(){
 return NextResponse.json({
  enabled:isServerProofConfigured(),chainId:57073,
  signerSupport:"EOA and deployed ERC-1271 only; no undeployed ERC-6492",
  redisOneUseNonce:true,serverSessionIssued:false,
  permissionGranted:false,executionEnabled:false,
 },{headers:{"Cache-Control":"no-store"}});
}
