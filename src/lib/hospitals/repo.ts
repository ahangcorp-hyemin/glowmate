import "server-only";
import { getServerClient } from "@/lib/supabase/server";
import type { NearbyHospital } from "@/lib/hospitals/types";

// 위치기반 근처 병원(실데이터). DB RPC nearby_hospitals 호출.
// DB 미설정/미인제스트면 빈 배열 — 가짜 대신 정직한 빈 상태(UI가 안내).

interface Row {
  id: string; name: string; district: string | null; address: string | null;
  phone: string | null; homepage_url: string | null; cl_nm: string | null;
  doctor_count: number | null; estb_dd: string | null; lat: number; lng: number;
  rating: number | null; review_count: number | null;
  distance_km: number; price: number | null; is_ad: boolean; is_partner?: boolean | null;
}

/** 병원 1곳 상세(공개 페이지용). 없으면 null. */
export async function getHospitalById(id: string): Promise<NearbyHospital | null> {
  const db = getServerClient();
  if (!db) return null;
  try {
    const { data, error } = await db.from("hospitals")
      .select("id,name,district,address,phone,homepage_url,cl_nm,doctor_count,estb_dd,lat,lng,rating,review_count,region,emdong,status,is_partner")
      .eq("id", id).single();
    if (error || !data || data.status !== "active") return null;
    const r = data as unknown as Row & { region: string | null; emdong: string | null; status: string };
    return {
      id: r.id, name: r.name, district: r.district ?? "", address: r.address,
      phone: r.phone, homepageUrl: r.homepage_url, clNm: r.cl_nm,
      doctorCount: r.doctor_count, estbDd: r.estb_dd, lat: r.lat, lng: r.lng,
      rating: r.rating, reviews: r.review_count ?? 0, distanceKm: 0, price: null, isAd: false,
      isPartner: Boolean(r.is_partner),
    };
  } catch {
    return null;
  }
}

/** 전체 활성 병원 id 목록(sitemap용). PostgREST 1,000행 캡 때문에 range 페이지네이션. */
export async function getAllHospitalIds(): Promise<string[]> {
  const db = getServerClient();
  if (!db) return [];
  const ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("hospitals").select("id")
      .eq("status", "active").eq("is_aesthetic", true).range(from, from + 999);
    if (error || !data?.length) break;
    ids.push(...(data as { id: string }[]).map((r) => r.id));
    if (data.length < 1000) break;
  }
  return ids;
}

/** 병원 이름 검색(전국, 이름순). 검색바용. */
export async function searchHospitals(q: string, limit = 30): Promise<NearbyHospital[]> {
  const db = getServerClient();
  const query = q.trim();
  if (!db || query.length < 2) return [];
  const { data, error } = await db.from("hospitals")
    .select("id,name,district,address,phone,homepage_url,cl_nm,doctor_count,estb_dd,lat,lng,rating,review_count,is_partner")
    .eq("status", "active").eq("is_aesthetic", true)
    .ilike("name", `%${query}%`)
    .order("name").limit(limit);
  if (error || !data) return [];
  return (data as Row[]).map((r) => ({
    id: r.id, name: r.name, district: r.district ?? "", address: r.address,
    phone: r.phone, homepageUrl: r.homepage_url, clNm: r.cl_nm,
    doctorCount: r.doctor_count, estbDd: r.estb_dd, lat: r.lat, lng: r.lng,
    rating: r.rating, reviews: r.review_count ?? 0, distanceKm: 0, price: null, isAd: false,
    isPartner: Boolean(r.is_partner),
  }));
}

/** id 목록으로 병원 조회(찜 목록용). 입력 순서 유지. */
export async function getHospitalsByIds(ids: string[]): Promise<NearbyHospital[]> {
  const db = getServerClient();
  if (!db || !ids.length) return [];
  const { data, error } = await db.from("hospitals")
    .select("id,name,district,address,phone,homepage_url,cl_nm,doctor_count,estb_dd,lat,lng,rating,review_count,is_partner")
    .eq("status", "active").in("id", ids.slice(0, 50));
  if (error || !data) return [];
  const byId = new Map((data as Row[]).map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean).map((r) => ({
    id: r!.id, name: r!.name, district: r!.district ?? "", address: r!.address,
    phone: r!.phone, homepageUrl: r!.homepage_url, clNm: r!.cl_nm,
    doctorCount: r!.doctor_count, estbDd: r!.estb_dd, lat: r!.lat, lng: r!.lng,
    rating: r!.rating, reviews: r!.review_count ?? 0, distanceKm: 0, price: null, isAd: false,
    isPartner: Boolean(r!.is_partner),
  }));
}

/** 구 단위 허브: 활성 병원이 있는 district 목록(+count). 지역 SEO 허브 페이지용. */
export async function getDistricts(): Promise<{ district: string; region: string; count: number }[]> {
  const db = getServerClient();
  if (!db) return [];
  const counts = new Map<string, { region: string; count: number }>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("hospitals").select("district,region")
      .eq("status", "active").eq("is_aesthetic", true).not("district", "is", null)
      .range(from, from + 999);
    if (error || !data?.length) break;
    for (const r of data as { district: string; region: string | null }[]) {
      const cur = counts.get(r.district) ?? { region: r.region ?? "", count: 0 };
      cur.count += 1;
      counts.set(r.district, cur);
    }
    if (data.length < 1000) break;
  }
  return [...counts.entries()].map(([district, v]) => ({ district, ...v }))
    .sort((a, b) => b.count - a.count);
}

/** 특정 구의 병원 목록(이름순). 허브 페이지용. */
export async function getHospitalsInDistrict(district: string): Promise<NearbyHospital[]> {
  const db = getServerClient();
  if (!db) return [];
  const { data, error } = await db.from("hospitals")
    .select("id,name,district,address,phone,homepage_url,cl_nm,doctor_count,estb_dd,lat,lng,rating,review_count,is_partner")
    .eq("status", "active").eq("is_aesthetic", true).eq("district", district)
    .order("name").limit(500);
  if (error || !data) return [];
  return (data as Row[]).map((r) => ({
    id: r.id, name: r.name, district: r.district ?? "", address: r.address,
    phone: r.phone, homepageUrl: r.homepage_url, clNm: r.cl_nm,
    doctorCount: r.doctor_count, estbDd: r.estb_dd, lat: r.lat, lng: r.lng,
    rating: r.rating, reviews: r.review_count ?? 0, distanceKm: 0, price: null, isAd: false,
    isPartner: Boolean(r.is_partner),
  }));
}

export async function getNearbyHospitals(
  lat: number, lng: number, procedureId: string, radiusKm = 10, limit = 20
): Promise<NearbyHospital[]> {
  const db = getServerClient();
  if (!db) return [];
  try {
    const { data, error } = await db.rpc("nearby_hospitals", {
      p_lat: lat, p_lng: lng, p_proc: procedureId, p_radius_km: radiusKm, p_limit: limit,
    });
    if (error) throw error;
    return (data as Row[]).map((r) => ({
      id: r.id, name: r.name, district: r.district ?? "", address: r.address,
      phone: r.phone, homepageUrl: r.homepage_url, clNm: r.cl_nm,
      doctorCount: r.doctor_count, estbDd: r.estb_dd, lat: r.lat, lng: r.lng,
      rating: r.rating, reviews: r.review_count ?? 0,
      distanceKm: r.distance_km, price: r.price, isAd: r.is_ad,
      isPartner: Boolean(r.is_partner),
    }));
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn(`[hospitals/repo] nearby 실패: ${(e as Error).message}`);
    return [];
  }
}
