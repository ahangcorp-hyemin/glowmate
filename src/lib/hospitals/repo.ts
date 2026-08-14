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
  distance_km: number; price: number | null; is_ad: boolean;
}

/** 병원 1곳 상세(공개 페이지용). 없으면 null. */
export async function getHospitalById(id: string): Promise<NearbyHospital | null> {
  const db = getServerClient();
  if (!db) return null;
  try {
    const { data, error } = await db.from("hospitals")
      .select("id,name,district,address,phone,homepage_url,cl_nm,doctor_count,estb_dd,lat,lng,rating,review_count,region,emdong,status")
      .eq("id", id).single();
    if (error || !data || data.status !== "active") return null;
    const r = data as unknown as Row & { region: string | null; emdong: string | null; status: string };
    return {
      id: r.id, name: r.name, district: r.district ?? "", address: r.address,
      phone: r.phone, homepageUrl: r.homepage_url, clNm: r.cl_nm,
      doctorCount: r.doctor_count, estbDd: r.estb_dd, lat: r.lat, lng: r.lng,
      rating: r.rating, reviews: r.review_count ?? 0, distanceKm: 0, price: null, isAd: false,
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
    }));
  } catch (e) {
    if (process.env.NODE_ENV !== "production") console.warn(`[hospitals/repo] nearby 실패: ${(e as Error).message}`);
    return [];
  }
}
