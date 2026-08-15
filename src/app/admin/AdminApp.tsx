"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminStats, adminListVisits, adminUpdateVisit, adminSetPartner,
  adminListReviews, adminModerateReview, adminReceiptUrl,
  adminListInquiries, adminUpdateInquiry,
  type AdminVisit, type AdminReview, type AdminInquiry,
} from "./actions";

// 운영 어드민 v2 (v3 토스 디자인). 탭: 대시보드·후기검수·방문예약·파트너문의.
// Mobbin 러닝: 큐는 상태 탭 분리 / 검수는 카드 1건=판단 1회 / 처리 즉시 제거+카운트 감소.

type Tab = "dash" | "reviews" | "visits" | "inquiries";
const VISIT_LABEL: Record<string, string> = {
  requested: "🟡 접수", forwarded: "📨 병원전달", concierge: "📞 컨시어지",
  confirmed: "✅ 확정", declined: "⛔ 불가", canceled: "취소",
};
const VISIT_NEXT: Record<string, { s: string; label: string }[]> = {
  requested: [{ s: "forwarded", label: "병원전달" }, { s: "concierge", label: "컨시어지" }, { s: "declined", label: "불가" }],
  forwarded: [{ s: "confirmed", label: "확정" }, { s: "declined", label: "불가" }],
  concierge: [{ s: "confirmed", label: "확정" }, { s: "declined", label: "불가" }],
};
const PRICE_MATCH: Record<string, string> = { in_range: "범위 안", higher: "더 비쌈", lower: "더 쌈", unsure: "기억X" };

export default function AdminApp({ procNames }: { procNames: Record<string, string> }) {
  const [token, setToken] = useState("");
  const [input, setInput] = useState("");
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("dash");

  useEffect(() => {
    const t = sessionStorage.getItem("glowmate.adminToken");
    if (t) setToken(t);
  }, []);

  const [stats, setStats] = useState<{ pendingReviews: number; openVisits: number; newInquiries: number } | null>(null);
  const loadStats = useCallback(async (t: string) => {
    const r = await adminStats(t);
    if (!r.ok) { setAuthErr(r.error ?? "인증 실패"); setToken(""); sessionStorage.removeItem("glowmate.adminToken"); return false; }
    setStats({ pendingReviews: r.pendingReviews!, openVisits: r.openVisits!, newInquiries: r.newInquiries! });
    return true;
  }, []);

  useEffect(() => { if (token) loadStats(token); }, [token, loadStats]);

  if (!token) {
    return (
      <main className="shell" style={{ display: "grid", placeItems: "center", minHeight: "100dvh" }}>
        <div style={{ width: "100%", maxWidth: 320, padding: 20 }}>
          <div className="h2" style={{ marginBottom: 12 }}>운영 어드민</div>
          <input type="password" value={input} onChange={(e) => setInput(e.target.value)} placeholder="ADMIN TOKEN"
            style={{ width: "100%", padding: "14px 15px", borderRadius: 14, fontSize: 15 }}
            onKeyDown={(e) => { if (e.key === "Enter") { sessionStorage.setItem("glowmate.adminToken", input); setToken(input); } }} />
          {authErr && <p style={{ color: "var(--coral-strong)", fontSize: 13, marginTop: 8 }}>{authErr}</p>}
          <button className="btn" style={{ marginTop: 10 }}
            onClick={() => { sessionStorage.setItem("glowmate.adminToken", input); setToken(input); }}>들어가기</button>
        </div>
      </main>
    );
  }

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "dash", label: "대시보드" },
    { id: "reviews", label: "후기검수", badge: stats?.pendingReviews },
    { id: "visits", label: "방문예약", badge: stats?.openVisits },
    { id: "inquiries", label: "파트너문의", badge: stats?.newInquiries },
  ];

  return (
    <main className="shell" style={{ minHeight: "100dvh", paddingBottom: 30 }}>
      <div className="top">
        <div className="logo">운영 어드민</div>
        <button className="chip" onClick={() => loadStats(token)}>새로고침</button>
      </div>

      {/* 세그먼트 탭 */}
      <div style={{ display: "flex", gap: 6, padding: "4px 22px 12px", overflowX: "auto" }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`chip${tab === t.id ? " on" : ""}`} style={{ fontSize: 13.5, padding: "9px 13px", whiteSpace: "nowrap", flexShrink: 0 }}>
            {t.label}{t.badge ? ` ${t.badge}` : ""}
          </button>
        ))}
      </div>

      <div className="pad">
        {tab === "dash" && stats && <Dashboard stats={stats} onJump={setTab} />}
        {tab === "reviews" && <ReviewsPane token={token} procNames={procNames} onChange={() => loadStats(token)} />}
        {tab === "visits" && <VisitsPane token={token} onChange={() => loadStats(token)} />}
        {tab === "inquiries" && <InquiriesPane token={token} onChange={() => loadStats(token)} />}
      </div>
    </main>
  );
}

function Dashboard({ stats, onJump }: { stats: { pendingReviews: number; openVisits: number; newInquiries: number }; onJump: (t: Tab) => void }) {
  const cards: { k: Tab; n: number; l: string }[] = [
    { k: "reviews", n: stats.pendingReviews, l: "검수 대기 후기" },
    { k: "visits", n: stats.openVisits, l: "진행 중 방문예약" },
    { k: "inquiries", n: stats.newInquiries, l: "미확인 파트너문의" },
  ];
  return (
    <>
      <div className="kick" style={{ marginBottom: 10 }}>오늘 처리할 일</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {cards.map((c) => (
          <button key={c.k} onClick={() => onJump(c.k)} className="card"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 18, cursor: "pointer", textAlign: "left", fontFamily: "inherit", border: "none" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--ink2)" }}>{c.l}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <b style={{ fontSize: 26, fontWeight: 800, color: c.n > 0 ? "var(--key-deep)" : "var(--faint)", letterSpacing: "-0.03em" }}>{c.n}</b>
              <span style={{ color: "var(--faint)", fontWeight: 700 }}>›</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function ReviewsPane({ token, procNames, onChange }: { token: string; procNames: Record<string, string>; onChange: () => void }) {
  const [sub, setSub] = useState<"hidden" | "shown" | "demoted">("hidden");
  const [rows, setRows] = useState<AdminReview[] | null>(null);
  const load = useCallback(async () => { setRows(null); const r = await adminListReviews(token, sub); setRows(r.rows ?? []); }, [token, sub]);
  useEffect(() => { load(); }, [load]);

  const act = async (id: string, action: "publish" | "hide" | "reject") => {
    const r = await adminModerateReview(token, id, action);
    if (r.ok) { setRows((cur) => cur?.filter((x) => x.id !== id) ?? null); onChange(); }
  };

  return (
    <>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {([["hidden", "대기"], ["shown", "공개됨"], ["demoted", "반려"]] as const).map(([s, l]) => (
          <button key={s} onClick={() => setSub(s)} className={`chip${sub === s ? " on" : ""}`} style={{ fontSize: 13, padding: "8px 13px" }}>{l}</button>
        ))}
      </div>
      {rows === null && <p className="sub">불러오는 중…</p>}
      {rows?.length === 0 && <p className="sub">{sub === "hidden" ? "검수 대기 후기가 없어요." : "없어요."}</p>}
      {rows?.map((r) => <ReviewCard key={r.id} r={r} token={token} procName={r.procedureId ? procNames[r.procedureId] : undefined} onAct={act} showActions={sub === "hidden"} />)}
    </>
  );
}

function ReviewCard({ r, token, procName, onAct, showActions }: {
  r: AdminReview; token: string; procName?: string; onAct: (id: string, a: "publish" | "hide" | "reject") => void; showActions: boolean;
}) {
  const [receipt, setReceipt] = useState<string | null>(null);
  const openReceipt = async () => { const x = await adminReceiptUrl(token, r.id); if (x.ok && x.url) { setReceipt(x.url); window.open(x.url, "_blank"); } };
  return (
    <div className="card" style={{ padding: 16, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{procName ?? r.procedureId} · {r.hospitalName}</div>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--mid)" }}>{"★".repeat(r.rating ?? 0)}</span>
      </div>
      <div className="sub" style={{ marginTop: 3, fontSize: 12.5 }}>
        {r.ageBand}{r.weeks != null ? ` · ${r.weeks}주 경과` : ""} · {new Date(r.createdAt).toLocaleDateString("ko-KR")}
      </div>

      {r.flagged && (
        <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: "var(--coral-strong)", background: "#FDECEC", borderRadius: 10, padding: "8px 11px" }}>
          ⚠ §56 의심 표현: {r.flagged}
        </div>
      )}

      <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.6, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{r.body}</p>

      {(r.paidAmount != null || r.priceMatch || r.procedureSpec) && (
        <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {r.paidAmount != null && <span className="badge" style={{ background: "var(--key-soft)", color: "var(--key-deep)", fontWeight: 800 }}>실결제 {r.paidAmount}만원</span>}
          {r.priceMatch && <span className="badge">예상대비 {PRICE_MATCH[r.priceMatch] ?? r.priceMatch}</span>}
          {r.procedureSpec && <span className="badge">{r.procedureSpec}</span>}
        </div>
      )}

      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
        {r.hasReceipt
          ? <button onClick={openReceipt} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--key-deep)", padding: 0, fontFamily: "inherit" }}>📄 영수증 보기</button>
          : <span className="disc">영수증 없음</span>}
        {receipt && <span className="disc">새 탭에서 열림(60초)</span>}
      </div>

      {showActions && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn" style={{ flex: 1, padding: 13, fontSize: 14 }} onClick={() => onAct(r.id, "publish")}>공개</button>
          <button className="btn ghost" style={{ flex: 1, padding: 13, fontSize: 14 }} onClick={() => onAct(r.id, "hide")}>보류</button>
          <button className="btn ghost" style={{ flex: 1, padding: 13, fontSize: 14, color: "var(--coral-strong)" }} onClick={() => onAct(r.id, "reject")}>반려</button>
        </div>
      )}
    </div>
  );
}

function VisitsPane({ token, onChange }: { token: string; onChange: () => void }) {
  const [rows, setRows] = useState<AdminVisit[] | null>(null);
  const [partnerName, setPartnerName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await adminListVisits(token); setRows(r.rows ?? []); }, [token]);
  useEffect(() => { load(); }, [load]);
  const move = async (id: string, s: string) => { const r = await adminUpdateVisit(token, id, s); if (r.ok) { load(); onChange(); } };

  return (
    <>
      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div className="kick" style={{ marginBottom: 8 }}>파트너(입점) 지정</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="병원 이름(정확히)"
            style={{ flex: 1, padding: "11px 13px", borderRadius: 12, fontSize: 14 }} />
          <button className="chip on" onClick={async () => { const r = await adminSetPartner(token, partnerName.trim(), true); setMsg(r.ok ? `입점 ${r.count}곳` : r.error ?? "실패"); }}>입점</button>
          <button className="chip" onClick={async () => { const r = await adminSetPartner(token, partnerName.trim(), false); setMsg(r.ok ? `해제 ${r.count}곳` : r.error ?? "실패"); }}>해제</button>
        </div>
        {msg && <p className="disc" style={{ marginTop: 6 }}>{msg}</p>}
      </div>

      {rows === null && <p className="sub">불러오는 중…</p>}
      {rows?.length === 0 && <p className="sub">아직 신청이 없어요.</p>}
      {rows?.map((v) => (
        <div key={v.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              {v.hospitalName} {v.isPartner ? <span className="badge" style={{ background: "var(--key-soft)", color: "var(--key-deep)" }}>파트너</span> : <span className="badge">미입점→컨시어지</span>}
            </div>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{VISIT_LABEL[v.status] ?? v.status}</span>
          </div>
          <div className="sub" style={{ marginTop: 6, lineHeight: 1.6 }}>
            🗓 {v.desiredDate} · {v.desiredTimes.join(", ")}<br />
            👤 {v.visitorName} · <a href={`tel:${v.phone}`} style={{ color: "var(--key-deep)", fontWeight: 700 }}>{v.phone}</a>
            {v.hospitalPhone && <> · 병원 <a href={`tel:${v.hospitalPhone}`} style={{ color: "var(--ink2)", fontWeight: 700 }}>{v.hospitalPhone}</a></>}
            {v.note && <><br />💬 {v.note}</>}
          </div>
          {VISIT_NEXT[v.status]?.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {VISIT_NEXT[v.status].map((n) => (
                <button key={n.s} className="chip" style={{ fontSize: 12.5, padding: "7px 11px" }} onClick={() => move(v.id, n.s)}>→ {n.label}</button>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function InquiriesPane({ token, onChange }: { token: string; onChange: () => void }) {
  const [rows, setRows] = useState<AdminInquiry[] | null>(null);
  const load = useCallback(async () => { const r = await adminListInquiries(token); setRows(r.rows ?? []); }, [token]);
  useEffect(() => { load(); }, [load]);
  const set = async (id: string, s: "new" | "contacted" | "done") => { const r = await adminUpdateInquiry(token, id, s); if (r.ok) { load(); onChange(); } };
  const isEmail = (c: string) => c.includes("@");
  const label: Record<string, string> = { new: "🟡 신규", contacted: "📞 연락함", done: "✅ 완료" };

  return (
    <>
      {rows === null && <p className="sub">불러오는 중…</p>}
      {rows?.length === 0 && <p className="sub">아직 문의가 없어요.</p>}
      {rows?.map((q) => (
        <div key={q.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{q.hospitalName}</div>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{label[q.status] ?? q.status}</span>
          </div>
          <div className="sub" style={{ marginTop: 6, lineHeight: 1.6 }}>
            {q.region ? `${q.region} · ` : ""}{q.contactName}<br />
            <a href={`${isEmail(q.contact) ? "mailto" : "tel"}:${q.contact}`} style={{ color: "var(--key-deep)", fontWeight: 700 }}>{q.contact}</a>
            {q.message && <><br />💬 {q.message}</>}
            <br /><span className="disc">{new Date(q.createdAt).toLocaleDateString("ko-KR")}</span>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {(["new", "contacted", "done"] as const).filter((s) => s !== q.status).map((s) => (
              <button key={s} className="chip" style={{ fontSize: 12.5, padding: "7px 11px" }} onClick={() => set(q.id, s)}>→ {label[s].replace(/^\S+ /, "")}</button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
