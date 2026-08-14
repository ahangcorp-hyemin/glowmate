import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import TabBar from "@/components/TabBar";
import { getCatalog } from "@/lib/catalog/repo";
import type { Procedure } from "@/lib/catalog/procedures";

// Q&A(F6) — "해보신 분?" 롱테일 검색을 받는 시술별 FAQ. 커뮤니티질문 87건(리서치) 대응.
// 답은 전부 카탈로그(리서치·출처 검증분)에서 조립 — 생성 아님, 룰베이스.

export const revalidate = 86400;

type Params = { params: Promise<{ procedureId: string }> };

function buildQA(p: Procedure): { q: string; a: string }[] {
  const man = (n: number) => Math.round(n / 10000).toLocaleString();
  return [
    { q: `${p.nameKo}, 어떤 시술인가요?`, a: `${p.mechanism} ${p.effect}` },
    { q: `${p.nameKo} 부작용은 없나요?`, a: `${p.sideEffects} ${p.caution}` },
    { q: `${p.nameKo}, 저는 받아도 될까요?`, a: p.contraindication },
    { q: `${p.nameKo} 가격은 얼마인가요?`, a: `참고 가격대는 ${man(p.priceMin)}만~${man(p.priceMax)}만원(${p.priceUnit} 기준)이에요. 병원·구성에 따라 다르고, 정확한 비용은 상담에서 확인해야 해요. ${p.sessions}.` },
    { q: `${p.nameKo}에 대해 흔히 오해하는 것은?`, a: p.misconception },
    { q: `비슷한 시술과 뭐가 다른가요?`, a: p.vsNote },
  ];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { procedureId } = await params;
  const catalog = await getCatalog();
  const p = catalog.proceduresById[procedureId];
  if (!p) return { title: "시술 Q&A | 글로우메이트" };
  return {
    title: `${p.nameKo} 자주 묻는 질문 — 부작용·가격·오해까지 | 글로우메이트`,
    description: `${p.nameKo} 받기 전 꼭 확인할 질문들: 부작용, 가격대, 나는 받아도 되는지. 식약처·FDA·학회 출처 기반으로 과장 없이 답해요.`,
  };
}

export default async function QAPage({ params }: Params) {
  const { procedureId } = await params;
  const catalog = await getCatalog();
  const p = catalog.proceduresById[procedureId];
  if (!p) notFound();
  const qa = buildQA(p);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(({ q, a }) => ({
      "@type": "Question", name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <main className="shell" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="top">
        <Link href="/learn" className="reset"><span style={{ fontSize: 20, color: "var(--ink2)" }}>‹</span></Link>
        <div className="loc">Q&A</div>
      </div>
      <div className="pad" style={{ flex: 1 }}>
        <h1 className="h2" style={{ fontSize: 21, margin: "4px 0 6px" }}>{p.nameKo}, 자주 묻는 질문</h1>
        <p className="sub" style={{ marginBottom: 14, lineHeight: 1.55 }}>커뮤니티에서 가장 많이 나오는 질문들에 출처 있는 정보로 답해요.</p>

        {qa.map(({ q, a }) => (
          <div key={q} className="card" style={{ padding: 16, marginBottom: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 15.5, lineHeight: 1.4 }}>Q. {q}</div>
            <p className="sub" style={{ marginTop: 8, lineHeight: 1.65, color: "var(--ink2)" }}>{a}</p>
          </div>
        ))}

        <div className="srcbox" style={{ marginTop: 4 }}>
          <div className="sub" style={{ fontWeight: 800, marginBottom: 6 }}>🔖 출처</div>
          {p.sources.map((s, i) => <div className="si" key={i}><span className="num">[{i + 1}]</span> {s.label}</div>)}
        </div>

        <Link href={`/estimate`} className="reset">
          <button className="btn" style={{ marginTop: 14 }}>내 고민으로 견적 받아보기 →</button>
        </Link>
        <p className="disc" style={{ margin: "12px 0 20px", lineHeight: 1.6 }}>
          의료 진단이 아닌 정보 제공이며, 효과·부작용은 개인차가 커요. 실제 적용 여부는 병원 상담에서 확인하세요.
        </p>
      </div>
      <TabBar />
    </main>
  );
}
