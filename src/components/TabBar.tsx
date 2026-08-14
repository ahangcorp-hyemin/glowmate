"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// 하단 탭: 홈(매칭) / 병원 찾기(탐색·전환) / 알아보기(콘텐츠·SEO) / 후기(수집→피드)
// 병원 찾기는 이 카테고리 앱의 1급 기능이라 탭으로 승격(모두닥·강남언니 관례).
const TABS = [
  { href: "/", label: "홈", emoji: "🏠" },
  { href: "/hospitals", label: "병원 찾기", emoji: "🏥" },
  { href: "/learn", label: "알아보기", emoji: "📖" },
  { href: "/explore", label: "후기", emoji: "💬" },
] as const;

export default function TabBar() {
  const path = usePathname();
  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href) || (href === "/hospitals" && path.startsWith("/hospital"));
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
