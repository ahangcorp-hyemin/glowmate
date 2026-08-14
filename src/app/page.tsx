"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import TabBar from "@/components/TabBar";
import Icon from "@/components/Icon";
import Logo from "@/components/Logo";
import { track } from "@/lib/analytics";

// 홈 = 전환 퍼널(이슈 #67, 모두닥 이식 — docs/MODOODOC_UX_CAPTURE.md).
// 구조: 컴팩트 히어로(첫 뷰포트에 CTA) → 신뢰 수치 → 액션 섹션 3종 → 고정 하단 CTA(상시).
// 카피는 docs/UX_WRITING.md 8원칙. §56 금지표현 준수(check-s56).

const PRESET_QUESTIONS = [
  { q: "울쎄라, 얼마가 적정인가요?", href: "/learn/qa/ulthera" },
  { q: "리프팅, 뭐부터 알아봐야 하나요?", href: "/learn" },
  { q: "병원 가서 뭘 물어봐야 하나요?", href: "/learn" },
];

export default function Home() {
  const router = useRouter();
  const goEstimate = (position: "hero" | "sticky" | "section") => {
    track("cta_estimate_click", { position });
    router.push("/estimate");
  };

  return (
    <main className="shell" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <div className="top">
        <Logo />
        <Link href="/hospitals" className="reset">
          <div className="loc" style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Icon name="pin" size={13} /> 내 주변 병원
          </div>
        </Link>
      </div>

      <div style={{ flex: 1 }}>
        {/* 컴팩트 히어로 — 첫 뷰포트 안에서 CTA까지 완결(#67 A1) */}
        <div className="hero" style={{ padding: "12px 22px 0" }}>
          <div className="kick">병원 가기 전, 알고 가는 시술 정보 · 4050</div>
          <h1 style={{ fontSize: 26 }}>거울 보다<br />‘확 늙었다’ 싶은 날.</h1>
          <p><b>티 안 나게, 자연스럽게.</b> 고민만 고르면 시술 조합·예상 비용·근거가 1분 안에 도착해요.</p>
          <button className="btn" style={{ marginTop: 16 }} onClick={() => goEstimate("hero")}>
            내 견적 1분 만에 받기
          </button>
          <p className="disc" style={{ textAlign: "center", marginTop: 8 }}>가입 없이 · 연락처 없이 · 무료</p>
        </div>

        {/* 신뢰 수치(#67 A3, 모두닥 문법: 구체 숫자) */}
        <div style={{ display: "flex", gap: 8, padding: "18px 22px 0" }}>
          {[["2,791곳", "전국 피부과·성형외과"], ["공공데이터", "심평원 공개 정보 기반"], ["0원", "예약·건당 수수료"]].map(([n, l]) => (
            <div key={l} className="card" style={{ flex: 1, padding: "13px 8px", textAlign: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em", color: "var(--key-deep)" }}>{n}</div>
              <div className="disc" style={{ marginTop: 3, fontSize: 10.5 }}>{l}</div>
            </div>
          ))}
        </div>
        {/* 정렬 투명성(#67 A4, UX_WRITING §4) */}
        <p className="sub" style={{ padding: "10px 22px 0", fontSize: 13, lineHeight: 1.6 }}>
          병원은 <b style={{ color: "var(--ink)" }}>가까운 순</b>으로만 보여드려요 — 광고 순위가 아니에요.
          그래서 특정 병원을 밀어붙일 이유가 없어요.
        </p>

        {/* 액션 섹션(#67 A5) — 모든 섹션에 다음 행동 */}
        <div className="pad" style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="kick">지금 바로 할 수 있는 것</div>

          {/* ① 후기 수집 — 핵심 앵글: 실제 낸 가격 */}
          <Link href="/explore/write" className="reset" onClick={() => track("review_start", { from: "home" })}>
            <div className="card" style={{ display: "flex", gap: 13, alignItems: "center", padding: 15 }}>
              <span style={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: 14, background: "var(--key-soft)", color: "var(--key-deep)", flexShrink: 0 }}>
                <Icon name="won" size={21} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 15.5 }}>받아보신 시술이 있나요?</div>
                <div className="sub" style={{ marginTop: 3, fontSize: 13.5, lineHeight: 1.5 }}>
                  <b style={{ color: "var(--ink2)" }}>실제로 낸 가격</b>이 같은 고민을 하는 또래에게 가장 큰 도움이 돼요.
                </div>
              </div>
              <span style={{ color: "var(--faint)", fontSize: 18, fontWeight: 700 }}>›</span>
            </div>
          </Link>

          {/* ② 방문예약 유도 */}
          <Link href="/hospitals" className="reset" onClick={() => track("visit_start", { from: "home" })}>
            <div className="card" style={{ display: "flex", gap: 13, alignItems: "center", padding: 15 }}>
              <span style={{ display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: 14, background: "var(--key-soft)", color: "var(--key-deep)", flexShrink: 0 }}>
                <Icon name="calendar" size={21} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 15.5 }}>전화 없이 방문 예약</div>
                <div className="sub" style={{ marginTop: 3, fontSize: 13.5, lineHeight: 1.5 }}>
                  날짜·시간만 고르면 저희가 전달해드려요. 미입점 병원은 확인 후 연락드려요.
                </div>
              </div>
              <span style={{ color: "var(--faint)", fontSize: 18, fontWeight: 700 }}>›</span>
            </div>
          </Link>

          {/* ③ 프리셋 질문(모두닥 문법: 첫 마디를 대신 써준다) */}
          <div className="kick" style={{ marginTop: 12 }}>뭐부터 물어볼지 모르겠다면</div>
          {PRESET_QUESTIONS.map((p) => (
            <Link key={p.q} href={p.href} className="reset" onClick={() => track("preset_question_click", { q: p.q })}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--chip)", borderRadius: 14, padding: "13px 16px" }}>
                <span style={{ fontWeight: 700, fontSize: 14.5, color: "var(--ink2)" }}>{p.q}</span>
                <span style={{ color: "var(--faint)", fontWeight: 700 }}>›</span>
              </div>
            </Link>
          ))}
        </div>

        <p className="disc pad" style={{ marginTop: 20, lineHeight: 1.6 }}>
          글로우메이트는 공개 정보를 모아 제공하는 정보·비교 서비스로 의료 진단·효능을 보증하지 않아요.
          실제 시술 가능 여부·비용은 병원 상담에서 확인하세요.
        </p>
        <p className="pad" style={{ paddingBottom: 8, marginTop: 8 }}>
          <Link href="/partners" className="reset"><span className="disc" style={{ textDecoration: "underline" }}>병원 파트너 안내 →</span></Link>
        </p>
      </div>

      {/* 고정 하단 CTA(#67 A2) — 전 스크롤 상시. 탭바도 sticky bottom:0이라 탭바 높이만큼 띄운다 */}
      <div className="cta" style={{ bottom: 62, paddingBottom: 10, zIndex: 19 }}>
        <button className="btn" onClick={() => goEstimate("sticky")}>내 견적 1분 만에 받기</button>
      </div>
      <TabBar />
    </main>
  );
}
