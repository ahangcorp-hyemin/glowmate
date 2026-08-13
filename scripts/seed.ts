// TS 시드 → Supabase DB 부트스트랩(멱등: 카탈로그 upsert, 병원은 clean-slate).
// 실행: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 설정 후 `bun run seed`.
// 각 텍스트 필드는 §56 assertCompliant 통과 확인(방어선2). DB 트리거가 방어선1.

import { createClient } from "@supabase/supabase-js";
import { seedProcedures, seedConcerns, seedRules } from "../src/lib/catalog/seed";
import { HOSPS, hospitalPrices } from "../src/lib/catalog/hospitals";
import { BANNED_PHRASES, assertCompliant } from "../src/lib/compliance/bannedPhrases";

const URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("✗ SUPABASE_URL 와 SUPABASE_SERVICE_ROLE_KEY 를 .env.local 에 설정하세요.");
  process.exit(1);
}
const db = createClient(URL, KEY, { auth: { persistSession: false } });

function must<T>(r: { error: unknown; data: T | null }, what: string): T {
  if (r.error) { console.error(`✗ ${what}:`, r.error); process.exit(1); }
  return r.data as T;
}

async function main() {
  console.log("→ 시드 시작:", URL);

  // 0) 금지표현(트리거 소스) 먼저
  must(await db.from("banned_phrases").upsert(BANNED_PHRASES.map((phrase) => ({ phrase }))), "banned_phrases");

  // 1) §56 로컬 사전검증(빠른 실패)
  for (const p of seedProcedures) {
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === "string") assertCompliant(v, `procedure ${p.id}.${k}`);
    }
    p.sources.forEach((s) => assertCompliant(s.label, `source ${p.id}`));
  }
  seedConcerns.forEach((c) => assertCompliant(c.sentence, `concern ${c.id}`));

  // 2) procedures upsert
  must(await db.from("procedures").upsert(seedProcedures.map((p) => ({
    id: p.id, name_ko: p.nameKo, category: p.category, tagline: p.tagline,
    mechanism: p.mechanism, effect: p.effect, downtime: p.downtime, caution: p.caution,
    side_effects: p.sideEffects, contraindication: p.contraindication,
    misconception: p.misconception, vs_note: p.vsNote, good_for: p.goodFor,
    price_min: p.priceMin, price_max: p.priceMax, price_unit: p.priceUnit, sessions: p.sessions,
  }))), "procedures");

  // 3) procedure_sources: 전체 재적재(ord 유지)
  must(await db.from("procedure_sources").delete().neq("id", -1), "clear sources");
  const srcRows = seedProcedures.flatMap((p) =>
    p.sources.map((s, i) => ({ procedure_id: p.id, label: s.label, url: s.url ?? null, source_type: s.type, ord: i })));
  must(await db.from("procedure_sources").insert(srcRows), "procedure_sources");

  // 4) concerns upsert
  must(await db.from("concerns").upsert(seedConcerns.map((c) => ({
    id: c.id, name_ko: c.nameKo, sentence: c.sentence, emoji: c.emoji,
  }))), "concerns");

  // 5) rules upsert
  must(await db.from("concern_procedure_rules").upsert(seedRules.map((r) => ({
    concern_id: r.concernId, procedure_id: r.procedureId, role: r.role, weight: r.weight, rationale: r.rationale,
  }))), "rules");

  // 6) 병원 + 가격: clean-slate 후 재적재(스냅샷 1개)
  must(await db.from("hospital_procedure_prices").delete().neq("id", "00000000-0000-0000-0000-000000000000"), "clear prices");
  must(await db.from("hospitals").delete().neq("id", "00000000-0000-0000-0000-000000000000"), "clear hospitals");

  const snapshotId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  for (const h of HOSPS) {
    const inserted = must<{ id: string }[]>(await db.from("hospitals").insert({
      name: h.n, region: h.d.split(" ")[0], district: h.d, rating: h.r, review_count: h.rv,
      source_url: null, fetched_at: nowIso, status: "active",
    }).select("id"), `hospital ${h.n}`);
    const hospitalId = inserted[0].id;
    // 이 병원의 시술별 참고가(시드 룰: priceMin*mult)
    const priceRows = seedProcedures.map((p) => ({
      hospital_id: hospitalId, procedure_id: p.id, unit: p.priceUnit,
      price: Math.round((p.priceMin * h.mult) / 1000) * 1000,
      is_promo: false, source_url: "seed://glowmate", fetched_at: nowIso,
      snapshot_id: snapshotId, is_current: true,
    }));
    must(await db.from("hospital_procedure_prices").insert(priceRows), `prices ${h.n}`);
    // 광고(정액) 시드: isAd 병원 1곳만
    if (h.ad) {
      must(await db.from("ad_placements").insert(seedProcedures.map((p) => ({
        hospital_id: hospitalId, procedure_id: p.id, slot: "list", monthly_fee: 300000, active: true,
      }))), `ad ${h.n}`);
    }
  }

  // 정적 hospitalPrices와 동일 로직 확인용 로그
  console.log(`✓ 시드 완료 — 시술 ${seedProcedures.length} · 고민 ${seedConcerns.length} · 룰 ${seedRules.length} · 병원 ${HOSPS.length}`);
  console.log(`  (참고: 울쎄라 최저가 예시 ${hospitalPrices(seedProcedures.find((p) => p.id === "ulthera")!.priceMin)[0].price.toLocaleString()}원)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
