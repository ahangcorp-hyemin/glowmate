import type { MetadataRoute } from "next";
import { getAllHospitalIds, getDistricts } from "@/lib/hospitals/repo";
import { getLessonIds } from "@/lib/lessons/repo";
import { getCatalog } from "@/lib/catalog/repo";

// 프로그래매틱 SEO sitemap — 병원 2,791 + 레슨 + 핵심 페이지 (집품 siteIndex 플레이북).
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://glowmate-dun.vercel.app";

export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [hospitalIds, lessonIds, districts, catalog] = await Promise.all([
    getAllHospitalIds(), getLessonIds(), getDistricts(), getCatalog(),
  ]);
  const now = new Date();
  return [
    { url: BASE, lastModified: now, priority: 1 },
    { url: `${BASE}/estimate`, lastModified: now, priority: 0.9 },
    { url: `${BASE}/learn`, lastModified: now, priority: 0.9 },
    { url: `${BASE}/hospitals`, lastModified: now, priority: 0.9 },
    { url: `${BASE}/partners`, lastModified: now, priority: 0.4 },
    { url: `${BASE}/explore`, lastModified: now, priority: 0.5 },
    ...lessonIds.map((id) => ({ url: `${BASE}/learn/${id}`, lastModified: now, priority: 0.8 })),
    ...Object.keys(catalog.proceduresById).map((id) => ({ url: `${BASE}/learn/qa/${id}`, lastModified: now, priority: 0.8 })),
    ...districts.map((d) => ({ url: `${BASE}/area/${encodeURIComponent(d.district)}`, lastModified: now, priority: 0.7 })),
    ...hospitalIds.map((id) => ({ url: `${BASE}/hospital/${id}`, lastModified: now, priority: 0.6 })),
  ];
}
