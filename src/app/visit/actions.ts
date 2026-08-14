"use server";

import { getServerClient } from "@/lib/supabase/server";

// 방문 희망 신청. 입점 병원 → 병원 전달(추후 알림 채널), 미입점 → 컨시어지(우리가 전화 확인).
// §27: 건당 수수료 없음 — 정보 전달·일정 확인 대행. UI 고지 필수.

export interface VisitResult { ok: boolean; id?: string; isPartner?: boolean; error?: string }

export async function submitVisitRequest(form: FormData): Promise<VisitResult> {
  const db = getServerClient();
  if (!db) return { ok: false, error: "지금은 신청을 받을 수 없어요. 병원에 직접 전화해주세요." };

  const hospitalId = String(form.get("hospitalId") ?? "");
  const visitorName = String(form.get("visitorName") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim().replace(/[^0-9-]/g, "");
  const date = String(form.get("date") ?? "");
  const times = String(form.get("times") ?? "").split(",").map((t) => t.trim()).filter(Boolean);
  const procedureId = String(form.get("procedureId") ?? "").trim() || null;
  const note = String(form.get("note") ?? "").trim() || null;
  const consented = form.get("consented") === "on";

  if (visitorName.length < 2) return { ok: false, error: "성함을 입력해주세요." };
  if (phone.replace(/-/g, "").length < 9) return { ok: false, error: "연락처를 정확히 입력해주세요." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "방문 희망 날짜를 선택해주세요." };
  if (!times.length) return { ok: false, error: "희망 시간을 하나 이상 선택해주세요." };
  if (!consented) return { ok: false, error: "연락처 수집·이용 동의가 필요해요." };

  const { data: h, error: hErr } = await db.from("hospitals")
    .select("id,name,status").eq("id", hospitalId).single();
  if (hErr || !h || h.status !== "active") return { ok: false, error: "병원 정보를 찾지 못했어요." };
  // is_partner는 0008 이후 존재 — 소프트 조회(전 상태에선 미입점 취급)
  let isPartner = false;
  const p = await db.from("hospitals").select("is_partner").eq("id", hospitalId).single();
  if (!p.error) isPartner = Boolean((p.data as { is_partner?: boolean } | null)?.is_partner);

  const { data, error } = await db.from("visit_requests").insert({
    hospital_id: h.id, hospital_name: h.name, is_partner: isPartner,
    procedure_id: procedureId, visitor_name: visitorName, phone,
    desired_date: date, desired_times: times, note, consented,
    status: "requested",
  }).select("id").single();
  if (error) return { ok: false, error: "신청 저장에 실패했어요. 잠시 후 다시 시도해주세요." };
  return { ok: true, id: data!.id, isPartner };
}
