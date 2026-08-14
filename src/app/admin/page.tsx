"use client";

import { useEffect, useState } from "react";
import { adminListVisits, adminUpdateVisit, adminSetPartner, type AdminVisit } from "./actions";

// 내부 운영 어드민 — 방문신청 큐. ADMIN_TOKEN 필요(검색엔진 noindex).
// 상태: requested(접수) → forwarded(병원 전달·입점) / concierge(우리가 전화중·미입점)
//      → confirmed(확정) / declined(불가) / canceled(취소)

const STATUS_LABEL: Record<string, string> = {
  requested: "🟡 접수", forwarded: "📨 병원전달", concierge: "📞 컨시어지",
  confirmed: "✅ 확정", declined: "⛔ 불가", canceled: "취소",
};
const NEXT: Record<string, string[]> = {
  requested: ["forwarded", "concierge", "declined"],
  forwarded: ["confirmed", "declined"],
  concierge: ["confirmed", "declined"],
  confirmed: [], declined: [], canceled: [],
};

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<AdminVisit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const t = sessionStorage.getItem("glowmate.adminToken");
    if (t) setToken(t);
  }, []);

  const load = async (t: string) => {
    const res = await adminListVisits(t);
    if (!res.ok) { setError(res.error ?? "실패"); setToken(""); sessionStorage.removeItem("glowmate.adminToken"); return; }
    setError(null); setRows(res.rows ?? []);
  };

  useEffect(() => { if (token) load(token); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) {
    return (
      <main className="shell" style={{ display: "grid", placeItems: "center", minHeight: "100dvh" }}>
        <div style={{ width: "100%", maxWidth: 320, padding: 20 }}>
          <div className="h2" style={{ marginBottom: 12 }}>운영 어드민</div>
          <input type="password" value={input} onChange={(e) => setInput(e.target.value)} placeholder="ADMIN TOKEN"
            style={{ width: "100%", padding: "13px 14px", borderRadius: 12, border: "1.5px solid var(--line)", fontSize: 15, fontFamily: "inherit" }} />
          {error && <p style={{ color: "var(--coral-strong)", fontSize: 13, marginTop: 8 }}>{error}</p>}
          <button className="btn" style={{ marginTop: 10 }}
            onClick={() => { sessionStorage.setItem("glowmate.adminToken", input); setToken(input); }}>들어가기</button>
        </div>
      </main>
    );
  }

  return (
    <main className="shell" style={{ minHeight: "100dvh", paddingBottom: 30 }}>
      <div className="top">
        <div className="logo">운영 <span className="m">어드민</span></div>
        <button className="chip" onClick={() => token && load(token)}>새로고침</button>
      </div>

      <div className="pad">
        <div className="card" style={{ padding: 14, marginBottom: 16 }}>
          <div className="kick" style={{ marginBottom: 8 }}>파트너(입점) 지정</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="병원 이름(정확히)"
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1.5px solid var(--line)", fontSize: 14, fontFamily: "inherit" }} />
            <button className="chip" onClick={async () => { const r = await adminSetPartner(token, partnerName.trim(), true); setMsg(r.ok ? `입점 지정 ${r.count}곳` : r.error ?? "실패"); }}>입점</button>
            <button className="chip" onClick={async () => { const r = await adminSetPartner(token, partnerName.trim(), false); setMsg(r.ok ? `해제 ${r.count}곳` : r.error ?? "실패"); }}>해제</button>
          </div>
          {msg && <p className="disc" style={{ marginTop: 6 }}>{msg}</p>}
        </div>

        <div className="kick" style={{ marginBottom: 8 }}>방문신청 큐 {rows ? `(${rows.length})` : ""}</div>
        {rows === null && <p className="sub">불러오는 중…</p>}
        {rows?.length === 0 && <p className="sub">아직 신청이 없어요.</p>}
        {rows?.map((v) => (
          <div key={v.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>
                {v.hospitalName} {v.isPartner ? <span className="badge" style={{ color: "var(--hi)" }}>파트너</span> : <span className="badge">미입점→컨시어지</span>}
              </div>
              <span style={{ fontSize: 13, fontWeight: 800 }}>{STATUS_LABEL[v.status] ?? v.status}</span>
            </div>
            <div className="sub" style={{ marginTop: 6, lineHeight: 1.6 }}>
              🗓 {v.desiredDate} · {v.desiredTimes.join(", ")}<br />
              👤 {v.visitorName} · <a href={`tel:${v.phone}`} style={{ color: "var(--coral)", fontWeight: 700 }}>{v.phone}</a>
              {v.hospitalPhone && <> · 병원 <a href={`tel:${v.hospitalPhone}`} style={{ color: "var(--ink2)", fontWeight: 700 }}>{v.hospitalPhone}</a></>}
              {v.note && <><br />💬 {v.note}</>}
            </div>
            {NEXT[v.status]?.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {NEXT[v.status].map((s) => (
                  <button key={s} className="chip" style={{ fontSize: 12.5, padding: "7px 11px" }}
                    onClick={async () => { const r = await adminUpdateVisit(token, v.id, s); if (r.ok) load(token); }}>
                    → {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
