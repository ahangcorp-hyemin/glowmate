import Link from "next/link";
import TabBar from "@/components/TabBar";
import Icon from "@/components/Icon";
import { getLessonIds } from "@/lib/lessons/repo";
import { getCatalog } from "@/lib/catalog/repo";

// 알아보기(콘텐츠 필러) 인덱스 — SEO 유입 + '알고 가는' 레슨 허브.
// P0-2(Q&A)·P0-3(비교 결정기)가 여기에 붙는다.

export const metadata = {
  title: "시술 알아보기 — 병원 가기 전 5분 정리 | 글로우메이트",
  description: "울쎄라·써마지·리프팅, 받기 전에 알아야 할 것들. 깊이·효과·가격·후기 보는 법까지 출처와 함께 정리했어요.",
};

export default async function LearnIndex() {
  const [ids, catalog] = await Promise.all([getLessonIds(), getCatalog()]);
  const lessons = ids.map((id) => catalog.proceduresById[id]).filter(Boolean);

  return (
    <main className="shell" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <div className="top">
        <div className="logo">알아<span className="m">보기</span></div>
      </div>
      <div className="pad" style={{ flex: 1 }}>
        <p className="sub" style={{ margin: "2px 0 16px", lineHeight: 1.55 }}>
          병원 가기 전 5분. 뭘 물어보고 뭘 조심할지, 출처와 함께 정리했어요.
        </p>

        <div className="kick" style={{ marginBottom: 10 }}>시술 레슨</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lessons.map((p) => (
            <Link key={p.id} href={`/learn/${p.id}`} className="reset">
              <div className="card" style={{ display: "flex", alignItems: "center", gap: 13, padding: 16 }}>
                <span style={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: 14, background: "var(--key-soft)", color: "var(--key-deep)", flexShrink: 0 }}>
                  <Icon name="book" size={21} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>{p.nameKo}, 알고 가기</div>
                  <div className="sub" style={{ marginTop: 3, fontSize: 13.5 }}>{p.tagline}</div>
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: "var(--key-strong)" }}>5분 레슨</div>
                </div>
                <span style={{ color: "var(--faint)", fontWeight: 700, fontSize: 18 }}>›</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="kick" style={{ margin: "20px 0 10px" }}>자주 묻는 질문</div>
        <div className="chipwrap">
          {Object.values(catalog.proceduresById).map((p) => (
            <Link key={p.id} href={`/learn/qa/${p.id}`} className="reset">
              <span className="chip">{p.nameKo} Q&A</span>
            </Link>
          ))}
        </div>

        <div className="kick" style={{ margin: "20px 0 10px" }}>곧 열려요</div>
        <div className="card" style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 16, opacity: 0.65 }}>
          <span style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 12, background: "var(--chip)", color: "var(--ink2)", flexShrink: 0 }}>
            <Icon name="sparkle" size={19} />
          </span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>울쎄라 vs 써마지, 나는 뭐가 맞을까? <span className="badge">준비중</span></div>
            <div className="sub" style={{ marginTop: 4 }}>2~3개 문답으로 조건별 비교</div>
          </div>
        </div>

        <Link href="/estimate" className="reset">
          <button className="btn" style={{ marginTop: 20 }}>내 고민으로 견적 받아보기 →</button>
        </Link>
        <div style={{ height: 20 }} />
      </div>
      <TabBar />
    </main>
  );
}
