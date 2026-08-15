"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import { track } from "@/lib/analytics";
import { getQuoteResult, markQuoteViewed, type QuoteResultView } from "../actions";

// 결과 화면(#72). 7상태 매트릭스 + 세로 카드 스택 + 비교 스트립.
// 가격 위계(Design F1·F2): 가격 블록(총액+VAT 인라인) → 구성 → 병원·거리 → 조건. 카드 CTA 1개.

const won = (n: number) => n.toLocaleString();
const PT_LABEL: Record<string, string> = { fixed: "", from: "부터", range: "", consult: "" };

export default function QuoteResult({ requestId }: { requestId: string }) {
  const [view, setView] = useState<QuoteResultView | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => getQuoteResult(requestId).then((r) => {
      if (!alive) return;
      if (r.ok && r.view) setView(r.view); else setErr(r.error ?? "요청을 찾지 못했어요.");
    });
    load();
    markQuoteViewed(requestId); // 명시 POST(프리뷰봇 오염 방지)
    track("quote_result_open", {});
    const t = setInterval(load, 20000); // 대기 중 자동 갱신
    return () => { alive = false; clearInterval(t); };
  }, [requestId]);

  if (err) return <Shell><State icon="search" title="요청을 찾지 못했어요" sub="링크가 만료됐거나 이 기기에 기록이 없어요. 견적을 다시 요청해보세요." cta={{ href: "/quote/new", label: "견적 다시 요청" }} /></Shell>;
  if (!view) return <Shell><p className="sub" style={{ padding: 24, textAlign: "center" }}>불러오는 중…</p></Shell>;

  const replies = view.replies;
  const isExpired = view.status === "expired";
  const waiting = replies.length === 0 && !isExpired;
  const prices = replies.map((r) => r.totalPrice).filter((p): p is number => p != null);
  const lo = prices.length ? Math.min(...prices) : null;
  const hi = prices.length ? Math.max(...prices) : null;
  const cheapest = replies.find((r) => r.totalPrice === lo);

  return (
    <Shell>
      <div className="backbar" style={{ display: "flex", alignItems: "center", gap: 6, padding: "16px 22px 6px" }}>
        <Link href="/saved" className="reset"><span style={{ fontSize: 22, color: "var(--ink2)" }}>‹</span></Link>
        <span style={{ fontWeight: 800, fontSize: 17 }}>받은 견적</span>
      </div>
      <div className="pad" style={{ paddingBottom: 28 }}>
        {/* 만료 */}
        {isExpired && (
          <State icon="calendar" title="견적 요청이 만료됐어요" sub="확인 기간(3일)이 지났어요. 지금 조건으로 다시 요청하면 최신 견적을 받아볼 수 있어요." cta={{ href: "/quote/new", label: "견적 다시 요청" }} />
        )}

        {/* 대기 중(partial 포함): 진행 표시 */}
        {waiting && (
          <div className="card" style={{ padding: 18, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>지금 병원에 문의하고 있어요</div>
            <p className="sub" style={{ marginTop: 6, lineHeight: 1.6 }}>
              {view.slaDueAt ? <><b style={{ color: "var(--key-deep)" }}>{fmtDue(view.slaDueAt)}</b>까지 견적을 모아드려요.</> : "영업일 기준 하루 안에 도착해요."}
              <br />병원은 회원님 연락처를 몰라요.
            </p>
          </div>
        )}

        {/* 비교 스트립(Design F3) */}
        {replies.length > 0 && (
          <>
            <div className="card" style={{ padding: "13px 16px", marginBottom: 12, background: "var(--key-soft)" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--key-deep)" }}>
                {replies.length}곳 도착{lo != null && hi != null ? ` · ${won(lo / 10000)}만~${won(hi / 10000)}만원` : ""}
                {cheapest ? ` · 최저 ${cheapest.hospitalName}` : ""}
              </span>
            </div>
            {view.replies.length < 3 && !isExpired && (
              <p className="sub" style={{ margin: "0 2px 12px", fontSize: 12.5 }}>나머지 병원도 계속 확인하고 있어요.</p>
            )}

            {/* 견적 카드 — 가격 우선 세로 스택 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {replies.map((r) => {
                const vatCond = r.conditions.includes("vat_included") ? "VAT 포함" : r.conditions.includes("vat_excluded") ? "VAT 별도" : null;
                return (
                  <div key={r.id} className="card" style={{ padding: 16 }}>
                    {/* ① 가격 블록 */}
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                      {r.priceType === "consult" || r.totalPrice == null ? (
                        <span className="price" style={{ fontSize: 19 }}>가격 비공개</span>
                      ) : (
                        <>
                          <span className="price" style={{ fontSize: 24 }}>{won(r.totalPrice / 10000)}만원{r.priceType === "from" ? "~" : ""}</span>
                          {r.priceType === "range" && r.priceMax && <span className="price" style={{ fontSize: 16 }}>~{won(r.priceMax / 10000)}만</span>}
                          {vatCond && <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--muted)" }}>· {vatCond}</span>}
                        </>
                      )}
                    </div>
                    {r.extraCosts && <div className="sub" style={{ marginTop: 3, fontSize: 12.5 }}>+ {r.extraCosts}</div>}
                    {r.priceType === "consult" && <div className="sub" style={{ marginTop: 3, fontSize: 12.5 }}>상담 시 확인 가능해요</div>}

                    {/* ② 구성 */}
                    {r.skuSummary && <div style={{ marginTop: 9, fontSize: 14, fontWeight: 600, color: "var(--ink2)" }}>{r.skuSummary}</div>}

                    {/* ③ 병원·거리 */}
                    <div style={{ marginTop: 8, fontWeight: 800, fontSize: 15 }}>{r.hospitalName}</div>

                    {/* ⑤ 조건 배지(금액 없는 조건만) */}
                    {r.validUntil && <div className="disc" style={{ marginTop: 4 }}>이 가격은 {r.validUntil}까지</div>}

                    {/* CTA 1개 */}
                    {r.hospitalId && (
                      <Link href={`/hospital/${r.hospitalId}/visit?q=${requestId}`} className="reset" onClick={() => track("quote_connect_click", {})}>
                        <button className="btn" style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                          <Icon name="calendar" size={17} strokeWidth={2} /> 이 병원으로 방문 예약
                        </button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 일부 거절 정직 고지 */}
        {view.refusedCount > 0 && (
          <p className="disc" style={{ marginTop: 12, lineHeight: 1.55 }}>
            {view.refusedCount}곳은 가격 비공개 방침이라 견적을 받지 못했어요.
          </p>
        )}

        {replies.length > 0 && (
          <p className="disc" style={{ marginTop: 14, lineHeight: 1.6 }}>
            전화로 수집한 시점의 견적이라 상담 후 달라질 수 있어요. 거리·조건순 기계 선정이며 광고 순위가 아니에요(§27).
          </p>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="shell" style={{ minHeight: "100dvh" }}>{children}</main>;
}

function State({ icon, title, sub, cta }: { icon: string; title: string; sub: string; cta: { href: string; label: string } }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px" }}>
      <span style={{ display: "inline-grid", placeItems: "center", width: 56, height: 56, borderRadius: 18, background: "var(--chip)", color: "var(--muted)" }}>
        <Icon name={icon} size={26} />
      </span>
      <div className="h2" style={{ marginTop: 14, fontSize: 19 }}>{title}</div>
      <p className="sub" style={{ marginTop: 10, lineHeight: 1.6 }}>{sub}</p>
      <Link href={cta.href} className="reset"><button className="btn" style={{ marginTop: 18 }}>{cta.label}</button></Link>
    </div>
  );
}

function fmtDue(iso: string): string {
  const d = new Date(iso);
  const day = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  const h = d.getHours(); const ampm = h < 12 ? "오전" : "오후"; const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${d.getMonth() + 1}/${d.getDate()}(${day}) ${ampm} ${h12}시`;
}
