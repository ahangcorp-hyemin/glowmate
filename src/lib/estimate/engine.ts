// 룰베이스 자동견적 엔진 — 순수 함수, 결정론(같은 입력=같은 출력). RAG 아님.
// 카탈로그 + 룰로 조합·총액·출처답변을 조립. 답변은 §56 필터를 통과한다.

import { type Procedure, type Source } from "@/lib/catalog/procedures";
import { type Rule, type Concern } from "@/lib/catalog/rules";
import { assertCompliant } from "@/lib/compliance/bannedPhrases";

export const ENGINE_VERSION = "v1";

/** 엔진에 주입하는 카탈로그. 출처(정적 TS 시드 / DB)와 무관하게 같은 입력=같은 출력. */
export interface Catalog {
  proceduresById: Record<string, Procedure>;
  concernsById: Record<string, Concern>;
  rules: Rule[];
}

export type BudgetBand = "~50만" | "100–200만" | "상관없음";
export type AgeBand = "30대" | "40대" | "50대+";

export interface EstimateInput {
  concerns: string[];
  ageBand: AgeBand;
  budgetBand: BudgetBand;
  note?: string;
}

export interface EstimateItem {
  procedureId: string;
  nameKo: string;
  role: "base" | "addon" | "optional";
  priceMin: number;
  priceMax: number;
  priceUnit: string;
  sessions: string;
  rationale: string;
  contraindication: string; // 이런 분은 상담이 필요해요
  tagline: string; // 카드 소개(탐색 UI)
  mechanism: string; // 기전(왜 맞나요)
  sources: Source[]; // 출처(탐색 UI)
}

export interface AnswerBlock {
  text: string;
  refs: number[];
}

export interface SourceRef {
  n: number;
  label: string;
  url?: string;
}

export interface Estimate {
  items: EstimateItem[];
  totalMin: number | null;
  totalMax: number | null;
  answerBlocks: AnswerBlock[];
  sources: SourceRef[];
  needsConsult: boolean;
  engineVersion: string;
}

const ROLE_RANK: Record<EstimateItem["role"], number> = { base: 0, addon: 1, optional: 2 };

/** 받침에 맞는 '로/으로' 조사. 받침 없거나 ㄹ받침이면 '로', 그 외 '으로'. */
function ro(word: string): string {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return "로";
  const jong = (c - 0xac00) % 28;
  return jong === 0 || jong === 8 ? "로" : "으로";
}

/** 출처 번호를 발급/재사용하는 누적기(dedup). */
class SourceTable {
  private map = new Map<string, SourceRef>();
  ref(label: string, url?: string): number {
    const key = label;
    const found = this.map.get(key);
    if (found) return found.n;
    const n = this.map.size + 1;
    this.map.set(key, { n, label, url });
    return n;
  }
  list(): SourceRef[] {
    return [...this.map.values()].sort((a, b) => a.n - b.n);
  }
}

/** 결정론 견적. 매칭 룰이 없으면 needsConsult로 graceful 반환(크래시 금지). */
export function buildEstimate(input: EstimateInput, catalog: Catalog): Estimate {
  const { proceduresById: PROCEDURE_BY_ID, concernsById: CONCERN_BY_ID, rules: RULES } = catalog;
  const concerns = [...new Set(input.concerns)].filter((c) => CONCERN_BY_ID[c]);

  // 1) 룰 수집 → 시술별 집계(최대 weight, 최우선 role, 근거)
  type Agg = { role: EstimateItem["role"]; weight: number; rationale: string };
  const agg = new Map<string, Agg>();
  for (const r of RULES) {
    if (!concerns.includes(r.concernId)) continue;
    const cur = agg.get(r.procedureId);
    if (!cur || ROLE_RANK[r.role] < ROLE_RANK[cur.role] || (r.role === cur.role && r.weight > cur.weight)) {
      agg.set(r.procedureId, { role: r.role, weight: r.weight, rationale: r.rationale });
    }
  }

  // 2) 예산 필터(optional은 예산 낮으면 제외)
  const budgetLow = input.budgetBand === "~50만";

  // 3) 조합 구성: base 최대 2 + addon 1 + optional 1(예산 허용 시). 전부 base로 쏠리지 않게 슬롯 배분.
  const pool = [...agg.entries()]
    .map(([procedureId, a]) => ({ procedureId, ...a }))
    .sort((x, y) => y.weight - x.weight);
  const pick = (role: EstimateItem["role"], n: number) => pool.filter((r) => r.role === role).slice(0, n);
  const ranked = [
    ...pick("base", 2),
    ...pick("addon", 1),
    ...(budgetLow ? [] : pick("optional", 1)),
  ];

  if (ranked.length === 0) {
    return {
      items: [], totalMin: null, totalMax: null, needsConsult: true, engineVersion: ENGINE_VERSION,
      answerBlocks: [{ text: "입력한 고민으로는 추천 조합을 만들지 못했어요. 병원 상담에서 정확히 확인해 보세요.", refs: [] }],
      sources: [],
    };
  }

  const sources = new SourceTable();

  // 4) items + 총액(base+addon만, optional 제외)
  const items: EstimateItem[] = ranked.map((r) => {
    const p = PROCEDURE_BY_ID[r.procedureId] as Procedure;
    return {
      procedureId: p.id, nameKo: p.nameKo, role: r.role,
      priceMin: p.priceMin, priceMax: p.priceMax, priceUnit: p.priceUnit,
      sessions: p.sessions, rationale: r.rationale, contraindication: p.contraindication,
      tagline: p.tagline, mechanism: p.mechanism, sources: p.sources,
    };
  });
  const core = items.filter((i) => i.role !== "optional");
  const totalMin = core.reduce((s, i) => s + i.priceMin, 0);
  const totalMax = core.reduce((s, i) => s + i.priceMax, 0);

  // 5) 출처답변 조립(문장마다 ref 필수, 슬롯 치환 — 생성 아님)
  const base = items.find((i) => i.role === "base")!;
  const addon = items.find((i) => i.role === "addon");
  const optional = items.find((i) => i.role === "optional");
  const baseProc = PROCEDURE_BY_ID[base.procedureId] as Procedure;
  const concernNames = concerns.map((c) => CONCERN_BY_ID[c].nameKo).join("·");

  const blocks: AnswerBlock[] = [];

  const combineRef = sources.ref("병원 시술 조합 공시 데이터(글로우메이트 집계)");
  blocks.push({
    text: `${input.ageBand} ${concernNames} 고민엔 ${base.nameKo}${addon ? `${ro(base.nameKo)} 잡고 ${addon.nameKo}${ro(addon.nameKo)} 결을 올리는` : "를 베이스로 하는"} 조합이 일반적이에요. (${base.rationale}${addon ? `, ${addon.rationale}` : ""})`,
    refs: [combineRef],
  });

  const baseRefs = baseProc.sources.map((s) => sources.ref(s.label, s.url));
  blocks.push({
    text: `${base.nameKo}는 ${baseProc.mechanism} 허가받은 장비/제제예요.`,
    refs: baseRefs,
  });

  if (optional) {
    const optRef = sources.ref((PROCEDURE_BY_ID[optional.procedureId] as Procedure).sources[0].label);
    blocks.push({
      text: `${optional.rationale}이 필요하면 ${optional.nameKo}를 선택으로 더할 수 있어요.`,
      refs: [optRef],
    });
  }

  if (items.length >= 2) {
    const seqRef = sources.ref("시술 조합 순서·간격 · 피부과 임상 콘텐츠");
    blocks.push({ text: "여러 시술을 함께 받을 땐 보통 리프팅을 먼저, 재생·물광 주사는 1–2주 뒤에 나눠서 받아요.", refs: [seqRef] });
  }

  blocks.push({ text: "시술은 개인차가 크고 부작용 가능성이 있어요. 실제 적용·비용은 병원 상담에서 확인하세요.", refs: [] });

  // 6) §56 준수 강제(위반 시 throw)
  for (const b of blocks) assertCompliant(b.text, "estimate-answer");

  return {
    items, totalMin, totalMax, needsConsult: false, engineVersion: ENGINE_VERSION,
    answerBlocks: blocks, sources: sources.list(),
  };
}
