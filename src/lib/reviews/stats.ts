import "server-only";
import { getServerClient } from "@/lib/supabase/server";

// 코호트 실결제 분포(#73) — 승인(shown) 리뷰의 paid_amount만 집계.
// 하드 룰: n<5 코호트는 null 반환(통계인 척하는 노이즈 금지 — docs/PRICE_DATA_STRATEGY.md).

export interface CohortDist {
  n: number;
  median: number; // 만원
  p25: number;
  p75: number;
  ageBand?: string; // 있으면 연령 코호트, 없으면 시술 전체
}

const MIN_N = 5;

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
}

/** 시술별 분포. ageBand 주면 해당 코호트 우선, n 미달 시 시술 전체로 폴백(그마저 미달이면 null). */
export async function getCohortDist(procedureId: string, ageBand?: string): Promise<CohortDist | null> {
  const db = getServerClient();
  if (!db) return null;
  const { data, error } = await db.from("reviews")
    .select("paid_amount,age_band")
    .eq("procedure_id", procedureId).eq("status", "shown")
    .not("paid_amount", "is", null).limit(500);
  if (error || !data) return null;
  const rows = data as { paid_amount: number; age_band: string | null }[];

  if (ageBand) {
    const cohort = rows.filter((r) => r.age_band === ageBand).map((r) => r.paid_amount).sort((a, b) => a - b);
    if (cohort.length >= MIN_N) {
      return { n: cohort.length, median: quantile(cohort, 0.5), p25: quantile(cohort, 0.25), p75: quantile(cohort, 0.75), ageBand };
    }
  }
  const all = rows.map((r) => r.paid_amount).sort((a, b) => a - b);
  if (all.length < MIN_N) return null;
  return { n: all.length, median: quantile(all, 0.5), p25: quantile(all, 0.25), p75: quantile(all, 0.75) };
}
