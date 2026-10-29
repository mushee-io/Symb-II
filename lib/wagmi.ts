import { createConfig, http, injected } from "wagmi";
import { ink } from "@/lib/ink";

export const config = createConfig({
  chains: [ink],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [ink.id]: http(process.env.NEXT_PUBLIC_INK_RPC_URL || "https://rpc-gel.inkonchain.com"),
  },
  ssr: true,
});
