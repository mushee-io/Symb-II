import {getAddress,isAddress,zeroAddress} from "viem";

/** A public address for observing Ink contract state; never proof of ownership or authority. */
export function parseWatchOnlyAddress(value:unknown):string|null{
 if(typeof value!=="string"||value!==value.trim()||value.length!==42||
    !isAddress(value,{strict:false}))return null;
 const address=getAddress(value);
 return address.toLowerCase()===zeroAddress.toLowerCase()?null:address;
}
