"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import TabBar from "@/components/TabBar";
import Icon from "@/components/Icon";
import Logo from "@/components/Logo";
import { track } from "@/lib/analytics";

// 홈 = 전환 퍼널(이슈 #67 + docs/LANDING_UX.md). 모두닥 퍼널 + Toss/전환형 랜딩 문법.
// 스티키 CTA는 scroll-reveal(히어로 CTA가 화면 밖일 때만) — 중복 방지.
// 카피는 docs/UX_WRITING.md 8원칙. §56 준수(check-s56).

const PRESET_QUESTIONS = [
  { q: "울쎄라, 얼마가 적정인가요?", href: "/learn/qa/ulthera" },
  { q: "리프팅, 뭐부터 알아봐야 하나요?", href: "/learn" },
  { q: "병원 가서 뭘 물어봐야 하나요?", href: "/learn" },
];

export default function Home() {
  const router = useRouter();
  const heroBtnRef = useRef<HTMLButtonElement>(null);
  const [stickyOn, setStickyOn] = useState(false);

  // scroll-reveal: 히어로 CTA가 뷰포트를 벗어나면 스티키 등장(둘이 동시에 안 보이게).
  // IntersectionObserver는 일부 웹뷰에서 콜백이 안 떠서, scroll 리스너 + rect로 직접 판정.
  useEffect(() => {
    const compute = () => {
      const el = heroBtnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // 히어로 버튼 하단이 화면 위로 사라졌으면 스티키 노출
      setStickyOn(r.bottom < 8);
    };
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => { window.removeEventListener("scroll", compute); window.removeEventListener("resize", compute); };
  }, []);

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
        {/* 히어로 — 첫 뷰포트에서 CTA까지 완결(above-the-fold) */}
        <div className="hero" style={{ padding: "14px 22px 0" }}>
          <div className="kick">병원 가기 전, 알고 가는 시술 정보 · 4050</div>
          <h1 style={{ fontSize: 27 }}>거울 보다<br />‘확 늙었다’ 싶은 날.</h1>
          <p><b>티 안 나게, 자연스럽게.</b><br />고민만 고르면 시술 조합·예상 비용·근거가 1분 안에 도착해요.</p>
          <button ref={heroBtnRef} className="btn" style={{ marginTop: 18 }} onClick={() => goEstimate("hero")}>
            내 견적 1분 만에 받기
          </button>
          <p className="disc" style={{ textAlign: "center", marginTop: 8 }}>가입 없이 · 연락처 없이 · 무료</p>
        </div>

        {/* 페이오프 미리보기 — '이게 네가 받을 것'(Toss 큰 숫자 + 전환형 랜딩의 제품 노출) */}
        <div className="pad" style={{ marginTop: 22 }}>
          <div className="kick" style={{ marginBottom: 8 }}>이런 결과를 받아요</div>
          <div className="estcard" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 11, borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontWeight: 700, fontSize: 14.5 }}>울쎄라 <span className="badge" style={{ background: "var(--key-soft)", color: "var(--key-deep)" }}>베이스</span></span>
              <span className="price" style={{ fontSize: 15 }}>250–400만</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontWeight: 700, fontSize: 14.5 }}>리쥬란 <span className="badge">재생·결</span></span>
              <span className="price" style={{ fontSize: 15 }}>40–80만</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }}>
              <span className="sub" style={{ fontSize: 13 }}>예상 총 비용(병원별 상이)</span>
              <span className="price" style={{ fontSize: 24 }}>290–480만</span>
            </div>
            <p className="disc" style={{ marginTop: 10, lineHeight: 1.55 }}>
              예시예요. 고민을 고르면 나에게 맞는 조합·범위·근거가 나와요.
            </p>
          </div>
        </div>

        {/* 신뢰 수치(사회적 증거) */}
        <div style={{ display: "flex", gap: 8, padding: "20px 22px 0" }}>
          {[["2,791곳", "전국 피부과·성형외과"], ["공공데이터", "심평원 공개 정보 기반"], ["0원", "예약·건당 수수료"]].map(([n, l]) => (
            <div key={l} className="card" style={{ flex: 1, padding: "13px 8px", textAlign: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: "-0.02em", color: "var(--key-deep)" }}>{n}</div>
              <div className="disc" style={{ marginTop: 3, fontSize: 10.5 }}>{l}</div>
            </div>
          ))}
        </div>
        <p className="sub" style={{ padding: "10px 22px 0", fontSize: 13, lineHeight: 1.6 }}>
          병원은 <b style={{ color: "var(--ink)" }}>가까운 순</b>으로만 보여드려요 — 광고 순위가 아니에요.
          그래서 특정 병원을 밀어붙일 이유가 없어요.
        </p>

        {/* 왜 우리인지 — 아이콘 + 베네핏 라인(Toss 문법) */}
        <div className="pad" style={{ marginTop: 22 }}>
          <div className="kick" style={{ marginBottom: 10 }}>여신티켓·바비톡과 뭐가 다른가요?</div>
          {[
            ["search", "왜 이 시술인지 근거·출처까지 — 예뻐진다는 말 대신 ‘왜’를 설명해요"],
            ["shield", "예약·건당 수수료 0원 — 그래서 특정 병원을 밀어붙이지 않아요"],
            ["won", "실제 낸 가격을 또래끼리 — 가서 바가지 쓸까 걱정 덜어드려요"],
          ].map(([ic, t]) => (
            <div key={t} style={{ display: "flex", gap: 11, alignItems: "center", padding: "9px 0" }}>
              <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: 11, background: "var(--key-soft)", color: "var(--key-deep)", flexShrink: 0 }}>
                <Icon name={ic} size={18} />
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink2)", lineHeight: 1.45 }}>{t}</span>
            </div>
          ))}
        </div>

        {/* 액션 섹션 */}
        <div className="pad" style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="kick">지금 바로 할 수 있는 것</div>

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

        {/* 페이지 끝 CTA는 scroll-reveal 스티키가 대신한다(중복 그린버튼 방지) */}
        <p className="disc pad" style={{ marginTop: 28, lineHeight: 1.6 }}>
          글로우메이트는 공개 정보를 모아 제공하는 정보·비교 서비스로 의료 진단·효능을 보증하지 않아요.
          실제 시술 가능 여부·비용은 병원 상담에서 확인하세요.
        </p>
        <p className="pad" style={{ paddingBottom: 8, marginTop: 8 }}>
          <Link href="/partners" className="reset"><span className="disc" style={{ textDecoration: "underline" }}>병원 파트너 안내 →</span></Link>
        </p>
      </div>

      {/* 스티키 CTA — 히어로 CTA가 화면 밖일 때만 등장(scroll-reveal). 탭바 위 오프셋 62px. */}
      <div className="cta" aria-hidden={!stickyOn} style={{
        bottom: 62, paddingBottom: 10, zIndex: 19,
        transform: stickyOn ? "translateY(0)" : "translateY(12px)",
        opacity: stickyOn ? 1 : 0,
        pointerEvents: stickyOn ? "auto" : "none",
        transition: "opacity .22s ease, transform .22s ease",
      }}>
        <button className="btn" onClick={() => goEstimate("sticky")}>내 견적 1분 만에 받기</button>
      </div>
      <TabBar />
    </main>
  );
}
