// 병원 가격비교 시드 (강남·분당). M1은 수동 시드(예시), M2에서 크롤 파이프라인으로 대체.
// ⚠️ 가격은 각 시술 참고 하한(priceMin)에 배수를 적용한 예시 참고가. 실거래가 아님.
// §27: 정액 광고(isAd)만, 예약·건당 수수료 없음.

export interface HospitalPriceRow {
  hospital: string;
  district: string;
  rating: number;
  reviews: number;
  price: number; // 원(참고가)
  isAd?: boolean;
}

export const HOSPS = [
  { n: "라온피부과의원", d: "강남 역삼", r: 4.8, rv: 1204, ad: true, mult: 1.0 },
  { n: "미유의원", d: "강남 신사", r: 4.7, rv: 862, mult: 1.08 },
  { n: "더퓨어클리닉", d: "분당 정자", r: 4.9, rv: 2051, mult: 1.16 },
  { n: "보노보노의원", d: "강남 논현", r: 4.6, rv: 433, mult: 1.24 },
  { n: "유윤피부과", d: "분당 서현", r: 4.8, rv: 1588, mult: 1.32 },
];

/** 시술 참고 하한가 기준 병원별 예시 참고가(낮은 순). 결정론. */
export function hospitalPrices(procPriceMin: number): HospitalPriceRow[] {
  return HOSPS.map((h) => ({
    hospital: h.n, district: h.d, rating: h.r, reviews: h.rv, isAd: h.ad,
    price: Math.round((procPriceMin * h.mult) / 1000) * 1000,
  })).sort((a, b) => a.price - b.price);
}
