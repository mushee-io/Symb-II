import { NextResponse } from "next/server";
import { ink } from "@/lib/ink";

export function GET() {
  return NextResponse.json({
    product: "Symb-II",
    status: "foundation",
    network: { name: ink.name, chainId: ink.id },
    trading: "not-implemented",
    lending: "not-implemented",
    ai: "not-implemented",
  }, { headers: { "Cache-Control": "no-store" } });
}
