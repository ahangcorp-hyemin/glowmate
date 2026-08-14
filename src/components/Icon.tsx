// 공용 스트로크 아이콘 — 이모지 대체(웜 웰니스 리디자인). 1.8px 스트로크, currentColor.
// 사용: <Icon name="phone" size={18} /> — 색은 부모의 color를 따른다.

const PATHS: Record<string, React.ReactNode> = {
  home: (
    <path d="M3 10.5 12 3l9 7.5M5.5 8.8V20a1 1 0 0 0 1 1h3.8v-5.6a1.7 1.7 0 0 1 3.4 0V21h3.8a1 1 0 0 0 1-1V8.8" />
  ),
  hospital: (
    <>
      <path d="M4 21V5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5V21M2 21h20" />
      <path d="M12 7.5v5M9.5 10h5M8.5 21v-4.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1V21" />
    </>
  ),
  book: (
    <path d="M12 6.5C10.5 5 8.3 4.3 5.6 4.3c-1 0-1.9.1-2.6.3V19c.7-.2 1.6-.3 2.6-.3 2.7 0 4.9.7 6.4 2.2 1.5-1.5 3.7-2.2 6.4-2.2 1 0 1.9.1 2.6.3V4.6c-.7-.2-1.6-.3-2.6-.3-2.7 0-4.9.7-6.4 2.2Zm0 0V21" />
  ),
  chat: (
    <path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.3c-1.3 0-2.6-.3-3.7-.8L3 20l1.1-5.5a8 8 0 0 1-.6-3A8.4 8.4 0 0 1 12 3.2a8.4 8.4 0 0 1 9 8.3Z" />
  ),
  heart: (
    <path d="M12 20.3 4.8 13a4.7 4.7 0 0 1 0-6.7 4.8 4.8 0 0 1 6.8 0l.4.5.4-.5a4.8 4.8 0 0 1 6.8 0 4.7 4.7 0 0 1 0 6.7L12 20.3Z" />
  ),
  phone: (
    <path d="M5.3 3.8h3l1.6 4-2 1.5a12.6 12.6 0 0 0 5.8 5.8l1.5-2 4 1.6v3a1.8 1.8 0 0 1-1.9 1.8A16.4 16.4 0 0 1 3.5 5.7a1.8 1.8 0 0 1 1.8-1.9Z" />
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  map: (
    <path d="m9 4-5.5 2v14L9 18l6 2 5.5-2V4L15 6 9 4Zm0 0v14m6-12v14" />
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 2.8V6m8-3.2V6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.3 3.4 5.2 3.4 8.5s-1.1 6.2-3.4 8.5c-2.3-2.3-3.4-5.2-3.4-8.5s1.1-6.2 3.4-8.5Z" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  list: <path d="M8.5 6h12m-12 6h12m-12 6h12M4 6h.01M4 12h.01M4 18h.01" />,
  arrow: <path d="M4 12h15m-6-6.5L19.5 12 13 18.5" />,
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4.5V3h6v1.5M8.5 10h7m-7 4h7m-7 4h4" />
    </>
  ),
  shield: (
    <path d="M12 2.8 4.5 5.6v6c0 4.6 3.2 7.9 7.5 9.6 4.3-1.7 7.5-5 7.5-9.6v-6L12 2.8Zm-3 9 2.2 2.2 4-4.4" />
  ),
  sparkle: (
    <path d="M12 3.5c.6 3.8 2.7 5.9 6.5 6.5-3.8.6-5.9 2.7-6.5 6.5-.6-3.8-2.7-5.9-6.5-6.5 3.8-.6 5.9-2.7 6.5-6.5ZM19 15.5c.3 1.9 1.3 2.9 3.2 3.2-1.9.3-2.9 1.3-3.2 3.2-.3-1.9-1.3-2.9-3.2-3.2 1.9-.3 2.9-1.3 3.2-3.2Z" />
  ),
  doctor: (
    <>
      <circle cx="12" cy="7.5" r="3.8" />
      <path d="M5 21a7 7 0 0 1 14 0M12 14.5V18m-1.8-1.8h3.6" />
    </>
  ),
  won: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m7.5 9 1.7 6L12 9.5 14.8 15l1.7-6M7 12.5h10" />
    </>
  ),
};

export default function Icon({ name, size = 20, strokeWidth = 1.8, style }: {
  name: keyof typeof PATHS | string;
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }} aria-hidden>
      {PATHS[name] ?? null}
    </svg>
  );
}
