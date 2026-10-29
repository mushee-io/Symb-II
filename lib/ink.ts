import { defineChain } from "viem";

export const ink = defineChain({
  id: 57073,
  name: "Ink",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_INK_RPC_URL || "https://rpc-gel.inkonchain.com"] },
    public: { http: ["https://rpc-gel.inkonchain.com"] },
  },
  blockExplorers: {
    default: { name: "Ink Explorer", url: "https://explorer.inkonchain.com" },
  },
});
export const INK_EXPLORER = ink.blockExplorers.default.url;
