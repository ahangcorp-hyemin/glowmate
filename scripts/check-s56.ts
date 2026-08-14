// 레슨 카피 §56 자동 검열(리터러시 인용 body 제외). bun run scripts/check-s56.ts
import { LESSON_SEED } from "../src/lib/lessons/seed";
import { findBannedPhrases } from "../src/lib/compliance/bannedPhrases";
let bad = 0;
for (const l of Object.values(LESSON_SEED)) {
  const walk = (v: unknown, path: string, skipBody: boolean) => {
    if (typeof v === "string") { const h = findBannedPhrases(v); if (h.length) { bad++; console.log(`✗ ${path}: "${h[0].phrase}" in "${v.slice(0, 50)}"`); } }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, skipBody));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (skipBody && k === "body") continue; walk(x, `${path}.${k}`, skipBody || k === "samples"); }
  };
  walk(l.cards, l.procedureId, false);
}
console.log(bad ? `금지표현 ${bad}건 — 수정 필요` : "✓ §56 통과 (리터러시 인용 제외)");
if (bad) process.exit(1);
