// 15001699(의료기관별상세정보) 준비 여부 점검. `bun run probe`
// 전파 완료 + 실제 데이터가 나오는지 한 번에 확인해, (a) 인제스트를 붙일 시점을 알려준다.

import { createClient } from "@supabase/supabase-js";

const KEY = process.env.DATA_GO_KR_SERVICE_KEY;
if (!KEY) { console.error("✗ DATA_GO_KR_SERVICE_KEY 필요"); process.exit(1); }
const sk = KEY.includes("%") ? KEY : encodeURIComponent(KEY);
const B = "https://apis.data.go.kr/B551182/MadmDtlInfoService2.7";
const OPS = ["getDgsbjtInfo2.7", "getMedOftInfo2.7", "getTrnsprtInfo2.7"];

async function pickYkihos(): Promise<{ name: string; ykiho: string }[]> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await db.from("hospitals").select("name,ykiho")
    .not("ykiho", "is", null).order("doctor_count", { ascending: false, nullsFirst: false }).limit(2);
  return (data as { name: string; ykiho: string }[]) ?? [];
}

async function main() {
  const targets = await pickYkihos();
  if (!targets.length) { console.error("병원 데이터가 없어요. 먼저 `bun run ingest`."); process.exit(1); }

  let registered = false, hasData = false;
  for (const t of targets) {
    console.log(`\n### ${t.name} ###`);
    for (const op of OPS) {
      const res = await fetch(`${B}/${op}?serviceKey=${sk}&ykiho=${encodeURIComponent(t.ykiho)}&pageNo=1&numOfRows=20`);
      const xml = await res.text();
      if (xml.includes("SERVICE_KEY_IS_NOT_REGISTERED")) { console.log(`  ${op}: ⚠ 키 전파 미완료`); continue; }
      registered = true;
      const items = [...xml.matchAll(/<item>/g)].length;
      if (items > 0) hasData = true;
      console.log(`  ${op}: items=${items}`);
    }
  }

  console.log("\n── 판정 ──");
  if (!registered) console.log("⏳ 아직 전파중 — 몇 시간~1일 뒤 다시 `bun run probe`");
  else if (!hasData) console.log("⚠ 전파는 됐으나 데이터 비어있음 — ykiho 불일치 or 의원 미노출. Naver/제휴로 방향 전환 검토.");
  else console.log("✅ 준비 완료 — (a) 상세 인제스트를 붙이면 됩니다. Claude에게 알려주세요.");
}

main().catch((e) => { console.error(e); process.exit(1); });
