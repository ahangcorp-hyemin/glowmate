import "server-only";
import { getServerClient } from "@/lib/supabase/server";
import type { LessonCard, LessonContent } from "@/lib/lessons/types";
import { LESSON_SEED } from "@/lib/lessons/seed";

// 레슨 데이터 seam. catalog/repo.ts와 동일한 규약:
//   DB 우선 → snake→camel 매핑 → 실패/미설정/빈 테이블이면 정적 시드 폴백(앱 안 깨짐).
// 백엔드는 lessons + lesson_cards 테이블만 채우면 UI 변경 0.
// DB 스키마: supabase/migrations/0002_lessons.sql · 계약: docs/LESSON_CONTENT_CONTRACT.md

let cache: { at: number; value: Record<string, LessonContent> } | null = null;
const TTL_MS = 60_000;

function warn(msg: string) {
  if (process.env.NODE_ENV !== "production") console.warn(`[lessons/repo] ${msg}`);
}

interface LessonRow { procedure_id: string; name_ko: string }
interface CardRow { procedure_id: string; ord: number; kind: LessonCard["kind"]; payload: Record<string, unknown> }

/** 카드 행(kind + payload jsonb) → LessonCard union. payload는 카드별 필드를 그대로 담는다. */
function toCard(r: CardRow): LessonCard {
  return { kind: r.kind, ...r.payload } as LessonCard;
}

async function loadAll(): Promise<Record<string, LessonContent>> {
  const db = getServerClient();
  if (!db) return LESSON_SEED;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  try {
    const [lessons, cards] = await Promise.all([
      db.from("lessons").select("procedure_id, name_ko"),
      db.from("lesson_cards").select("procedure_id, ord, kind, payload").order("ord", { ascending: true }),
    ]);
    if (lessons.error || cards.error) throw (lessons.error ?? cards.error);
    if (!lessons.data?.length) throw new Error("empty lessons (seed 필요)");

    const cardsByProc = new Map<string, LessonCard[]>();
    for (const c of cards.data as CardRow[]) {
      const arr = cardsByProc.get(c.procedure_id) ?? [];
      arr.push(toCard(c));
      cardsByProc.set(c.procedure_id, arr);
    }
    const out: Record<string, LessonContent> = {};
    for (const l of lessons.data as LessonRow[]) {
      out[l.procedure_id] = { procedureId: l.procedure_id, nameKo: l.name_ko, cards: cardsByProc.get(l.procedure_id) ?? [] };
    }
    cache = { at: Date.now(), value: out };
    return out;
  } catch (e) {
    warn(`DB read 실패 → 시드 폴백: ${(e as Error).message}`);
    return LESSON_SEED;
  }
}

/** 시술 1개의 레슨. 없으면 null. */
export async function getLesson(procedureId: string): Promise<LessonContent | null> {
  const all = await loadAll();
  return all[procedureId] ?? null;
}

/** 레슨이 준비된 시술 id 목록(진입점 노출용). */
export async function getLessonIds(): Promise<string[]> {
  const all = await loadAll();
  return Object.keys(all);
}
