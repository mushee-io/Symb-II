import {NextResponse} from "next/server";
import {publicDeliveryConfiguration} from "@/lib/notifications/policy";

export const dynamic="force-dynamic";
export function GET(){
 return NextResponse.json({
  ...publicDeliveryConfiguration(),
  release:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,12)??null,
 },{headers:{"Cache-Control":"no-store"}});
}
