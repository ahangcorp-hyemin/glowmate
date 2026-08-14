import "server-only";
import { getServerClient } from "@/lib/supabase/server";
import type { Procedure, Source } from "@/lib/catalog/procedures";
import type { Concern } from "@/lib/catalog/rules";
import type { Catalog } from "@/lib/estimate/engine";
import { seedCatalog } from "@/lib/catalog/seed";

// DB read + snake→camel 매핑. DB 미설정/오류 시 정적 시드로 폴백(앱 안 깨짐).
// D3=B: DB가 설정되면 DB가 주인. 키 없으면 부트스트랩 시드.

let catalogCache: { at: number; value: Catalog } | null = null;
const TTL_MS = 60_000;

function warn(msg: string) {
  if (process.env.NODE_ENV !== "production") console.warn(`[catalog/repo] ${msg}`);
}

interface ProcRow {
  id: string; name_ko: string; category: Procedure["category"]; tagline: string;
  mechanism: string; effect: string; downtime: string; caution: string;
  side_effects: string; contraindication: string; misconception: string; vs_note: string;
  good_for: string; price_min: number; price_max: number; price_unit: Procedure["priceUnit"]; sessions: string | null;
}
interface SrcRow { procedure_id: string; label: string; url: string | null; source_type: Source["type"]; ord: number }
interface ConcernRow { id: string; name_ko: string; sentence: string; emoji: string }
interface RuleRow { concern_id: string; procedure_id: string; role: "base" | "addon" | "optional"; weight: number; rationale: string }

/** 엔진용 카탈로그. DB → Catalog 매핑, 실패 시 seedCatalog. 60s 캐시. */
export async function getCatalog(): Promise<Catalog> {
  const db = getServerClient();
  if (!db) return seedCatalog;
  if (catalogCache && Date.now() - catalogCache.at < TTL_MS) return catalogCache.value;

  try {
    const [procs, srcs, concerns, rules] = await Promise.all([
      db.from("procedures").select("*"),
      db.from("procedure_sources").select("*").order("ord", { ascending: true }),
      db.from("concerns").select("*"),
      db.from("concern_procedure_rules").select("*"),
    ]);
    if (procs.error || srcs.error || concerns.error || rules.error) throw (procs.error ?? srcs.error ?? concerns.error ?? rules.error);
    if (!procs.data?.length) throw new Error("empty procedures (seed 필요)");

    const srcByProc = new Map<string, Source[]>();
    for (const s of srcs.data as SrcRow[]) {
      const arr = srcByProc.get(s.procedure_id) ?? [];
      arr.push({ label: s.label, url: s.url ?? undefined, type: s.source_type });
      srcByProc.set(s.procedure_id, arr);
    }
    const proceduresById: Record<string, Procedure> = {};
    for (const r of procs.data as ProcRow[]) {
      proceduresById[r.id] = {
        id: r.id, nameKo: r.name_ko, category: r.category, tagline: r.tagline,
        mechanism: r.mechanism, effect: r.effect, downtime: r.downtime, caution: r.caution,
        sideEffects: r.side_effects, contraindication: r.contraindication,
        misconception: r.misconception, vsNote: r.vs_note, goodFor: r.good_for,
        priceMin: r.price_min, priceMax: r.price_max, priceUnit: r.price_unit,
        sessions: r.sessions ?? "", sources: srcByProc.get(r.id) ?? [],
      };
    }
    const concernsById: Record<string, Concern> = {};
    for (const c of concerns.data as ConcernRow[]) {
      concernsById[c.id] = { id: c.id, nameKo: c.name_ko, sentence: c.sentence, emoji: c.emoji };
    }
    const mappedRules = (rules.data as RuleRow[]).map((r) => ({
      concernId: r.concern_id, procedureId: r.procedure_id, role: r.role, weight: r.weight, rationale: r.rationale,
    }));
    const value: Catalog = { proceduresById, concernsById, rules: mappedRules };
    catalogCache = { at: Date.now(), value };
    return value;
  } catch (e) {
    warn(`DB read 실패 → 시드 폴백: ${(e as Error).message}`);
    return seedCatalog;
  }
}

/** 온보딩 카드용 고민 목록(sentence/emoji 포함). CONCERNS 순서 유지. */
export async function getConcerns(): Promise<Concern[]> {
  const cat = await getCatalog();
  // seed 순서를 신뢰(도메인 그룹핑은 UI 상수). DB도 동일 id 집합.
  return Object.values(cat.concernsById);
}
