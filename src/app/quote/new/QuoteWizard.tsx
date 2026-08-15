"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import GlowGuide from "@/components/GlowGuide";
import Icon from "@/components/Icon";
import { REGIONS } from "@/lib/geo/region";
import { loadLoc } from "@/lib/geo/loc";
import { getEstimateSnapshots, saveQuoteRecord } from "@/lib/client/saved";
import { track } from "@/lib/analytics";
import { submitQuoteRequest } from "../actions";

// 신청 위저드(1화면) — Jobber 요청서 문법. 견적 결과 조건 프리필. §27 무수수료 상시 고지.
type Proc = { id: string; nameKo: string };
const DOWNTIMES = [
  { v: "none", l: "쉬는 날 필요 없어요" },
  { v: "weekend", l: "주말만 가능" },
  { v: "week", l: "1주까진 괜찮아요" },
  { v: "any", l: "상관없어요" },
];

export default function QuoteWizard({ procedures, concerns }: { procedures: Proc[]; concerns: Proc[] }) {
  // 최근 견적 스냅샷에서 프리필(있으면)
  const snap = useMemo(() => (typeof window !== "undefined" ? getEstimateSnapshots()[0] : null), []);
  const [procId, setProcId] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [budget, setBudget] = useState("");
  const [downtime, setDowntime] = useState("any");
  const [region, setRegion] = useState<{ label: string; lat: number; lng: number } | null>(null);
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState<"sms" | "app">("sms");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ slaDueAt?: string; queued?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 프리필: 스냅샷의 시술명으로 procedure 매칭 + 저장된 위치
    if (snap?.items?.length) {
      const first = procedures.find((p) => snap.items.some((it) => it.nameKo === p.nameKo));
      if (first) setProcId(first.id);
    }
    const loc = loadLoc();
    if (loc?.label) { const r = REGIONS.find((x) => x.label === loc.label); if (r) setRegion({ label: r.label, lat: r.lat, lng: r.lng }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleConcern = (id: string) => setSel((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  if (done) {
    return (
      <main className="shell" style={{ display: "grid", placeItems: "center", minHeight: "100dvh" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <GlowGuide mood="happy" size={116} />
          <div className="h2" style={{ marginTop: 12 }}>견적 요청을 보냈어요</div>
          <p className="sub" style={{ marginTop: 10, lineHeight: 1.7, color: "var(--ink2)" }}>
            <b style={{ color: "var(--ink)" }}>병원은 회원님 연락처를 몰라요.<br />전화는 저희가 대신 걸어요.</b>
          </p>
          <p className="sub" style={{ marginTop: 12, lineHeight: 1.6 }}>
            {done.queued
              ? <>이번 주 접수가 가득 찼어요.<br />다음 주 화요일부터 순서대로 연락드릴게요.</>
              : done.slaDueAt
                ? <><b style={{ color: "var(--key-deep)" }}>{fmtDue(done.slaDueAt)}</b>까지<br />조건 맞는 병원 견적을 모아드려요.</>
                : <>영업일 기준 하루 안에 견적을 모아드려요.</>}
          </p>
          <Link href="/learn" className="reset"><button className="btn" style={{ marginTop: 18 }}>기다리는 동안 · 전화 전 질문 보기</button></Link>
          <Link href="/saved" className="reset"><button className="btn ghost" style={{ marginTop: 10 }}>내 견적 요청 보기</button></Link>
        </div>
      </main>
    );
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!procId && !sel.length) { setError("시술이나 고민을 하나 이상 골라주세요."); return; }
    if (channel === "sms" && phone.replace(/[^0-9]/g, "").length < 9) { setError("문자로 받으시려면 연락처를 정확히 입력해주세요."); return; }
    setSending(true);
    const form = new FormData();
    form.set("procedureId", procId);
    form.set("concerns", sel.join(","));
    if (snap?.concerns) form.set("ageBand", "");
    form.set("budgetMax", budget);
    form.set("downtime", downtime);
    if (region) { form.set("regionLabel", region.label); form.set("lat", String(region.lat)); form.set("lng", String(region.lng)); }
    form.set("note", note);
    form.set("notifyChannel", channel);
    form.set("phone", phone);
    const res = await submitQuoteRequest(form);
    setSending(false);
    if (res.ok && res.id) {
      const label = [procedures.find((p) => p.id === procId)?.nameKo, sel.map((s) => concerns.find((c) => c.id === s)?.nameKo).filter(Boolean).join("·")].filter(Boolean).join(" · ");
      saveQuoteRecord({ id: res.id, label: label || "견적 요청", at: new Date().toISOString() });
      track("quote_request_submit", { channel });
      setDone({ slaDueAt: res.slaDueAt, queued: res.queued });
    } else setError(res.error ?? "신청에 실패했어요.");
  };

  return (
    <main className="shell" style={{ minHeight: "100dvh" }}>
      <div className="backbar" style={{ display: "flex", alignItems: "center", gap: 6, padding: "16px 22px 6px" }}>
        <Link href="/estimate" className="reset"><span style={{ fontSize: 22, color: "var(--ink2)" }}>‹</span></Link>
        <span style={{ fontWeight: 800, fontSize: 17 }}>실제 견적 받기</span>
      </div>

      <form onSubmit={onSubmit} className="pad" style={{ paddingBottom: 28 }}>
        <p className="sub" style={{ margin: "4px 0 16px", lineHeight: 1.6 }}>
          <b style={{ color: "var(--ink2)" }}>전화는 저희가 대신 걸어요.</b> 조건만 알려주시면 병원 몇 곳의 견적을 모아드려요.
        </p>

        <div className="kick">어떤 시술이 궁금하세요?</div>
        <div className="chipwrap" style={{ margin: "8px 0 16px" }}>
          {procedures.slice(0, 8).map((p) => (
            <button type="button" key={p.id} onClick={() => setProcId(procId === p.id ? "" : p.id)}
              className={`chip${procId === p.id ? " on" : ""}`} style={{ fontSize: 14 }}>{p.nameKo}</button>
          ))}
        </div>

        <div className="kick">고민 부위 (여러 개 가능)</div>
        <div className="chipwrap" style={{ margin: "8px 0 16px" }}>
          {concerns.map((c) => (
            <button type="button" key={c.id} onClick={() => toggleConcern(c.id)}
              className={`chip${sel.includes(c.id) ? " on" : ""}`} style={{ fontSize: 14 }}>{c.nameKo}</button>
          ))}
        </div>

        <div className="kick">희망 지역</div>
        <div className="chipwrap" style={{ margin: "8px 0 16px" }}>
          {REGIONS.slice(0, 8).map((r) => (
            <button type="button" key={r.id} onClick={() => setRegion({ label: r.label, lat: r.lat, lng: r.lng })}
              className={`chip${region?.label === r.label ? " on" : ""}`} style={{ fontSize: 13.5 }}>{r.label}</button>
          ))}
        </div>

        <div className="kick">예산 (선택)</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric"
            placeholder="예: 100 (이 정도까지)" style={inp} />
          <span style={{ fontWeight: 700, color: "var(--ink2)", flexShrink: 0 }}>만원까지</span>
        </div>

        <div className="kick" style={{ marginTop: 16 }}>쉴 수 있는 날 (다운타임)</div>
        <div className="chipwrap" style={{ margin: "8px 0 16px" }}>
          {DOWNTIMES.map((d) => (
            <button type="button" key={d.v} onClick={() => setDowntime(d.v)}
              className={`chip${downtime === d.v ? " on" : ""}`} style={{ fontSize: 13.5 }}>{d.l}</button>
          ))}
        </div>

        <div className="kick">병원에 전할 말 (선택)</div>
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3}
          placeholder="예: 자연스럽게 하고 싶어요 / 오후만 가능해요" style={{ ...inp, lineHeight: 1.6 }} />
        <p className="disc" style={{ marginTop: 4 }}>연락처는 적지 마세요. 병원엔 전달되지 않고, 저희가 대신 연락드려요.</p>

        {/* 통지 채널 — 사전체크 없이 2택 강제(도달률, Design F5) */}
        <div className="kick" style={{ marginTop: 16 }}>견적 도착 알림</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          <button type="button" onClick={() => setChannel("sms")}
            className={`chip${channel === "sms" ? " on" : ""}`} style={{ justifyContent: "flex-start", textAlign: "left", padding: "12px 15px" }}>
            문자로 받기 <span style={{ fontWeight: 800, color: "var(--key-deep)" }}>(권장)</span> — 놓치지 않아요
          </button>
          <button type="button" onClick={() => setChannel("app")}
            className={`chip${channel === "app" ? " on" : ""}`} style={{ justifyContent: "flex-start", textAlign: "left", padding: "12px 15px" }}>
            앱에서만 확인할게요
          </button>
        </div>
        {channel === "sms" && (
          <>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel"
              placeholder="010-0000-0000" style={{ ...inp, marginTop: 10 }} />
            <label style={{ display: "block", fontSize: 12.5, color: "var(--ink2)", lineHeight: 1.5, marginTop: 8, fontWeight: 600 }}>
              견적 도착 알림 목적으로 연락처를 수집·이용해요. 병원엔 전달되지 않고, 확정 후 파기돼요.
            </label>
          </>
        )}

        {error && <p style={{ color: "var(--coral-strong)", fontSize: 13.5, fontWeight: 700, marginTop: 12 }}>{error}</p>}

        <button className="btn" disabled={sending} style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <Icon name="phone" size={17} strokeWidth={2} /> {sending ? "보내는 중…" : "견적 요청하기"}
        </button>
        <p className="disc" style={{ textAlign: "center", marginTop: 10, lineHeight: 1.55 }}>
          글로우메이트는 예약·시술 건당 수수료를 받지 않아요(의료법 §27). 견적 정보 전달만 도와드려요.
        </p>
      </form>
    </main>
  );
}

function fmtDue(iso: string): string {
  const d = new Date(iso);
  const day = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  const h = d.getHours();
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${d.getMonth() + 1}/${d.getDate()}(${day}) ${ampm} ${h12}시`;
}

const inp: React.CSSProperties = {
  width: "100%", padding: "13px 15px", borderRadius: 14, fontSize: 15, marginTop: 0, flex: 1,
};
