import { NextResponse } from "next/server";
import { ink } from "@/lib/ink";
import {isWatchConfigured} from "@/lib/watch/policy";

export function GET() {
  return NextResponse.json({
    product: "Symb-II",
    status: "foundation",
    network: { name: ink.name, chainId: ink.id },
    trading: "nado-read-only-markets-and-accounts",
    lending: "tydro-read-only-markets-and-accounts",
    ai: "guided-readonly-briefs-only-no-generative-model",
    alerts: isWatchConfigured()? "opt-in-daily-snapshot-worker-configured-no-delivery":"active-tab-only-worker-disabled",
  }, { headers: { "Cache-Control": "no-store" } });
}
