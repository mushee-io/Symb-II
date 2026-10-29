import type { Metadata } from "next";
import { Providers } from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Symb-II | Your AI Capital Operator for Ink",
  description: "Symb-II is building a non-custodial AI capital operator for Ink. Connect an Ink wallet and explore the foundation for future Nado and Tydro integrations.",
  metadataBase: new URL("https://github.com/mushee-io/Symb-II"),
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
