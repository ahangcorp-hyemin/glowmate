// 시술 레슨 데이터 계약(contract). UI와 백엔드가 공유하는 유일한 경계.
// - UI는 이 타입만 알면 됨(정적 시드든 DB든 동일).
// - 백엔드는 lesson_cards(kind + payload jsonb)를 이 union 형태로 서빙하면 됨.
//   DB 스키마·매핑은 docs/LESSON_CONTENT_CONTRACT.md + supabase/migrations/0002_lessons.sql 참고.

/** 후기 읽는 법(리터러시) 카드용 샘플 후기. is-trustworthy를 맞히게 함. */
export interface ReviewSample {
  body: string;
  trustworthy: boolean; // 신뢰할 만한 후기인가
  flag: string; // 왜 의심/신뢰인지(정답 공개용 근거)
}

/** 진짜 후기(추후 UGC 테이블로 승격 예정). 지금은 큐레이션 시드. */
export interface RealReview {
  body: string;
  ageBand: string; // "40대", "50대+" — 4050 관련도 필터용
  concern: string; // 어떤 고민으로 받았나
  rating: number; // 1~5
  verified: boolean; // 시술 인증 여부
}

/** 레슨 카드 union. kind로 렌더러 분기(듀오링고식 한 장씩). */
export type LessonCard =
  | { kind: "intro"; title: string; subtitle: string }
  // 작용 원리: 피부 단면 + 깊이별 열 응고점(탭)
  | { kind: "layers"; title: string; prompt: string; depths: { mm: number; layer: string; note: string }[] }
  // 효과 타임라인: 슬라이드로 콜라겐/리프팅 서서히 + 기대치 현실화
  | { kind: "timeline"; title: string; prompt: string; points: { day: number; label: string }[]; reality: string }
  // 대안 비교: 탭으로 경쟁 시술 스탯 비교
  | { kind: "compare"; title: string; prompt: string; options: { id: string; name: string; depthMm: number; keep: string; pain: number; note: string }[] }
  // 금기 셀프체크: 내 상황 탭 → 상담필요/진행가능
  | { kind: "contra"; title: string; prompt: string; options: { label: string; safe: boolean; note: string }[] }
  // 가격 구조: 샷수 슬라이드 → 가격 변동 + 저가 미끼 경고
  | { kind: "price"; title: string; prompt: string; unitWon: number; minUnit: number; maxUnit: number; step: number; lowWarnBelow: number; lowWarn: string; note: string }
  // 후기 읽는 법(리터러시): 스와이프로 신뢰/의심 판별 학습
  | { kind: "reviewLiteracy"; title: string; prompt: string; samples: ReviewSample[] }
  // 진짜 후기 탐색
  | { kind: "realReviews"; title: string; prompt: string; reviews: RealReview[] }
  // 상담 질문지: 병원 갈 때 지참(공유/저장)
  | { kind: "questionSheet"; title: string; intro: string; questions: string[] }
  | { kind: "done"; title: string; subtitle: string };

export type LessonCardKind = LessonCard["kind"];

/** 시술 1개의 레슨. procedureId로 카탈로그(procedures)와 연결. */
export interface LessonContent {
  procedureId: string; // 예: "ulthera" — catalog procedures.id와 동일
  nameKo: string;
  cards: LessonCard[];
}
