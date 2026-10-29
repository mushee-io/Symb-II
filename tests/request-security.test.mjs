import {test} from "node:test";
import assert from "node:assert/strict";
import {readBoundedJSON,PayloadTooLargeError} from "../lib/security/request.ts";

test("bounded request reader accepts ordinary JSON",async()=>{
  const request=new Request("https://example.test/api",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({wallet:"0xabc",action:"subscribe"})});
  assert.deepEqual(await readBoundedJSON(request,512),{wallet:"0xabc",action:"subscribe"});
});
test("rejects oversized payload even when content length is not supplied",async()=>{
  const body=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode(JSON.stringify({text:"x".repeat(4000)})));controller.close();}});
  const req=new Request("https://example.test/api",{method:"POST",body,duplex:"half"});
  await assert.rejects(()=>readBoundedJSON(req,64),PayloadTooLargeError);
});
test("rejects contradictory or dishonest claimed content length",async()=>{
  const request=new Request("https://example.test/api",{method:"POST",headers:{"Content-Length":"500"},body:"{}"});
  await assert.rejects(()=>readBoundedJSON(request,32),PayloadTooLargeError);
});
test("rejects malformed input without executing any action",async()=>{
  const request=new Request("https://example.test/api",{method:"POST",body:"not json"});
  await assert.rejects(()=>readBoundedJSON(request,200),SyntaxError);
});
