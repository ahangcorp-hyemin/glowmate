import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TabBar from "@/components/TabBar";
import { getHospitalsInDistrict } from "@/lib/hospitals/repo";

// 지역 허브 페이지 — "강남구 피부과·성형외과" 류 지역 검색을 받는 프로그래매틱 SEO 중간층.
// 낱장(병원 상세) 2,791개를 구 단위로 묶어 크롤 그래프·색인을 돕는다.

export const revalidate = 86400;

type Params = { params: Promise<{ district: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { district } = await params;
  const d = decodeURIComponent(district);
  return {
    title: `${d} 피부과·성형외과 목록 — 전문의 병원 정보·전화·위치 | 글로우메이트`,
    description: `${d}의 피부과·성형외과 전문의 병원을 광고 순위 없이 정리했어요. 개원연차·의사수·전화·위치, 건강보험심사평가원 공개데이터 기반.`,
  };
}

export default async function AreaPage({ params }: Params) {
  const { district } = await params;
  const d = decodeURIComponent(district);
  const hospitals = await getHospitalsInDistrict(d);
  if (!hospitals.length) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${d} 피부과·성형외과`,
    numberOfItems: hospitals.length,
    itemListElement: hospitals.slice(0, 30).map((h, i) => ({
      "@type": "ListItem", position: i + 1, name: h.name,
      url: `https://glowmate-dun.vercel.app/hospital/${h.id}`,
    })),
  };

  return (
    <main className="shell" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="top">
        <Link href="/hospitals" className="reset"><span style={{ fontSize: 20, color: "var(--ink2)" }}>‹</span></Link>
        <div className="loc">📍 {d}</div>
      </div>
      <div className="pad" style={{ flex: 1 }}>
        <h1 className="h2" style={{ fontSize: 21, margin: "4px 0 6px" }}>{d} 피부과·성형외과 {hospitals.length}곳</h1>
        <p className="sub" style={{ marginBottom: 14, lineHeight: 1.55 }}>
          광고 순위 없이 이름순이에요. 병원 이름에 진료과목을 쓸 수 있는 곳은 <b>전문의</b>뿐이라, 전문의 병원 위주로 모았어요.
        </p>
        {hospitals.map((h) => (
          <Link key={h.id} href={`/hospital/${h.id}`} className="reset">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 2px", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{h.name}</div>
                <div className="sub" style={{ marginTop: 3 }}>
                  {h.clNm ?? "의원"}{h.doctorCount ? ` · 의사 ${h.doctorCount}명` : ""}{h.estbDd ? ` · ${new Date(h.estbDd).getFullYear()}년 개원` : ""}
                </div>
              </div>
              <span style={{ color: "var(--coral)", fontWeight: 900 }}>›</span>
            </div>
          </Link>
        ))}
        <p className="disc" style={{ margin: "14px 0 20px", lineHeight: 1.6 }}>
          출처: 건강보험심사평가원 공개데이터. 실제 진료 여부·비용은 병원에 확인하세요.
        </p>
      </div>
      <TabBar />
    </main>
  );
}
