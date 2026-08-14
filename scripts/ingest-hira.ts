// HIRA 실데이터 인제스트 → Supabase. 목업 대체.
// 실행: DATA_GO_KR_SERVICE_KEY + SUPABASE_* 설정 후 `bun run ingest`.
// 범위: 서울·경기 대상 지역의 피부과/성형외과 + 매핑된 비급여 시술 가격.
// ⚠️ 첫 실행 시 sido 코드·비급여 항목명은 각 데이터셋 활용가이드와 대조해 조정하세요.

import { createClient } from "@supabase/supabase-js";
import { fetchHospitalsNear, fetchNonPay } from "../src/lib/hospitals/hira";
import { seedProcedures } from "../src/lib/catalog/seed";
import { REGIONS } from "../src/lib/geo/region";

// 우리 시술 → HIRA 비급여 항목명 키워드(매칭). 넓게 잡되, HIRA 비급여는 미용 커버리지가
// 희박해 대부분 '문의'로 남는다(리서치 확인). 매칭되는 소수만 실가격 표시.
const NONPAY_KEYWORDS: Record<string, string[]> = {
  botox: ["보툴리눔", "보톡스"],
  filler: ["필러", "히알루론"],
  toning: ["토닝"],
  pico: ["피코"],
  skinbooster: ["스킨부스터", "물광"],
  ulthera: ["초음파집속", "hifu", "고강도초음파", "울쎄라"],
  thermage: ["써마지", "고주파"],
  thread: ["실리프팅", "매선"],
};
const estbToDate = (s: string) => (/^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null);
const RADIUS_M = 3000;                             // 지역 중심 반경(m)
const AESTHETIC = /(피부과|성형외과)/;

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SKEY) { console.error("✗ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요"); process.exit(1); }
const db = createClient(URL, SKEY, { auth: { persistSession: false } });
const nowIso = new Date().toISOString();

async function pageAll<T>(fn: (page: number) => Promise<T[]>, cap = 20): Promise<T[]> {
  const out: T[] = [];
  for (let p = 1; p <= cap; p++) {
    const rows = await fn(p);
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

async function main() {
  console.log("→ HIRA 인제스트 시작");

  // 1) 병원(피부과/성형외과) 업서트 — 지역 중심 반경검색으로 볼륨 최소화.
  //    진료과목(의료기관별상세정보서비스)으로 정확 판별. 이름에 이미 매칭되면 상세호출 생략(콜 절약).
  const ykihoToId = new Map<string, string>();
  const seen = new Set<string>();
  for (const region of REGIONS) {
    const near = await pageAll((p) => fetchHospitalsNear(region.lng, region.lat, RADIUS_M, p));
    const rows: Record<string, unknown>[] = [];
    for (const h of near) {
      if (!h.ykiho || seen.has(h.ykiho)) continue;
      if (!["31", "21"].includes(h.clCd)) continue; // 의원·병원만(상급종합/치과/한방 등 제외)
      if (!AESTHETIC.test(h.yadmNm)) continue;       // 진료과목명(피부과/성형외과)로 판별
      const lat = Number(h.YPos), lng = Number(h.XPos);
      if (!lat || !lng) continue;
      seen.add(h.ykiho);
      rows.push({
        ykiho: h.ykiho, name: h.yadmNm, region: region.label,
        district: h.sgguCdNm || null, address: h.addr || null, lat, lng,
        phone: h.telno || null, is_aesthetic: true, status: "active", fetched_at: nowIso,
        cl_nm: h.clCdNm || null, emdong: h.emdongNm || null, postal: h.postNo || null,
        estb_dd: estbToDate(h.estbDd), doctor_count: Number(h.drTotCnt) || null,
        homepage_url: h.hospUrl || null,
      });
    }
    if (rows.length) {
      const { data, error } = await db.from("hospitals").upsert(rows, { onConflict: "ykiho" }).select("id,ykiho");
      if (error) console.warn(`  ${region.label} 업서트:`, error.message);
      else (data as { id: string; ykiho: string }[]).forEach((d) => ykihoToId.set(d.ykiho, d.id));
    }
    console.log(`  ${region.label}: 피부/성형 ${rows.length}곳`);
  }
  console.log(`  병원 총 ${ykihoToId.size}곳`);

  // 2) 비급여 가격(best-effort) — 전국 비급여를 훑어 우리 병원(ykiho) + 미용 항목명 매칭분만 저장.
  //    HIRA 비급여는 미용 커버리지가 희박해 대부분 '문의'로 남는다(리서치). 매칭 소수만 실가격.
  try {
    const unitOf = Object.fromEntries(seedProcedures.map((p) => [p.id, p.priceUnit]));
    const snapshotId = crypto.randomUUID();
    const priceRows: Record<string, unknown>[] = [];
    const mapRows = new Map<string, { procedure_id: string; nonpay_code: string; label: string }>();
    const homepageByYkiho = new Map<string, string>();
    for (let p = 1; p <= 20; p++) {
      const rows = await fetchNonPay(p);
      for (const r of rows) {
        if (r.url && ykihoToId.has(r.ykiho) && !homepageByYkiho.has(r.ykiho)) homepageByYkiho.set(r.ykiho, r.url);
        if (!ykihoToId.has(r.ykiho)) continue;
        for (const [procId, kws] of Object.entries(NONPAY_KEYWORDS)) {
          if (kws.some((k) => r.itmCdNm.toLowerCase().includes(k.toLowerCase()))) {
            const price = r.prcMax || r.prcMin;
            if (!price) continue;
            priceRows.push({
              hospital_id: ykihoToId.get(r.ykiho)!, procedure_id: procId, unit: unitOf[procId] ?? "회",
              price, nonpay_code: r.itmCd, is_promo: false, source_url: "https://www.hira.or.kr/npay",
              fetched_at: nowIso, snapshot_id: snapshotId, is_current: true,
            });
            mapRows.set(`${procId}:${r.itmCd}`, { procedure_id: procId, nonpay_code: r.itmCd, label: r.itmCdNm });
          }
        }
      }
      if (rows.length < 1000) break;
    }
    // 비급여 url로 홈페이지 보강
    for (const [ykiho, url] of homepageByYkiho) {
      await db.from("hospitals").update({ homepage_url: url }).eq("id", ykihoToId.get(ykiho)!).is("homepage_url", null);
    }
    if (mapRows.size) await db.from("procedure_nonpay_map").upsert([...mapRows.values()], { onConflict: "procedure_id,nonpay_code" });
    if (priceRows.length) {
      await db.from("hospital_procedure_prices").insert(priceRows);
      await db.from("hospital_procedure_prices").update({ is_current: false }).neq("snapshot_id", snapshotId);
    }
    console.log(`✓ 비급여 실가격 ${priceRows.length}건 (${new Set(priceRows.map((r) => r.procedure_id)).size}개 시술) · 홈페이지 ${homepageByYkiho.size}곳`);
  } catch (e) {
    console.warn(`⚠ 비급여 가격 단계 스킵: ${(e as Error).message.slice(0, 100)}`);
  }
  console.log("완료.");
}

main().catch((e) => { console.error(e); process.exit(1); });
