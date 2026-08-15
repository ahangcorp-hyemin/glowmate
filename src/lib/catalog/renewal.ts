// 시술별 재시술 권장 주기(주) — 시술 원장 D-day의 근거(#71).
// 카탈로그 sources(식약처 허가·학회 가이드) 기준 보수적 값. '권장'이지 의무가 아님을 UI에 항상 병기.

export const RENEWAL_WEEKS: Record<string, number> = {
  botox: 16,        // 보톡스 3~4개월
  ulthera: 52,      // 울쎄라 12~18개월 중 보수적 12개월
  thermage: 52,
  shrink: 26,       // 슈링크 6개월
  inmode: 26,
  thread: 39,       // 실리프팅 9~12개월 중 9개월
  filler: 52,       // HA 필러 12~18개월
  rejuran: 24,      // 리쥬란 유지 주기(시리즈 완료 후)
  skinbooster: 12,  // 물광 3개월
  juvelook: 26,
  sculptra: 78,
  potenza: 26,
  toning: 8,
  pico: 8,
};

export function renewalWeeksOf(procedureId: string): number | null {
  return RENEWAL_WEEKS[procedureId] ?? null;
}
