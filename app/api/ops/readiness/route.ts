import {NextResponse} from "next/server";
import {describeReadiness} from "@/lib/ops/readiness";

export const runtime="nodejs";export const dynamic="force-dynamic";
export function GET(){
 return NextResponse.json({
  release:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,12)??null,
  ...describeReadiness(),
  note:"Flags only. Connection tests, real-wallet validation and security review are independent deployment gates.",
 },{headers:{"Cache-Control":"public, max-age=0, must-revalidate"}});
}
