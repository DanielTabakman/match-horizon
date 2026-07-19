"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Fixture demo" },
  { href: "/radar", label: "Market Radar" },
];

export function ProductHeader() {
  const pathname = usePathname();

  return (
    <header className="product-header">
      <Link className="product-brand" href="/" aria-label="Match Horizon home">
        <span>Match Horizon</span>
        <strong>Read-only + paper simulation</strong>
      </Link>
      <nav className="product-nav" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={isActive ? "page" : undefined}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
