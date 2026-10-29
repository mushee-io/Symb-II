import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Symb-II Home">
      <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
      <span>symb<span className="brand-ii">-II</span></span>
    </Link>
  );
}
