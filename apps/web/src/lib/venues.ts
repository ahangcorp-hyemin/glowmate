/**
 * 업체 목록 — F1 스캐폴딩용 **로컬 고정 데이터**.
 *
 * 여기서 DB 를 읽지 않는 이유는 두 가지다.
 *  1) REQ-3 / FORBID-1 — apps/web 은 DB 접근 제외 집합(packages/api · packages/db) 밖이므로
 *     `packages/db` 나 Postgres 와이어 드라이버가 의존 그래프상 도달 가능해지면 boundary job 이 exit 1 이다.
 *  2) 실제 데이터 연결은 F5(API 계층) · W1(SEO 기반) 소관이다 (F1 out_of_scope).
 *
 * 하류가 이 모듈을 `@glowmate/api` 호출로 교체할 때, 아래 시그니처
 * (`listVenues` · `listVenueSlugs` · `findVenueBySlug`)를 유지하면 라우트 파일은 그대로 둘 수 있다.
 */

export type VenueCategory = 'skin_care' | 'waxing' | 'nail';

export interface Venue {
  /** URL 세그먼트. generateStaticParams 의 입력이므로 전역 유일해야 한다. */
  readonly slug: string;
  readonly name: string;
  /** 행정구 단위까지만 둔다 — 상세 주소·연락처는 F1 산출물이 아니다. */
  readonly district: string;
  readonly category: VenueCategory;
  readonly summary: string;
}

export const VENUE_CATEGORY_LABELS: Readonly<Record<VenueCategory, string>> = {
  skin_care: '피부관리',
  waxing: '왁싱',
  nail: '네일',
};

const VENUES: readonly Venue[] = [
  {
    slug: 'seongsu-glow-studio',
    name: '성수 글로우 스튜디오',
    district: '서울 성동구',
    category: 'skin_care',
    summary: '관리 프로그램별 회당 단가를 공개하는 1인 관리실.',
  },
  {
    slug: 'yeonnam-soft-waxing',
    name: '연남 소프트 왁싱',
    district: '서울 마포구',
    category: 'waxing',
    summary: '부위별 단품·패키지 가격을 같은 기준으로 비교할 수 있는 왁싱샵.',
  },
  {
    slug: 'gangnam-clear-nail',
    name: '강남 클리어 네일',
    district: '서울 강남구',
    category: 'nail',
    summary: '디자인 추가금 범위를 사전에 명시하는 네일샵.',
  },
];

export function listVenues(): readonly Venue[] {
  return VENUES;
}

export function listVenueSlugs(): readonly string[] {
  return VENUES.map((venue) => venue.slug);
}

/**
 * 없는 slug 는 `undefined` 를 돌려준다 — 호출부(페이지 라우트)가 `notFound()` 로 404 를 내도록
 * 강제하기 위해서다. 임의의 대체 업체를 반환하면 존재하지 않는 업체가 색인되는 결과가 된다.
 */
export function findVenueBySlug(slug: string): Venue | undefined {
  return VENUES.find((venue) => venue.slug === slug);
}
