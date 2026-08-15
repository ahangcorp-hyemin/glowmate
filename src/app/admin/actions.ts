"use server";

import { getServerClient } from "@/lib/supabase/server";

// 어드민(내부 운영) — ADMIN_TOKEN 일치 시에만 동작. 방문신청 큐 + 파트너 토글.
// 유저/병원/운영자 3자 관점(모두닥 러닝): 운영자가 상태를 굴려야 유저 약속("반나절 내 연락")이 지켜진다.

function authed(token: string): boolean {
  return Boolean(process.env.ADMIN_TOKEN) && token === process.env.ADMIN_TOKEN;
}

export interface AdminVisit {
  id: string; hospitalName: string; hospitalPhone: string | null; isPartner: boolean;
  procedureId: string | null; visitorName: string; phone: string;
  desiredDate: string; desiredTimes: string[]; note: string | null;
  status: string; adminMemo: string | null; createdAt: string;
}

export async function adminListVisits(token: string): Promise<{ ok: boolean; rows?: AdminVisit[]; error?: string }> {
  if (!authed(token)) return { ok: false, error: "인증 실패" };
  const db = getServerClient();
  if (!db) return { ok: false, error: "DB 미설정" };
  const { data, error } = await db.from("visit_requests")
    .select("id,hospital_name,is_partner,procedure_id,visitor_name,phone,desired_date,desired_times,note,status,admin_memo,created_at,hospital_id,hospitals(phone)")
    .order("created_at", { ascending: false }).limit(100);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    rows: (data as unknown as Record<string, unknown>[]).map((r) => ({
      id: r.id as string, hospitalName: r.hospital_name as string,
      hospitalPhone: ((r.hospitals as { phone?: string | null } | null)?.phone) ?? null,
      isPartner: Boolean(r.is_partner), procedureId: (r.procedure_id as string) ?? null,
      visitorName: r.visitor_name as string, phone: r.phone as string,
      desiredDate: r.desired_date as string, desiredTimes: (r.desired_times as string[]) ?? [],
      note: (r.note as string) ?? null, status: r.status as string,
      adminMemo: (r.admin_memo as string) ?? null, createdAt: r.created_at as string,
    })),
  };
}

export async function adminUpdateVisit(token: string, id: string, status: string, memo?: string): Promise<{ ok: boolean; error?: string }> {
  if (!authed(token)) return { ok: false, error: "인증 실패" };
  const db = getServerClient();
  if (!db) return { ok: false, error: "DB 미설정" };
  const allowed = ["requested", "forwarded", "concierge", "confirmed", "declined", "canceled"];
  if (!allowed.includes(status)) return { ok: false, error: "잘못된 상태" };
  const { error } = await db.from("visit_requests")
    .update({ status, admin_memo: memo ?? null, updated_at: new Date().toISOString() }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function adminSetPartner(token: string, hospitalName: string, isPartner: boolean): Promise<{ ok: boolean; count?: number; error?: string }> {
  if (!authed(token)) return { ok: false, error: "인증 실패" };
  const db = getServerClient();
  if (!db) return { ok: false, error: "DB 미설정" };
  const { data, error } = await db.from("hospitals").update({ is_partner: isPartner })
    .eq("name", hospitalName).select("id");
  if (error) return { ok: false, error: error.message };
  return { ok: true, count: (data ?? []).length };
}

// ── 대시보드 ──────────────────────────────────────────────
export async function adminStats(token: string): Promise<{ ok: boolean; pendingReviews?: number; openVisits?: number; newInquiries?: number; openQuotes?: number; error?: string }> {
  if (!authed(token)) return { ok: false, error: "인증 실패" };
  const db = getServerClient();
  if (!db) return { ok: false, error: "DB 미설정" };
  const [rev, vis, inq, quo] = await Promise.all([
    db.from("reviews").select("id", { count: "exact", head: true }).eq("status", "hidden"),
    db.from("visit_requests").select("id", { count: "exact", head: true }).in("status", ["requested", "forwarded", "concierge"]),
    db.from("partner_inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    db.from("quote_requests").select("id", { count: "exact", head: true }).in("status", ["submitted", "collecting", "quoted"]),
  ]);
  return { ok: true, pendingReviews: rev.count ?? 0, openVisits: vis.count ?? 0, newInquiries: inq.count ?? 0, openQuotes: quo.count ?? 0 };
}

// ── 후기 검수 ─────────────────────────────────────────────
export interface AdminReview {
  id: string; procedureId: string | null; hospitalName: string | null; ageBand: string | null;
  rating: number | null; body: string; weeks: number | null; createdAt: string;
  paidAmount: number | null; priceMatch: string | null; procedureSpec: string | null;
  flagged: string | null; hasReceipt: boolean; isVerified: boolean; status: string;
}

export async function adminListReviews(token: string, status: "hidden" | "shown" | "demoted"): Promise<{ ok: boolean; rows?: AdminReview[]; error?: string }> {
  if (!authed(token)) return { ok: false, error: "인증 실패" };
  const db = getServerClient();
  if (!db) return { ok: false, error: "DB 미설정" };
  const { data, error } = await db.from("reviews")
    .select("id,procedure_id,hospital_name,age_band,rating,body,weeks_elapsed,created_at,paid_amount,price_match,procedure_spec,flagged_phrases,receipt_path,is_verified_visit,status")
    .eq("status", status).order("created_at", { ascending: false }).limit(100);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    rows: (data as unknown as Record<string, unknown>[]).map((r) => ({
      id: r.id as string, procedureId: (r.procedure_id as string) ?? null,
      hospitalName: (r.hospital_name as string) ?? null, ageBand: (r.age_band as string) ?? null,
      rating: (r.rating as number) ?? null, body: (r.body as string) ?? "",
      weeks: (r.weeks_elapsed as number) ?? null, createdAt: r.created_at as string,
      paidAmount: (r.paid_amount as number) ?? null, priceMatch: (r.price_match as string) ?? null,
      procedureSpec: (r.procedure_spec as string) ?? null, flagged: (r.flagged_phrases as string) ?? null,
      hasReceipt: Boolean(r.receipt_path), isVerified: Boolean(r.is_verified_visit), status: r.status as string,
    })),
  };
}

// publish=공개(shown) / hide=대기유지(hidden) / reject=반려(demoted). verify=실방문 인증 토글 동반 가능.
export async function adminModerateReview(token: string, id: string, action: "publish" | "hide" | "reject", verify?: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!authed(token)) return { ok: false, error: "인증 실패" };
  const db = getServerClient();
  if (!db) return { ok: false, error: "DB 미설정" };
  const status = action === "publish" ? "shown" : action === "reject" ? "demoted" : "hidden";
  const patch: Record<string, unknown> = { status };
  if (typeof verify === "boolean") patch.is_verified_visit = verify;
  const { error } = await db.from("reviews").update(patch).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// 영수증(비공개 버킷) 열람용 서명 URL — 60초.
export async function adminReceiptUrl(token: string, reviewId: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!authed(token)) return { ok: false, error: "인증 실패" };
  const db = getServerClient();
  if (!db) return { ok: false, error: "DB 미설정" };
  const { data: r } = await db.from("reviews").select("receipt_path").eq("id", reviewId).single();
  const path = (r as { receipt_path?: string } | null)?.receipt_path;
  if (!path) return { ok: false, error: "영수증 없음" };
  const { data, error } = await db.storage.from("receipts").createSignedUrl(path, 60);
  return error || !data ? { ok: false, error: "URL 생성 실패" } : { ok: true, url: data.signedUrl };
}

// ── 파트너 문의 ───────────────────────────────────────────
export interface AdminInquiry {
  id: string; hospitalName: string; region: string | null; contactName: string;
  contact: string; message: string | null; status: string; createdAt: string;
}

export async function adminListInquiries(token: string): Promise<{ ok: boolean; rows?: AdminInquiry[]; error?: string }> {
  if (!authed(token)) return { ok: false, error: "인증 실패" };
  const db = getServerClient();
  if (!db) return { ok: false, error: "DB 미설정" };
  const { data, error } = await db.from("partner_inquiries")
    .select("id,hospital_name,region,contact_name,contact,message,status,created_at")
    .order("created_at", { ascending: false }).limit(100);
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    rows: (data as unknown as Record<string, unknown>[]).map((r) => ({
      id: r.id as string, hospitalName: r.hospital_name as string, region: (r.region as string) ?? null,
      contactName: r.contact_name as string, contact: r.contact as string,
      message: (r.message as string) ?? null, status: (r.status as string) ?? "new", createdAt: r.created_at as string,
    })),
  };
}

export async function adminUpdateInquiry(token: string, id: string, status: "new" | "contacted" | "done"): Promise<{ ok: boolean; error?: string }> {
  if (!authed(token)) return { ok: false, error: "인증 실패" };
  const db = getServerClient();
  if (!db) return { ok: false, error: "DB 미설정" };
  const { error } = await db.from("partner_inquiries").update({ status }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
