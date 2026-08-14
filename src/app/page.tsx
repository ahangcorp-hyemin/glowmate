import Link from "next/link";
import GlowHero from "@/components/GlowHero";

// 유입 순간의 후킹 랜딩. 애니메이션으로 '고민→근거로 정리'를 즉시 보여주고,
// 여신티켓·바비톡과의 차별점(근거·내 편·4050)을 앞세운다.

const DIFF = [
  {
    icon: "🔎",
    t: "왜 이 시술인지 근거까지",
    d: "광고가 아니라 시술 기전·출처를 함께. 예뻐진다는 말 대신 ‘왜’를 설명해요.",
  },
  {
    icon: "🤝",
    t: "병원 편이 아니라 내 편",
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
        <div className="loc">📍 강남 · 분당</div>
      </div>

      {/* 후킹 히어로 */}
      <div className="hero" style={{ paddingBottom: 8 }}>
        <div className="kick">AI 시술 견적 · 4050 맞춤</div>
        <h1>‘뭘 받아야 하지…’<br />여기서 멈춰 있다면.</h1>
        <p>고민만 말하면 시술 조합·예상 비용·근거까지 <b>1분 만에</b> 정리해드려요.</p>
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
      </div>

      <p className="disc pad" style={{ marginTop: 20, paddingBottom: 28 }}>
        글로우메이트는 공개 정보를 모아 제공하는 정보·비교 서비스로 의료 진단·효능을 보증하지 않아요.
        실제 시술 가능 여부·비용은 병원 상담에서 확인하세요.
      </p>
    </main>
  );
}
