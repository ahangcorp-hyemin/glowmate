// 공공데이터포털 HIRA API 클라이언트(서버/스크립트 전용). 크롤링 아님 — 공식 오픈API.
// 병원정보서비스(15001698) + 비급여진료비정보(15001700).
// HIRA는 XML 응답이 기본이라 경량 파서로 <item> 추출.
// ⚠️ 첫 실행 시 파라미터/필드명을 각 데이터셋 '활용가이드'와 대조해 미세조정하세요.

const KEY = process.env.DATA_GO_KR_SERVICE_KEY;
const HOSP_BASE = "https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList";
const NONPAY_ITEM = "https://apis.data.go.kr/B551182/nonPaymentDamtInfoService/getNonPaymentItemInfo";
const NONPAY_HOSP = "https://apis.data.go.kr/B551182/nonPaymentDamtInfoService/getNonPaymentItemHospList";

function assertKey(): string {
  if (!KEY) throw new Error("DATA_GO_KR_SERVICE_KEY 미설정 (.env.local)");
  return KEY;
}

/** 아주 단순한 XML <item> 리스트 파서(HIRA 응답은 평면 구조). */
function parseItems(xml: string): Record<string, string>[] {
  const items: Record<string, string>[] = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  for (const b of blocks) {
    const obj: Record<string, string> = {};
    for (const m of b.matchAll(/<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g)) {
      obj[m[1]] = m[2].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    }
    items.push(obj);
  }
  return items;
}

async function get(url: string, params: Record<string, string | number>): Promise<Record<string, string>[]> {
  const q = new URLSearchParams({ serviceKey: assertKey(), ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const res = await fetch(`${url}?${q.toString()}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`HIRA ${res.status}: ${text.slice(0, 200)}`);
  return parseItems(text);
}

export interface HiraHospital {
  ykiho: string; yadmNm: string; addr: string; telno: string;
  XPos: string; YPos: string; sgguCdNm: string;
}

/** 병원 목록(시도코드 기준, 페이지). */
export async function fetchHospitals(sidoCd: string, pageNo: number, numOfRows = 1000): Promise<HiraHospital[]> {
  const rows = await get(HOSP_BASE, { sidoCd, pageNo, numOfRows });
  return rows.map((r) => ({
    ykiho: r.ykiho ?? "", yadmNm: r.yadmNm ?? "", addr: r.addr ?? "", telno: r.telno ?? "",
    XPos: r.XPos ?? "", YPos: r.YPos ?? "", sgguCdNm: r.sgguCdNm ?? "",
  }));
}

export interface HiraNonPayItem { npayCd: string; itemNm: string }
/** 비급여 항목 목록(코드↔명칭). 매핑 구축용. */
export async function fetchNonPayItems(pageNo: number, numOfRows = 1000): Promise<HiraNonPayItem[]> {
  const rows = await get(NONPAY_ITEM, { pageNo, numOfRows });
  return rows.map((r) => ({ npayCd: r.npayCd ?? r.itemCd ?? "", itemNm: r.itemNm ?? r.npayKorNm ?? "" }));
}

export interface HiraNonPayPrice { ykiho: string; npayCd: string; minAmt: number; maxAmt: number }
/** 특정 비급여코드의 병원별 금액. */
export async function fetchNonPayHospList(npayCd: string, pageNo: number, numOfRows = 1000): Promise<HiraNonPayPrice[]> {
  const rows = await get(NONPAY_HOSP, { npayCd, pageNo, numOfRows });
  return rows.map((r) => ({
    ykiho: r.ykiho ?? "", npayCd,
    minAmt: Number(r.minStlmAmt ?? r.minAmt ?? r.curAmt ?? 0) || 0,
    maxAmt: Number(r.maxStlmAmt ?? r.maxAmt ?? r.curAmt ?? 0) || 0,
  }));
}
