"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// MVP 3필러 하단 탭: 홈(매칭·전환) / 알아보기(콘텐츠·SEO) / 탐색(후기·리텐션)
const TABS = [
  { href: "/", label: "홈", emoji: "🏠" },
  { href: "/learn", label: "알아보기", emoji: "📖" },
  { href: "/explore", label: "탐색", emoji: "🔎" },
] as const;

export default function TabBar() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <nav className="tabbar" aria-label="주요 메뉴">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className="reset" style={{ flex: 1 }}>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            padding: "10px 0 6px", fontSize: 12.5,
            fontWeight: active(t.href) ? 800 : 600,
            color: active(t.href) ? "var(--coral)" : "var(--muted)",
          }}>
            <span style={{ fontSize: 20, filter: active(t.href) ? "none" : "grayscale(1)" }}>{t.emoji}</span>
            {t.label}
          </div>
        </Link>
      ))}
    </nav>
  );
}
