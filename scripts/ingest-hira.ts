// HIRA 실데이터 인제스트 → Supabase. 목업 대체.
// 실행: DATA_GO_KR_SERVICE_KEY + SUPABASE_* 설정 후 `bun run ingest`.
// 범위: 서울·경기 대상 지역의 피부과/성형외과 + 매핑된 비급여 시술 가격.
// ⚠️ 첫 실행 시 sido 코드·비급여 항목명은 각 데이터셋 활용가이드와 대조해 조정하세요.

import { createClient } from "@supabase/supabase-js";
import { fetchHospitals, fetchNonPayItems, fetchNonPayHospList } from "../src/lib/hospitals/hira";
import { seedProcedures } from "../src/lib/catalog/seed";

// 우리 시술 → HIRA 비급여 항목명 키워드(매칭). 매핑 안 되면 그 시술은 '문의'로 남음(정직).
const NONPAY_KEYWORDS: Record<string, string[]> = {
  botox: ["보툴리눔", "보톡스"],
  filler: ["필러", "히알루론산"],
  toning: ["레이저 토닝", "토닝"],
  pico: ["피코"],
  skinbooster: ["스킨부스터", "물광"],
};
const SIDOS = ["110000", "310000"];               // 서울, 경기 (활용가이드에서 확인)
const REGION_KEYS = ["강남구", "서초구", "송파구", "분당구", "마포구", "용산구"];
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

  // 1) 병원(피부과/성형외과, 대상 지역) 업서트
  const ykihoToId = new Map<string, string>();
  let hospCount = 0;
  for (const sido of SIDOS) {
    const all = await pageAll((p) => fetchHospitals(sido, p));
    const target = all.filter((h) => AESTHETIC.test(h.yadmNm) && REGION_KEYS.some((k) => h.addr.includes(k)));
    for (const h of target) {
      const lat = Number(h.YPos), lng = Number(h.XPos);
      if (!h.ykiho || !lat || !lng) continue;
      const { data, error } = await db.from("hospitals").upsert({
        ykiho: h.ykiho, name: h.yadmNm, region: sido === "110000" ? "서울" : "경기",
        district: h.sgguCdNm || null, address: h.addr || null, lat, lng,
        phone: h.telno || null, is_aesthetic: true, status: "active", fetched_at: nowIso,
      }, { onConflict: "ykiho" }).select("id").single();
      if (error) { console.warn("hospital upsert:", error.message); continue; }
      ykihoToId.set(h.ykiho, data!.id);
      hospCount++;
    }
  }
  console.log(`  병원 ${hospCount}곳`);

  // 2) 비급여 항목명 → 시술 매핑(procedure_nonpay_map)
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

  // 3) 가격 업서트(스냅샷 교체)
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
  // 이전 스냅샷 비활성화
  await db.from("hospital_procedure_prices").update({ is_current: false }).neq("snapshot_id", snapshotId);
  console.log(`✓ 가격 ${priceCount}건 인제스트 완료`);
}

main().catch((e) => { console.error(e); process.exit(1); });
