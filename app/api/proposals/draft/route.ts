import {randomUUID} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {getNadoAccount,getNadoMarkets} from "@/lib/nado/queries";
import {getTydroAccount} from "@/lib/tydro/queries";
import {reviewNadoReduction,reviewTydroDebtReduction} from "@/lib/risk/rescue";
import {readBoundedJSON,PayloadTooLargeError} from "@/lib/security/request";
import {acquireLimit} from "@/lib/agent/redis";
import {isProposalsConfigured,parseReviewRequest,packetFromScenario} from "@/lib/proposals/policy";
import {storeProposal} from "@/lib/proposals/store";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
const headers={"Cache-Control":"private, no-store"};
function err(error:string,status:number){return NextResponse.json({error},{status,headers});}
export async function POST(req:NextRequest){
  if(!isProposalsConfigured())return err("Signed review receipts are not enabled. Local what-if scenarios remain available.",503);
  if(req.headers.get("origin")!==new URL(req.url).origin)return err("Origin mismatch.",403);
  let body:unknown;
  try{body=await readBoundedJSON(req,2048);}
  catch(e){return err(e instanceof PayloadTooLargeError?"Request too large.":"Invalid JSON.",e instanceof PayloadTooLargeError?413:400);}
  const request=parseReviewRequest(body);
  if(!request)return err("Unsupported Ink review scenario.",400);
  try{
    if(!await acquireLimit("proposal-draft:"+request.wallet.toLowerCase(),20))
      return err("Review requests are rate-limited.",429);
    const result=request.action==="nado-reduction-review"?
      await (async()=>{
        const [account,markets]=await Promise.all([getNadoAccount(request.wallet),getNadoMarkets()]);
        return reviewNadoReduction({
          account,markets,positionKey:request.positionKey!,
          shockPct:request.shockPct!,reductionPct:request.reductionPct!,
        });
      })():
      reviewTydroDebtReduction(await getTydroAccount(request.wallet),request.repaymentPct!);
    if(!result.ok)return err("The current protocol data does not support a reliable review: "+result.reason,422);
    const packet=packetFromScenario({request,result,id:randomUUID(),now:Date.now()});
    if(!packet)return err("Could not bind a current on-chain scenario to this wallet.",422);
    if(!await storeProposal(packet))return err("Review store was unable to create a one-time draft.",503);
    return NextResponse.json({packet,note:"Draft only. It cannot execute or authorize any trade or repayment."},{headers});
  }catch{return err("Live protocol verification or review storage failed. No draft created.",503);}
}
