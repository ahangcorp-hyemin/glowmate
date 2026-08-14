// 글로우메이트 로고 — '글로우(빛)' 마크 + 워드마크.
// 마크: 그린 원 + 떠오르는 빛(글로우) 레이. 헤드스페이스식 단색·라운드, 토스식 볼드 워드마크.

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      {/* 바탕 원(soft green) */}
      <circle cx="16" cy="16" r="16" fill="var(--key, #2F8F4E)" />
      {/* 떠오르는 글로우: 지평선 위 반원 + 레이(안쪽으로 여유) */}
      <path d="M10.4 19.6a5.6 5.6 0 0 1 11.2 0" stroke="#FFFDF7" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 10.4v2M11.2 12.4l1.4 1.4M20.8 12.4l-1.4 1.4" stroke="#FFFDF7" strokeWidth="2" strokeLinecap="round" />
      <path d="M9.6 22.6h12.8" stroke="#FFFDF7" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ size = 26 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <LogoMark size={size} />
      <span style={{ fontWeight: 800, fontSize: size * 0.73, letterSpacing: "-0.03em", color: "var(--ink)" }}>
        글로우메이트
      </span>
    </span>
  );
}
