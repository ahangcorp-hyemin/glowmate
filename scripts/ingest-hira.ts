// HIRA 실데이터 인제스트 → Supabase. 목업 대체.
// 실행: DATA_GO_KR_SERVICE_KEY + SUPABASE_* 설정 후 `bun run ingest`.
// 범위: 서울·경기 대상 지역의 피부과/성형외과 + 매핑된 비급여 시술 가격.
// ⚠️ 첫 실행 시 sido 코드·비급여 항목명은 각 데이터셋 활용가이드와 대조해 조정하세요.

import { createClient } from "@supabase/supabase-js";
import { fetchHospitalsNear, fetchNonPayItems, fetchNonPayHospList } from "../src/lib/hospitals/hira";
import { seedProcedures } from "../src/lib/catalog/seed";
import { REGIONS } from "../src/lib/geo/region";

// 우리 시술 → HIRA 비급여 항목명 키워드(매칭). 매핑 안 되면 그 시술은 '문의'로 남음(정직).
const NONPAY_KEYWORDS: Record<string, string[]> = {
  botox: ["보툴리눔", "보톡스"],
  filler: ["필러", "히알루론산"],
  toning: ["레이저 토닝", "토닝"],
  pico: ["피코"],
  skinbooster: ["스킨부스터", "물광"],
};
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

  // 2·3) 비급여 매핑 + 가격 — 엔드포인트 미확정 시에도 병원 인제스트는 유지(가격은 '문의').
  try {
    const items = await pageAll((p) => fetchNonPayItems(p));
    const codeToProc = new Map<string, string>();
    const mapRows: { procedure_id: string; nonpay_code: string; label: string }[] = [];
    for (const it of items) {
      for (const [procId, kws] of Object.entries(NONPAY_KEYWORDS)) {
        if (kws.some((k) => it.itemNm.includes(k))) {
          codeToProc.set(it.npayCd, procId);
          mapRows.push({ procedure_id: procId, nonpay_code: it.npayCd, label: it.itemNm });
        }
      }
    }
    if (mapRows.length) await db.from("procedure_nonpay_map").upsert(mapRows, { onConflict: "procedure_id,nonpay_code" });
    console.log(`  비급여 매핑 ${mapRows.length}건 (${new Set(mapRows.map((m) => m.procedure_id)).size}개 시술)`);

    const unitOf = Object.fromEntries(seedProcedures.map((p) => [p.id, p.priceUnit]));
    const snapshotId = crypto.randomUUID();
    let priceCount = 0;
    for (const [code, procId] of codeToProc) {
      const prices = await pageAll((p) => fetchNonPayHospList(code, p));
      const rows = prices
        .filter((r) => ykihoToId.has(r.ykiho) && (r.maxAmt || r.minAmt))
        .map((r) => ({
          hospital_id: ykihoToId.get(r.ykiho)!, procedure_id: procId, unit: unitOf[procId] ?? "회",
          price: r.maxAmt || r.minAmt, nonpay_code: code, is_promo: false,
          source_url: "https://www.hira.or.kr/npay", fetched_at: nowIso,
          snapshot_id: snapshotId, is_current: true,
        }));
      if (rows.length) { await db.from("hospital_procedure_prices").insert(rows); priceCount += rows.length; }
    }
    if (priceCount) await db.from("hospital_procedure_prices").update({ is_current: false }).neq("snapshot_id", snapshotId);
    console.log(`✓ 가격 ${priceCount}건`);
  } catch (e) {
    console.warn(`⚠ 비급여 가격 단계 건너뜀(엔드포인트 확인 필요): ${(e as Error).message.slice(0, 100)}`);
    console.warn("  → data.go.kr 15001700 상세페이지의 '엔드포인트' URL을 src/lib/hospitals/hira.ts의 NONPAY_* 상수에 반영하세요.");
  }
  console.log("완료.");
}

main().catch((e) => { console.error(e); process.exit(1); });
