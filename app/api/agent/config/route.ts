import { NextResponse } from "next/server";
import { isAIConfigured } from "@/lib/agent/generation-policy";
export function GET(){
  return NextResponse.json({
    network:"Ink",chainId:57073,
    guided:true,modelEnabled:isAIConfigured(),
    walletSignatureRequired:true,tradingEnabled:false,
    persistentAlerts:false,
  },{headers:{"Cache-Control":"no-store"}});
}
