"use server";

import { getServerClient } from "@/lib/supabase/server";

// 입점 문의(U5). partner_inquiries에 적재(공개 정책 없음 — 서버만 읽음).
export interface PartnerResult { ok: boolean; error?: string }

export async function submitPartnerInquiry(form: FormData): Promise<PartnerResult> {
  const db = getServerClient();
  if (!db) return { ok: false, error: "지금은 접수를 받을 수 없어요. korea@glowmate.kr 로 메일 주세요." };

  const hospitalName = String(form.get("hospitalName") ?? "").trim();
  const region = String(form.get("region") ?? "").trim() || null;
  const contactName = String(form.get("contactName") ?? "").trim();
  const contact = String(form.get("contact") ?? "").trim();
  const message = String(form.get("message") ?? "").trim() || null;
  const consented = form.get("consented") === "on";

  if (hospitalName.length < 2) return { ok: false, error: "병원 이름을 입력해주세요." };
  if (contactName.length < 2) return { ok: false, error: "담당자 성함을 입력해주세요." };
  if (contact.length < 5) return { ok: false, error: "연락처(전화 또는 이메일)를 입력해주세요." };
  if (!consented) return { ok: false, error: "개인정보 수집·이용 동의가 필요해요." };

  const { error } = await db.from("partner_inquiries").insert({
    hospital_name: hospitalName, region, contact_name: contactName, contact, message, consented,
  });
  if (error) return { ok: false, error: "접수에 실패했어요. 잠시 후 다시 시도해주세요." };
  return { ok: true };
}
