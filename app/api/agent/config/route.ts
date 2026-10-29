import { NextResponse } from "next/server";
import { isAIConfigured } from "@/lib/agent/generation-policy";
import {isWatchConfigured} from "@/lib/watch/policy";
export function GET(){
  return NextResponse.json({
    network:"Ink",chainId:57073,
    guided:true,modelEnabled:isAIConfigured(),
    walletSignatureRequired:true,tradingEnabled:false,
    persistentAlerts:isWatchConfigured(),
  },{headers:{"Cache-Control":"no-store"}});
}
