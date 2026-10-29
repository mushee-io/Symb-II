import { Brand } from "@/components/brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <Brand />
        <p>Built for Ink. Non-custodial by design. Independent from any DEX.</p>
        <span className="footer-version">FOUNDATION / 0.1.0</span>
      </div>
    </footer>
  );
}
