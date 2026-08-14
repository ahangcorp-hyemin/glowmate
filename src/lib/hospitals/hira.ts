// 공공데이터포털 HIRA API 클라이언트(서버/스크립트 전용). 크롤링 아님 — 공식 오픈API.
// 병원정보서비스(15001698) + 비급여진료비정보(15001700).
// HIRA는 XML 응답이 기본이라 경량 파서로 <item> 추출.
// ⚠️ 첫 실행 시 파라미터/필드명을 각 데이터셋 '활용가이드'와 대조해 미세조정하세요.

const KEY = process.env.DATA_GO_KR_SERVICE_KEY;
const HOSP_BASE = "https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList";
const NONPAY_ITEM = "https://apis.data.go.kr/B551182/nonPaymentDamtInfoService/getNonPaymentItemInfo";
const NONPAY_HOSP = "https://apis.data.go.kr/B551182/nonPaymentDamtInfoService/getNonPaymentItemHospList";
// 의료기관별상세정보서비스 — 진료과목정보. 버전 접미사(2.7 등)는 활용가이드에서 확인해 맞추세요.
const DTL_DGSBJT = "https://apis.data.go.kr/B551182/MadmDtlInfoService2.7/getDgsbjtInfo2.7";

// 진료과목 코드(HIRA 표시과목): 피부과=14, 성형외과=08. 가이드에서 재확인 권장.
export const DEPT_DERMATOLOGY = "14";
export const DEPT_PLASTIC = "08";

function assertKey(): string {
  if (!KEY) throw new Error("DATA_GO_KR_SERVICE_KEY 미설정 (.env.local)");
  return KEY;
}

/** 아주 단순한 XML <item> 리스트 파서(HIRA 응답은 평면 구조). */
function parseItems(xml: string): Record<string, string>[] {
  const items: Record<string, string>[] = [];
  for (const block of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const obj: Record<string, string> = {};
    for (const m of block[1].matchAll(/<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g)) {
      obj[m[1]] = m[2].replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    }
    items.push(obj);
  }
  return items;
}

async function get(url: string, params: Record<string, string | number>): Promise<Record<string, string>[]> {
  const key = assertKey();
  // data.go.kr 키 두 형태 모두 지원: Encoding키(%포함)는 그대로, Decoding키(+/=)는 한 번만 인코딩.
  const serviceKey = key.includes("%") ? key : encodeURIComponent(key);
  const q = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])));
  const res = await fetch(`${url}?serviceKey=${serviceKey}&${q.toString()}`);
  const text = await res.text();
  if (!res.ok) throw new Error(`HIRA ${res.status}: ${text.slice(0, 200)}`);
  if (text.includes("SERVICE_KEY_IS_NOT_REGISTERED_ERROR")) {
    throw new Error("HIRA 서비스키 미등록: data.go.kr에서 승인 확인 + Encoding 인증키인지 확인(승인 직후 최대 1시간 지연 가능)");
  }
  return parseItems(text);
}

export interface HiraHospital {
  ykiho: string; yadmNm: string; addr: string; telno: string;
  XPos: string; YPos: string; sgguCdNm: string; clCd: string;
}

function mapHosp(r: Record<string, string>): HiraHospital {
  return {
    ykiho: r.ykiho ?? "", yadmNm: r.yadmNm ?? "", addr: r.addr ?? "", telno: r.telno ?? "",
    XPos: r.XPos ?? "", YPos: r.YPos ?? "", sgguCdNm: r.sgguCdNm ?? "", clCd: r.clCd ?? "",
  };
}

/** 병원 목록(좌표+반경 기준, 페이지). radius=미터. 지역 중심 근처만 조회해 볼륨 최소화. */
export async function fetchHospitalsNear(lng: number, lat: number, radiusM: number, pageNo: number, numOfRows = 1000): Promise<HiraHospital[]> {
  const rows = await get(HOSP_BASE, { xPos: lng, yPos: lat, radius: radiusM, pageNo, numOfRows });
  return rows.map(mapHosp);
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

/** 특정 병원(ykiho)의 진료과목 코드 목록. 피부과/성형외과 정확 판별용. */
export async function fetchDepartments(ykiho: string): Promise<string[]> {
  const rows = await get(DTL_DGSBJT, { ykiho, pageNo: 1, numOfRows: 100 });
  return rows.map((r) => r.dgsbjtCd ?? "").filter(Boolean);
}
