import {test} from "node:test";
import assert from "node:assert/strict";
import {releaseMatches,validatedProductionUrl} from "../scripts/release-policy.mjs";
const sha="817f9dad60ff1b9187745355804139d2e6bf3ef1";
test("only exact triggering Git commit is accepted in production",()=>{
 assert.equal(releaseMatches("817f9dad60ff",sha),true);
 assert.equal(releaseMatches("817f9dad60ff","1111111111111111111111111111111111111111"),false);
 assert.equal(releaseMatches(null,sha),false);
 assert.equal(releaseMatches("817f9dad60ff","wrong"),false);
 assert.equal(releaseMatches("817f9dad60ff",undefined),true);
});
test("smoke URL rejects insecure protocols, embedded credentials and paths",()=>{
 assert.equal(validatedProductionUrl("https://symb-ii.vercel.app").origin,"https://symb-ii.vercel.app");
 for(const url of ["http://symb-ii.vercel.app","https://example.com/path",
  "https://user:pass@example.com","https://example.com/?token=abc","https://example.com/#frag"]){
  assert.throws(()=>validatedProductionUrl(url));
 }
});
