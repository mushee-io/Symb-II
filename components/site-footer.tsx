import { Brand } from "@/components/brand";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <Brand />
        <p>Built for Ink. Non-custodial by design. Independent from any DEX.</p>
        <span className="footer-version">M05 GUIDED / M06 READ-ONLY PREVIEW</span>
      </div>
    </footer>
  );
}
