import Link from "next/link";
import GlowHero from "@/components/GlowHero";
import TabBar from "@/components/TabBar";

// 유입 순간의 후킹 랜딩. 4050 실어휘(리서치 §1: "확 늙었다"·"티 안 나게"·"상술") 기반 카피 —
// 회피 어휘("동안 되세요"·비포애프터 극대화·특가)는 쓰지 않는다. §56 금지표현 아님 확인됨.

const DIFF = [
  {
    icon: "🔎",
    t: "왜 이 시술인지 근거까지",
    d: "광고가 아니라 시술 기전·출처를 함께. 예뻐진다는 말 대신 ‘왜’를 설명해요.",
  },
  {
    icon: "🤝",
    t: "상술 걱정 없이, 내 편",
    d: "예약·시술 건당 수수료를 받지 않아요. 그래서 특정 병원을 밀어붙이지 않아요.",
  },
  {
    icon: "🎯",
    t: "40·50대에 맞춰",
    d: "또래가 가장 많이 고민하는 처짐·볼륨·탄력 기준으로 조합을 짜드려요.",
  },
];

export default function Home() {
  return (
    <main className="shell">
      <div className="top">
        <div className="logo">글로우<span className="m">메이트</span></div>
        <div className="loc">📍 내 주변 병원</div>
      </div>

      {/* 후킹 히어로 — 4050 실어휘 */}
      <div className="hero" style={{ paddingBottom: 8 }}>
        <div className="kick">병원 가기 전, 알고 가는 시술 정보 · 4050</div>
        <h1>거울 보다<br />‘확 늙었다’ 싶은 날.</h1>
        <p><b>티 안 나게, 자연스럽게.</b> 상술 걱정 없이 시술 조합·비용·근거를 정리해드려요.</p>
        <GlowHero />
      </div>

      {/* 차별점 */}
      <div className="pad">
        <div className="kick" style={{ marginBottom: 10 }}>여신티켓·바비톡과 뭐가 다른가요?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {DIFF.map((x) => (
            <div key={x.t} className="card" style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: 15 }}>
              <span style={{ fontSize: 24, lineHeight: 1.1 }}>{x.icon}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15.5 }}>{x.t}</div>
                <div className="sub" style={{ marginTop: 4, lineHeight: 1.55 }}>{x.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 흐름 */}
      <div className="steps" style={{ marginTop: 18 }}>
        <div className="step"><div className="n">STEP 1</div><div className="l">고민 입력</div></div>
        <div className="step"><div className="n">STEP 2</div><div className="l">자동 견적</div></div>
        <div className="step"><div className="n">STEP 3</div><div className="l">병원 비교</div></div>
      </div>

      {/* 사회적 증거 + CTA */}
      <div className="pad" style={{ marginTop: 18 }}>
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--ink2)", fontWeight: 600, marginBottom: 10 }}>
          공개된 병원·비급여 정보만 모아 <b style={{ color: "var(--coral)" }}>출처와 함께</b> 정리해요
        </div>
        <Link href="/estimate" className="reset">
          <button className="btn">1분, 무료로 내 시술 견적 받기 →</button>
        </Link>
        <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--muted)", marginTop: 9, fontWeight: 600 }}>
          가입 없이 바로 · 개인 연락처 입력 안 해도 돼요
        </p>
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--ink2)", marginTop: 14, fontWeight: 700 }}>
          관리는 사치가 아니라 안목이에요.
        </p>
      </div>

      <p className="disc pad" style={{ marginTop: 16, paddingBottom: 24 }}>
        글로우메이트는 공개 정보를 모아 제공하는 정보·비교 서비스로 의료 진단·효능을 보증하지 않아요.
        실제 시술 가능 여부·비용은 병원 상담에서 확인하세요.
      </p>
      <TabBar />
    </main>
  );
}
