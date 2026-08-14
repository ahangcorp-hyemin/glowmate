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
