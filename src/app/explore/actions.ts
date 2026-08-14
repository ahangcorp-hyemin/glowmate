"use server";

import { getServerClient } from "@/lib/supabase/server";
import { getCatalog } from "@/lib/catalog/repo";
import { findBannedPhrases } from "@/lib/compliance/bannedPhrases";

// 후기 제출(U4). 원칙(REVIEW_PRODUCT_PLAN):
// - 모든 제출은 status='hidden'(검수 대기)으로 적재, 검수 후 공개
// - 영수증은 '선택' 첨부 → 비공개 버킷 저장, 확인되면 인증 배지
// - §56 필터는 차단이 아니라 검수 우선순위 플래그(유저 발화는 광고가 아님)

const AGE_BANDS = ["30대", "40대", "50대", "60대+"];

export interface SubmitResult { ok: boolean; error?: string }

export async function submitReview(form: FormData): Promise<SubmitResult> {
  const db = getServerClient();
  if (!db) return { ok: false, error: "지금은 제출을 받을 수 없어요. 잠시 후 다시 시도해주세요." };

  const procedureId = String(form.get("procedureId") ?? "");
  const hospitalName = String(form.get("hospitalName") ?? "").trim();
  const ageBand = String(form.get("ageBand") ?? "");
  const rating = Number(form.get("rating") ?? 0);
  const weeks = form.get("weeks") ? Number(form.get("weeks")) : null;
  const body = String(form.get("body") ?? "").trim();
  const consented = form.get("consented") === "on";
  const independent = form.get("independent") === "on";

  const catalog = await getCatalog();
  if (!catalog.proceduresById[procedureId]) return { ok: false, error: "시술을 선택해주세요." };
  if (hospitalName.length < 2) return { ok: false, error: "병원 이름을 입력해주세요." };
  if (!AGE_BANDS.includes(ageBand)) return { ok: false, error: "연령대를 선택해주세요." };
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "만족도를 선택해주세요." };
  if (body.length < 30) return { ok: false, error: "경험담을 30자 이상 적어주세요. 또래에게 큰 도움이 돼요." };
  if (body.length > 3000) return { ok: false, error: "3,000자 이내로 줄여주세요." };
  if (!consented) return { ok: false, error: "민감정보 수집 동의가 필요해요." };
  if (!independent) return { ok: false, error: "병원과 무관하게 작성했다는 확인이 필요해요." };

  // 영수증(선택) — 비공개 버킷
  let receiptPath: string | null = null;
  const receipt = form.get("receipt");
  if (receipt instanceof File && receipt.size > 0) {
    if (!receipt.type.startsWith("image/")) return { ok: false, error: "영수증은 사진 파일로 올려주세요." };
    if (receipt.size > 8 * 1024 * 1024) return { ok: false, error: "사진이 8MB를 넘어요. 작은 사진으로 올려주세요." };
    const ext = receipt.type.split("/")[1] ?? "jpg";
    const path = `r/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await db.storage.from("receipts")
      .upload(path, await receipt.arrayBuffer(), { contentType: receipt.type });
    if (upErr) return { ok: false, error: "사진 업로드에 실패했어요. 사진 없이 제출하셔도 돼요." };
    receiptPath = path;
  }

  const flagged = findBannedPhrases(body).map((h) => h.phrase).join(",") || null;

  const { error } = await db.from("reviews").insert({
    procedure_id: procedureId, hospital_name: hospitalName, age_band: ageBand,
    rating, weeks_elapsed: weeks, body, receipt_path: receiptPath,
    flagged_phrases: flagged, source: "web", status: "hidden",
    is_verified_visit: false, is_sponsored: false, reward_disclosed: false,
  });
  if (error) return { ok: false, error: "저장에 실패했어요. 잠시 후 다시 시도해주세요." };
  return { ok: true };
}
