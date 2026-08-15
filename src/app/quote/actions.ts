"use server";

import { getServerClient } from "@/lib/supabase/server";
import { findBannedPhrases } from "@/lib/compliance/bannedPhrases";

// 컨시어지 역경매(#72, SPEC v1.1) 서버 액션.
// 보안 계약: getQuoteResult는 phone·notify_channel을 절대 반환하지 않는다(E-2①).
// 열람(viewed_at)은 명시 POST(markQuoteViewed)로만 — 링크 프리뷰봇 오염 방지(E-2②).

const WEEKLY_CAP = 10;

// 한국 공휴일(운영 연도만 하드코딩 — E-3. 매년 갱신)
const HOLIDAYS_2026 = new Set([
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18", "2026-03-01", "2026-03-02",
  "2026-05-05", "2026-05-24", "2026-05-25", "2026-06-06", "2026-08-15", "2026-08-17",
  "2026-09-24", "2026-09-25", "2026-09-26", "2026-10-03", "2026-10-05", "2026-10-09", "2026-12-25",
]);

function isBusinessDay(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !HOLIDAYS_2026.has(d.toISOString().slice(0, 10));
}

/** 영업일 기준 +24h. 비영업일에 떨어지면 다음 영업일 같은 시각. */
export async function computeSlaDue(from: Date): Promise<Date> {
  const due = new Date(from.getTime() + 24 * 3600 * 1000);
  while (!isBusinessDay(due)) due.setDate(due.getDate() + 1);
  return due;
}

// 연락처 자가 노출 마스킹(S-1) — "고르기 전 비공개" 약속을 유저 실수로부터 보호
function maskContacts(text: string): { masked: string; hits: number } {
  let hits = 0;
  const masked = text
    .replace(/01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g, () => { hits++; return "[연락처는 병원에 전달되지 않아요]"; })
    .replace(/(카톡|카카오톡?|kakao)\s*(아이디|id)?\s*[:\s]?\s*[A-Za-z0-9_.-]{4,}/gi, () => { hits++; return "[연락처는 병원에 전달되지 않아요]"; });
  return { masked, hits };
}

export interface QuoteSubmitResult { ok: boolean; id?: string; slaDueAt?: string; queued?: boolean; error?: string }

export async function submitQuoteRequest(form: FormData): Promise<QuoteSubmitResult> {
  const db = getServerClient();
  if (!db) return { ok: false, error: "지금은 신청을 받을 수 없어요." };

  const procedureId = String(form.get("procedureId") ?? "").trim() || null;
  const concerns = String(form.get("concerns") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ageBand = String(form.get("ageBand") ?? "").trim() || null;
  const budgetRaw = String(form.get("budgetMax") ?? "").replace(/[^0-9]/g, "");
  const budgetMax = budgetRaw ? Math.min(Number(budgetRaw), 100000) : null;
  const downtime = String(form.get("downtime") ?? "any");
  const regionLabel = String(form.get("regionLabel") ?? "").trim() || null;
  const lat = Number(form.get("lat")) || null;
  const lng = Number(form.get("lng")) || null;
  const noteRaw = String(form.get("note") ?? "").trim().slice(0, 500);
  const notifyChannel = form.get("notifyChannel") === "sms" ? "sms" : "app";
  const phone = String(form.get("phone") ?? "").trim().replace(/[^0-9-]/g, "") || null;

  if (!concerns.length && !procedureId) return { ok: false, error: "고민이나 시술을 하나 이상 선택해주세요." };
  if (!["none", "weekend", "week", "any"].includes(downtime)) return { ok: false, error: "다운타임을 선택해주세요." };
  if (notifyChannel === "sms" && (!phone || phone.replace(/-/g, "").length < 9)) {
    return { ok: false, error: "문자로 받으시려면 연락처를 정확히 입력해주세요." };
  }

  // 주간 캡(hidden complexity #5) — 초과 시 대기열 안내(진입 시점 고지는 UI 담당)
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { count } = await db.from("quote_requests")
    .select("id", { count: "exact", head: true }).gte("created_at", weekAgo);
  const queued = (count ?? 0) >= WEEKLY_CAP;

  const { masked } = maskContacts(noteRaw);
  const slaDue = await computeSlaDue(new Date());

  const { data, error } = await db.from("quote_requests").insert({
    procedure_id: procedureId, concerns, age_band: ageBand, budget_max: budgetMax,
    downtime, region_label: regionLabel, lat, lng,
    note: masked || null, phone, notify_channel: notifyChannel,
    status: "submitted", sla_due_at: queued ? null : slaDue.toISOString(),
  }).select("id, sla_due_at").single();
  if (error || !data) return { ok: false, error: "신청 저장에 실패했어요. 잠시 후 다시 시도해주세요." };
  return { ok: true, id: data.id, slaDueAt: data.sla_due_at ?? undefined, queued };
}

// ── 결과 조회 — 화이트리스트만 반환(phone·notify 절대 금지) ──
export interface QuoteResultView {
  status: string;
  slaDueAt: string | null;
  procedureId: string | null;
  concerns: string[];
  regionLabel: string | null;
  createdAt: string;
  replies: {
    id: string; hospitalId: string | null; hospitalName: string;
    totalPrice: number | null; priceType: string; priceMax: number | null;
    skuSummary: string | null; conditions: string[]; extraCosts: string | null;
    validUntil: string | null;
  }[];
  refusedCount: number;
}

export async function getQuoteResult(requestId: string): Promise<{ ok: boolean; view?: QuoteResultView; error?: string }> {
  const db = getServerClient();
  if (!db || !/^[0-9a-f-]{36}$/.test(requestId)) return { ok: false, error: "요청을 찾지 못했어요." };
  const { data: q } = await db.from("quote_requests")
    .select("status,sla_due_at,procedure_id,concerns,region_label,created_at")
    .eq("id", requestId).single();
  if (!q) return { ok: false, error: "요청을 찾지 못했어요." }; // 존재 오라클 방지: 동일 에러
  const { data: replies } = await db.from("quote_replies")
    .select("id,hospital_id,hospital_name,total_price,price_type,price_max,sku_summary,conditions,extra_costs,valid_until,refused")
    .eq("request_id", requestId).order("total_price", { ascending: true, nullsFirst: false });
  const rows = (replies ?? []) as Record<string, unknown>[];
  const visible = rows.filter((r) => !r.refused); // E-5: 거절 카드 미노출
  return {
    ok: true,
    view: {
      status: q.status, slaDueAt: q.sla_due_at, procedureId: q.procedure_id,
      concerns: q.concerns ?? [], regionLabel: q.region_label, createdAt: q.created_at,
      replies: visible.map((r) => ({
        id: r.id as string, hospitalId: (r.hospital_id as string) ?? null, hospitalName: r.hospital_name as string,
        totalPrice: (r.total_price as number) ?? null, priceType: r.price_type as string,
        priceMax: (r.price_max as number) ?? null, skuSummary: (r.sku_summary as string) ?? null,
        conditions: (r.conditions as string[]) ?? [], extraCosts: (r.extra_costs as string) ?? null,
        validUntil: (r.valid_until as string) ?? null,
      })),
      refusedCount: rows.length - visible.length,
    },
  };
}

/** 열람 기록 — 결과 화면 마운트 후 명시 호출(프리뷰봇은 POST 안 함) */
export async function markQuoteViewed(requestId: string): Promise<void> {
  const db = getServerClient();
  if (!db || !/^[0-9a-f-]{36}$/.test(requestId)) return;
  await db.from("quote_requests").update({ viewed_at: new Date().toISOString() })
    .eq("id", requestId).is("viewed_at", null);
}

// ── 어드민(ADMIN_TOKEN) ──
function authed(token: string): boolean {
  return Boolean(process.env.ADMIN_TOKEN) && token === process.env.ADMIN_TOKEN;
}

export interface AdminQuote {
  id: string; procedureId: string | null; concerns: string[]; ageBand: string | null;
  budgetMax: number | null; downtime: string; regionLabel: string | null;
  lat: number | null; lng: number | null; note: string | null; phone: string | null;
  status: string; slaDueAt: string | null; createdAt: string; replyCount: number; refusedCount: number;
}

export async function adminListQuotes(token: string): Promise<{ ok: boolean; rows?: AdminQuote[]; error?: string }> {
  if (!authed(token)) return { ok: false, error: "인증 실패" };
  const db = getServerClient();
  if (!db) return { ok: false, error: "DB 미설정" };
  const { data, error } = await db.from("quote_requests")
    .select("*, quote_replies(id, refused)")
    .in("status", ["submitted", "collecting", "quoted"])
    .order("sla_due_at", { ascending: true, nullsFirst: false }).limit(50);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    rows: (data as unknown as Record<string, unknown>[]).map((r) => {
      const reps = (r.quote_replies as { refused: boolean }[]) ?? [];
      return {
        id: r.id as string, procedureId: (r.procedure_id as string) ?? null,
        concerns: (r.concerns as string[]) ?? [], ageBand: (r.age_band as string) ?? null,
        budgetMax: (r.budget_max as number) ?? null, downtime: r.downtime as string,
        regionLabel: (r.region_label as string) ?? null,
        lat: (r.lat as number) ?? null, lng: (r.lng as number) ?? null,
        note: (r.note as string) ?? null, phone: (r.phone as string) ?? null,
        status: r.status as string, slaDueAt: (r.sla_due_at as string) ?? null,
        createdAt: r.created_at as string,
        replyCount: reps.filter((x) => !x.refused).length, refusedCount: reps.filter((x) => x.refused).length,
      };
    }),
  };
}

export async function adminStartCollecting(token: string, id: string): Promise<{ ok: boolean }> {
  if (!authed(token)) return { ok: false };
  const db = getServerClient();
  if (!db) return { ok: false };
  await db.from("quote_requests").update({ status: "collecting", updated_at: new Date().toISOString() })
    .eq("id", id).eq("status", "submitted");
  return { ok: true };
}

export interface AdminReplyInput {
  requestId: string; hospitalId: string | null; hospitalName: string;
  totalPrice: number | null; priceType: "fixed" | "from" | "range" | "consult"; priceMax: number | null;
  skuSummary: string; conditions: string[]; extraCosts: string;
  validUntil: string | null; refused: boolean; refuseReason: string; askedBack: string;
}

export async function adminAddReply(token: string, r: AdminReplyInput): Promise<{ ok: boolean; warning?: string; error?: string }> {
  if (!authed(token)) return { ok: false, error: "인증 실패" };
  const db = getServerClient();
  if (!db) return { ok: false, error: "DB 미설정" };
  // §56 경고(S-2): 유저 노출 필드 전체 검사 — 차단 아닌 경고+수정 유도(운영자 입력)
  const flagged = findBannedPhrases([r.skuSummary, r.extraCosts, r.refuseReason].join(" "));
  const { error } = await db.rpc("admin_add_quote_reply", {
    p_request_id: r.requestId, p_hospital_id: r.hospitalId, p_hospital_name: r.hospitalName,
    p_total_price: r.totalPrice, p_price_type: r.priceType, p_price_max: r.priceMax,
    p_sku_summary: r.skuSummary || null, p_conditions: r.conditions, p_extra_costs: r.extraCosts || null,
    p_valid_until: r.validUntil, p_refused: r.refused, p_refuse_reason: r.refuseReason || null,
    p_asked_back: r.askedBack || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, warning: flagged.length ? `§56 의심 표현: ${flagged.map((f) => f.phrase).join(", ")}` : undefined };
}
