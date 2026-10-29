import { Brand } from "@/components/brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <Brand />
        <p>Built for Ink. Non-custodial by design. Independent from any DEX.</p>
        <span className="footer-version">M03 LIVE / M04 IN PROGRESS</span>
      </div>
    </footer>
  );
}
