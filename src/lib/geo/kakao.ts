import "server-only";

// Kakao Local: 좌표 → 행정구역명(라벨). 키 없으면 null(보조 기능이라 없어도 됨).
const KEY = process.env.KAKAO_REST_API_KEY;

export async function regionLabel(lat: number, lng: number): Promise<string | null> {
  if (!KEY) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KEY}` } });
    if (!res.ok) return null;
    const json = (await res.json()) as { documents?: Array<{ region_type: string; region_2depth_name: string; region_3depth_name: string }> };
    const doc = json.documents?.find((d) => d.region_type === "H") ?? json.documents?.[0];
    if (!doc) return null;
    return `${doc.region_2depth_name} ${doc.region_3depth_name}`.trim();
  } catch {
    return null;
  }
}
