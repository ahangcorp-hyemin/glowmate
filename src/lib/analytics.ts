"use client";

import { track as vercelTrack } from "@vercel/analytics";

// 전환 계측(이슈 #67 D). 이벤트 4종 — 이름·프로퍼티는 여기서만 정의(오타 방지).
// cta_estimate_click.position: hero | sticky | section

type EventName = "cta_estimate_click" | "review_start" | "visit_start" | "preset_question_click";

export function track(name: EventName, props?: Record<string, string | number>) {
  try {
    vercelTrack(name, props);
  } catch {
    /* analytics 실패는 UX에 영향 없음 */
  }
}
