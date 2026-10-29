import { NextResponse } from "next/server";
import { ink } from "@/lib/ink";
import {isWatchConfigured} from "@/lib/watch/policy";
import {isPreflightConfigured} from "@/lib/preflight/store";
export const dynamic="force-dynamic";

export function GET() {
  return NextResponse.json({
    product: "Symb-II",
    release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,12) ?? null,
    status: "foundation",
    network: { name: ink.name, chainId: ink.id },
    trading: "nado-read-only-markets-and-accounts",
    lending: "tydro-read-only-markets-and-accounts",
    ai: "guided-readonly-briefs-only-no-generative-model",
    preflight: isPreflightConfigured() ? "read-only-rpc-checks-credential-gated" : "code-present-disabled-no-execution",
    alerts: isWatchConfigured()? "opt-in-daily-snapshot-worker-configured-no-delivery":"active-tab-only-worker-disabled",
  }, { headers: { "Cache-Control": "no-store" } });
}
