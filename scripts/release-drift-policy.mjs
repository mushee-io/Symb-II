import {releaseMatches} from "./release-policy.mjs";

/** Monitor only the latest *merged* GitHub commit vs the public production
 * health release. This never calls Vercel's deployment API or triggers builds.
 */
export function classifyReleaseDrift({
 expectedSha,liveRelease,commitTimeMs,nowMs,graceMs=30*60*1000,
}){
 if(typeof expectedSha!=="string"||!/^[a-f0-9]{40}$/i.test(expectedSha)||
    !Number.isFinite(commitTimeMs)||!Number.isFinite(nowMs)||
    !Number.isFinite(graceMs)||graceMs<0||
    commitTimeMs>nowMs+5000)
  return "indeterminate";
 if(releaseMatches(liveRelease,expectedSha))return "current";
 if(!releaseMatches(liveRelease,undefined))return "indeterminate";
 return nowMs-commitTimeMs>=graceMs?"drift":"pending";
}
