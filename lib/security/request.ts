/** Read raw bytes with a strict hard cap, even if Content-Length is omitted.
 * Never trust claimed content length for authentication or billing endpoints.
 */
export class PayloadTooLargeError extends Error{
  constructor(){super("Request payload exceeds limit.");this.name="PayloadTooLargeError";}
}
export async function readBoundedJSON(req:Request,maxBytes:number):Promise<unknown>{
  if(!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>64_000)throw Error("Invalid request bound.");
  const length=req.headers.get("content-length");
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))
    throw new PayloadTooLargeError();
  if(!req.body)throw Error("Missing JSON body.");
  const reader=req.body.getReader();
  const chunks:Uint8Array[]=[];let total=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>maxBytes){
        await reader.cancel().catch(()=>{});
        throw new PayloadTooLargeError();
      }
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(total);
  let position=0;
  for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.byteLength;}
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
}
