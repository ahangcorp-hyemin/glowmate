import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TabBar from "@/components/TabBar";
import { getHospitalById, getNearbyHospitals } from "@/lib/hospitals/repo";
import { getLessonIds } from "@/lib/lessons/repo";
import { getCatalog } from "@/lib/catalog/repo";

// 병원 상세 공개 페이지 — 프로그래매틱 SEO의 단위 자산(모두닥·집품 플레이북).
// 공공데이터만, 출처 명시. 근처 병원·레슨 내부링크로 크롤 그래프 구성.

export const revalidate = 86400;

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const h = await getHospitalById(id);
  if (!h) return { title: "병원 정보 | 글로우메이트" };
  const year = h.estbDd ? new Date(h.estbDd).getFullYear() : null;
  return {
    title: `${h.name} — ${h.district || ""} ${h.clNm ?? "의원"} 정보·전화·위치 | 글로우메이트`,
    description: `${h.name} 정보: ${h.address ?? ""}${year ? ` · ${year}년 개원` : ""}${h.doctorCount ? ` · 의사 ${h.doctorCount}명` : ""} · 전화·위치·지도. 건강보험심사평가원 공개데이터 기반, 과장 없이 사실만.`,
  };
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "9px 0", borderBottom: "1px solid var(--line)" }}>
      <span className="sub" style={{ flexShrink: 0 }}>{k}</span>
      <span style={{ fontWeight: 700, fontSize: 14, textAlign: "right" }}>{v}</span>
    </div>
  );
}

export default async function HospitalPage({ params }: Params) {
  const { id } = await params;
  const h = await getHospitalById(id);
  if (!h) notFound();

  const [nearby, lessonIds, catalog] = await Promise.all([
    getNearbyHospitals(h.lat, h.lng, "ulthera", 5, 7),
    getLessonIds(),
    getCatalog(),
  ]);
  const others = nearby.filter((n) => n.id !== h.id).slice(0, 5);
  const lessons = lessonIds.map((lid) => catalog.proceduresById[lid]).filter(Boolean);

  const estbYear = h.estbDd ? new Date(h.estbDd).getFullYear() : null;
  const years = estbYear ? new Date().getFullYear() - estbYear : null;
  const tel = h.phone ? `tel:${h.phone.replace(/[^0-9]/g, "")}` : null;
  const q = encodeURIComponent(h.address || `${h.name} ${h.district}`);
  const mapEmbed = `https://maps.google.com/maps?q=${q}&z=16&hl=ko&output=embed`;
  const kakaoMap = `https://map.kakao.com/?q=${encodeURIComponent(`${h.name} ${h.district}`)}`;
  const home = h.homepageUrl ? (/^https?:\/\//.test(h.homepageUrl) ? h.homepageUrl : `http://${h.homepageUrl}`) : null;

  const badges: string[] = [];
  if (years != null) badges.push(`🗓 개원 ${years}년차`);
  if (h.doctorCount != null) badges.push(`👩‍⚕️ 의사 ${h.doctorCount}명`);
  if (h.clNm) badges.push(`🏥 ${h.clNm}`);
  badges.push("✓ 전문의 표방 의료기관");

  return (
    <main className="shell" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <div className="top">
        <Link href="/hospitals" className="reset"><span style={{ fontSize: 20, color: "var(--ink2)" }}>‹</span></Link>
        <div className="loc">📍 {h.district || "병원 정보"}</div>
      </div>

      <div className="pad" style={{ flex: 1 }}>
        <h1 className="h2" style={{ fontSize: 24, lineHeight: 1.28, margin: 0 }}>{h.name}</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, margin: "10px 0 14px" }}>
          {badges.map((b) => (
            <span key={b} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)", background: "var(--chip)", padding: "6px 10px", borderRadius: 999 }}>{b}</span>
          ))}
        </div>

        <div className="estcard">
          <Info k="종별" v={h.clNm ?? "의원"} />
          <Info k="주소" v={h.address ?? "-"} />
          <Info k="전화" v={h.phone ?? "-"} />
          {estbYear && <Info k="개원" v={`${estbYear}년${years != null ? ` (${years}년차)` : ""}`} />}
          {h.doctorCount != null && <Info k="의사 수" v={`${h.doctorCount}명`} />}
        </div>

        <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)", marginTop: 12 }}>
          <iframe title={`${h.name} 지도`} src={mapEmbed} style={{ width: "100%", height: 220, border: 0, display: "block" }} loading="lazy" />
        </div>
        <a href={kakaoMap} target="_blank" rel="noopener noreferrer" className="reset">
          <button className="btn ghost" style={{ marginTop: 10 }}>카카오맵에서 열기 →</button>
        </a>

        {/* 우리 wedge: 병원 가기 전 알고 가기 */}
        <div className="kick" style={{ margin: "20px 0 10px" }}>이 병원 가기 전, 알고 가세요</div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {lessons.map((p) => (
            <Link key={p.id} href={`/learn/${p.id}`} className="reset" style={{ flexShrink: 0 }}>
              <div className="card" style={{ padding: "12px 14px", minWidth: 150 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{p.nameKo}</div>
                <div className="disc" style={{ marginTop: 3 }}>5분 레슨 →</div>
              </div>
            </Link>
          ))}
        </div>
        <Link href="/estimate" className="reset">
          <button className="btn ghost" style={{ marginTop: 10 }}>내 고민으로 시술 조합 받아보기 →</button>
        </Link>

        {others.length > 0 && (
          <>
            <div className="kick" style={{ margin: "20px 0 6px" }}>근처 다른 병원</div>
            {others.map((n) => (
              <Link key={n.id} href={`/hospital/${n.id}`} className="reset">
                <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 2px", borderBottom: "1px solid var(--line)" }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{n.name}</span>
                  <span className="sub">{n.distanceKm.toFixed(1)}km ›</span>
                </div>
              </Link>
            ))}
          </>
        )}

        <div className="srcbox" style={{ marginTop: 14 }}>
          <div className="si"><span className="num">출처</span> 건강보험심사평가원 공개데이터(병원정보서비스). 평점·후기 조작 없이 공공 정보만 보여드려요.</div>
        </div>
        <p className="disc" style={{ marginTop: 10, paddingBottom: 12, lineHeight: 1.6 }}>
          실제 진료 가능 여부·비용은 병원 상담에서 확인하세요. 전화·지도 연결에 예약·건당 수수료를 받지 않아요(의료법 §27).
        </p>
      </div>

      <div className="cta" style={{ display: "flex", gap: 8 }}>
        {tel && <a href={tel} className="reset" style={{ flex: 1 }}><button className="btn" style={{ width: "100%" }}>📞 전화 문의</button></a>}
        <a href={kakaoMap} target="_blank" rel="noopener noreferrer" className="reset" style={{ flex: 1 }}><button className="btn ghost" style={{ width: "100%" }}>🗺 길찾기</button></a>
        {home && <a href={home} target="_blank" rel="noopener noreferrer" className="reset" style={{ flex: 1 }}><button className="btn ghost" style={{ width: "100%" }}>🌐 홈페이지</button></a>}
      </div>
      <TabBar />
    </main>
  );
}
