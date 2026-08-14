// TS 시드 → Supabase DB 부트스트랩(멱등: 카탈로그 upsert, 병원은 clean-slate).
// 실행: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 설정 후 `bun run seed`.
// 각 텍스트 필드는 §56 assertCompliant 통과 확인(방어선2). DB 트리거가 방어선1.

import { createClient } from "@supabase/supabase-js";
import { seedProcedures, seedConcerns, seedRules } from "../src/lib/catalog/seed";
import { BANNED_PHRASES, assertCompliant } from "../src/lib/compliance/bannedPhrases";
import { LESSON_SEED } from "../src/lib/lessons/seed";

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

  // 6) 병원·가격은 시드하지 않는다 — scripts/ingest-hira.ts가 실데이터로 채운다(목업 제거).

  // 7) 레슨 + 카드 (clean-slate 후 재적재). §56 트리거 없음(리터러시 인용 보호).
  const lessons = Object.values(LESSON_SEED);
  must(await db.from("lesson_cards").delete().neq("id", -1), "clear lesson_cards");
  must(await db.from("lessons").delete().neq("procedure_id", "__none__"), "clear lessons");
  for (const l of lessons) {
    must(await db.from("lessons").insert({ procedure_id: l.procedureId, name_ko: l.nameKo }), `lesson ${l.procedureId}`);
    const cardRows = l.cards.map((c, i) => {
      const { kind, ...payload } = c as { kind: string } & Record<string, unknown>;
      return { procedure_id: l.procedureId, ord: i, kind, payload };
    });
    must(await db.from("lesson_cards").insert(cardRows), `lesson_cards ${l.procedureId}`);
  }

  console.log(`✓ 시드 완료 — 시술 ${seedProcedures.length} · 고민 ${seedConcerns.length} · 룰 ${seedRules.length} · 레슨 ${lessons.length}`);
  console.log("  병원·가격은 `bun run ingest`(HIRA 실데이터)로 채우세요.");
}

main().catch((e) => { console.error(e); process.exit(1); });
