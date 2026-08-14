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
