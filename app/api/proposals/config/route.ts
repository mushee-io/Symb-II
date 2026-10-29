import {NextResponse} from "next/server";
import {isProposalsConfigured} from "@/lib/proposals/policy";
export const dynamic="force-dynamic";
export function GET(){
  return NextResponse.json({
    enabled:isProposalsConfigured(),chainId:57073,
    purpose:"Signed acknowledgement of reviewed, non-executable scenarios",
    supportsExecution:false,
    supportsBroadcast:false,
    expirationSeconds:120,
    receiptRetention:"30 days (maximum 20 most recent receipts)",
    signerSupport:"EOA wallet message signatures only",
  },{headers:{"Cache-Control":"no-store"}});
}
