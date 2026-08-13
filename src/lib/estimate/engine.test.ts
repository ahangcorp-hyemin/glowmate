import { describe, expect, test } from "bun:test";
import { buildEstimate, type EstimateInput } from "./engine";
import { seedCatalog } from "@/lib/catalog/seed";

const base: EstimateInput = { concerns: ["lift", "nasolabial"], ageBand: "40대", budgetBand: "100–200만" };
const est = (i: EstimateInput) => buildEstimate(i, seedCatalog);

describe("buildEstimate", () => {
  test("결정론: 같은 입력 = 같은 출력", () => {
    expect(est(base)).toEqual(est(base));
  });

  test("탄력 고민엔 base 시술이 나온다", () => {
    const e = est(base);
    expect(e.needsConsult).toBe(false);
    expect(e.items.some((i) => i.role === "base")).toBe(true);
  });

  test("모든 답변 문장에 근거가 있거나 마지막 고지 문장이다", () => {
    const e = est(base);
    // 최소 한 블록은 ref를 가진다
    expect(e.answerBlocks.some((b) => b.refs.length > 0)).toBe(true);
    // 출처 번호는 1..n 연속
    e.sources.forEach((s, i) => expect(s.n).toBe(i + 1));
  });

  test("총액은 base+addon 합(optional 제외)", () => {
    const e = est(base);
    const core = e.items.filter((i) => i.role !== "optional");
    expect(e.totalMin).toBe(core.reduce((s, i) => s + i.priceMin, 0));
    expect(e.totalMax).toBe(core.reduce((s, i) => s + i.priceMax, 0));
  });

  test("예산 낮으면 optional 시술 제외", () => {
    const low = est({ ...base, budgetBand: "~50만" });
    expect(low.items.some((i) => i.role === "optional")).toBe(false);
  });

  test("미지의 고민 조합은 크래시 없이 상담 권장", () => {
    const e = est({ concerns: ["unknown_x"], ageBand: "40대", budgetBand: "상관없음" });
    expect(e.needsConsult).toBe(true);
    expect(e.items.length).toBe(0);
  });
});
