// 정적 TS 시드 → 엔진 Catalog. DB 미설정 시 폴백 + 테스트 fixture + DB 시드 소스 공용 단일화.
import { PROCEDURES, PROCEDURE_BY_ID } from "@/lib/catalog/procedures";
import { CONCERNS, CONCERN_BY_ID, RULES } from "@/lib/catalog/rules";
import type { Catalog } from "@/lib/estimate/engine";

export const seedCatalog: Catalog = {
  proceduresById: PROCEDURE_BY_ID,
  concernsById: CONCERN_BY_ID,
  rules: RULES,
};

export const seedProcedures = PROCEDURES;
export const seedConcerns = CONCERNS;
export const seedRules = RULES;
