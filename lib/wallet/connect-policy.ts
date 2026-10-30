/**
 * M12 mobile wallet configuration and UI state. A WalletConnect Project ID
 * is public client configuration, NEVER an application signing credential.
 * Missing/malformed IDs must not construct a WalletConnect connector.
 */
export function validWalletConnectProjectId(value:unknown):value is string {
 return typeof value==="string"&&/^[a-f0-9]{32}$/i.test(value)&&
  !/^0{32}$/.test(value);
}
export type WalletConnectionState="disconnected"|"invalid-wallet"|"wrong-network"|"read-only";
export function classifyWalletConnection(input:{
 isConnected:boolean;address:string|undefined;chainId:number|undefined;
}):WalletConnectionState {
 if(!input.isConnected)return "disconnected";
 if(typeof input.address!=="string"||!/^0x[a-f0-9]{40}$/i.test(input.address))
  return "invalid-wallet";
 if(input.chainId!==57073)return "wrong-network";
 return "read-only";
}
