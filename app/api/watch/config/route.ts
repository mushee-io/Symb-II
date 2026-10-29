import {NextResponse} from "next/server";
import {isWatchConfigured} from "@/lib/watch/policy";
export const dynamic="force-dynamic";
export function GET(){
  return NextResponse.json({
    enabled:isWatchConfigured(),chainId:57073,
    schedule:"Daily, nominally 09:00 UTC; actual timing may vary on Hobby",
    maxAccountsPerRun:3,
    notificationsDelivered:false,
    signatureRequired:true,
    signerSupport:"EOA or deployed ERC-1271 contract wallet on Ink; no ERC-6492",
    executionEnabled:false,
    retention:"At most 40 minimal alert events per subscribed wallet, expiring after 90 days without further monitoring",
  },{headers:{"Cache-Control":"no-store"}});
}
