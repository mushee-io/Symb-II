import { NextResponse } from "next/server";
import { ink } from "@/lib/ink";

export function GET() {
  return NextResponse.json({
    product: "Symb-II",
    status: "foundation",
    network: { name: ink.name, chainId: ink.id },
    trading: "nado-read-only-markets-and-accounts",
    lending: "tydro-read-only-markets-and-accounts",
    ai: "guided-readonly-briefs-only-no-generative-model",
    alerts: "opt-in-active-tab-only-no-background-worker",
  }, { headers: { "Cache-Control": "no-store" } });
}
