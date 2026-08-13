// 의료법 §56 의료광고 금지표현 필터 — 단일 소스.
// 빌드 lint + 런타임 검증 공용. 효과보증·과장·최상급·최저가·비교 금지.

export const BANNED_PHRASES: string[] = [
  "100%", "완치", "완벽", "부작용 없", "부작용이 없", "재발 없", "재발이 없",
  "최고", "최상", "최저가", "제일 싼", "세계 최초", "국내 최초", "1위",
  "안전 보장", "확실히 효과", "무조건", "영구", "평생",
  "완전 제거", "완전히 사라", "즉시 완성",
];

export interface BannedHit {
  phrase: string;
  index: number;
}

/** 텍스트에서 금지표현을 찾는다. 비어 있으면 통과. */
export function findBannedPhrases(text: string): BannedHit[] {
  const hits: BannedHit[] = [];
  const lower = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    const idx = lower.indexOf(phrase.toLowerCase());
    if (idx !== -1) hits.push({ phrase, index: idx });
  }
  return hits;
}

/** 게시 가능 여부(금지표현 0건). */
export function isCompliant(text: string): boolean {
  return findBannedPhrases(text).length === 0;
}

/** 게시 전 강제 검증. 위반 시 throw(런타임 가드). */
export function assertCompliant(text: string, context = "content"): void {
  const hits = findBannedPhrases(text);
  if (hits.length > 0) {
    throw new Error(
      `[§56 의료광고 위반] ${context}에 금지표현: ${hits.map((h) => h.phrase).join(", ")}`
    );
  }
}
