"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SideNav({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-3 md:pb-0">
      {items.map((item) => {
        const root = ["/murid", "/orangtua", "/guru"].includes(item.href);
        const active = root ? path === item.href : path.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`min-h-11 shrink-0 px-3 py-2 text-sm ${active ? "bg-paper text-ink" : "text-paper hover:bg-white/10"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
