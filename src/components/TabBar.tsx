"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";

// 하단 탭: 홈(매칭) / 병원 찾기(탐색·전환) / 알아보기(콘텐츠·SEO) / 후기(수집→피드)
// 병원 찾기는 이 카테고리 앱의 1급 기능이라 탭으로 승격(모두닥·강남언니 관례).
const TABS = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/hospitals", label: "병원 찾기", icon: "hospital" },
  { href: "/learn", label: "알아보기", icon: "book" },
  { href: "/explore", label: "후기", icon: "chat" },
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
            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "11px 0 7px", fontSize: 11.5, letterSpacing: "-0.01em",
            fontWeight: active(t.href) ? 800 : 600,
            color: active(t.href) ? "var(--ink)" : "var(--faint)",
          }}>
            <Icon name={t.icon} size={22} strokeWidth={active(t.href) ? 2.1 : 1.7} />
            {t.label}
          </div>
        </Link>
      ))}
    </nav>
  );
}
