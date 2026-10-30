import {NextResponse} from "next/server";
import {publicDeliveryConfiguration} from "@/lib/notifications/policy";
import {publicRecipientLifecycleConfiguration} from "@/lib/notifications/revocation";

export const dynamic="force-dynamic";
export function GET(){
 return NextResponse.json({
  ...publicDeliveryConfiguration(),
  ...publicRecipientLifecycleConfiguration(),
  release:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,12)??null,
 },{headers:{"Cache-Control":"no-store"}});
}
