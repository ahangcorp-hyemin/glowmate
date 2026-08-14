"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import GlowGuide from "@/components/GlowGuide";
import { submitVisitRequest } from "../../../visit/actions";
import { saveVisitRecord } from "@/lib/client/saved";

// 방문 희망 신청 — 날짜 스트립(2주) + 시간 다중 선택 + 이름·연락처.
// 입점 병원: 병원에 바로 전달 / 미입점: 글로우메이트가 전화로 확인 후 연락(컨시어지).

const TIMES = ["10:00", "10:30", "11:00", "11:30", "12:00", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"];
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export default function VisitForm({ hospitalId, hospitalName, district, isPartner }: {
  hospitalId: string; hospitalName: string; district: string; isPartner: boolean;
}) {
  const days = useMemo(() => {
    const out: { iso: string; d: number; dow: string; month: number }[] = [];
    const t = new Date();
    for (let i = 1; i <= 14; i++) {
      const dt = new Date(t); dt.setDate(t.getDate() + i);
      out.push({ iso: dt.toISOString().slice(0, 10), d: dt.getDate(), dow: DOW[dt.getDay()], month: dt.getMonth() + 1 });
    }
    return out;
  }, []);

  const [date, setDate] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTime = (t: string) =>
    setTimes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].slice(0, 3)));

  if (done) {
    return (
      <main className="shell" style={{ display: "grid", placeItems: "center", minHeight: "100dvh" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <GlowGuide mood="happy" size={116} />
          <div className="h2" style={{ marginTop: 12 }}>방문 희망을 전달했어요</div>
          <p className="sub" style={{ marginTop: 10, lineHeight: 1.65 }}>
            {isPartner
              ? <>병원에서 예약 가능 여부와 일정 확인을 위해<br />직접 연락드릴 예정이에요.</>
              : <>이 병원은 아직 입점 전이라, <b>글로우메이트가</b><br />병원에 확인한 뒤 연락드릴게요(영업시간 기준 반나절 내).</>}
          </p>
          <Link href="/learn" className="reset"><button className="btn" style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}><Icon name="clipboard" size={17} /> 방문 전 질문 미리 보기</button></Link>
          <Link href="/saved" className="reset"><button className="btn ghost" style={{ marginTop: 8 }}>방문 희망 내역 보기</button></Link>
          <Link href={`/hospital/${hospitalId}`} className="reset"><p className="sub" style={{ marginTop: 12 }}>확인</p></Link>
        </div>
      </main>
    );
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null); setSending(true);
    const form = new FormData(e.currentTarget);
    form.set("hospitalId", hospitalId);
    form.set("date", date);
    form.set("times", times.join(","));
    const res = await submitVisitRequest(form);
    setSending(false);
    if (res.ok) {
      saveVisitRecord({ hospitalId, hospitalName, date, times, at: new Date().toISOString(), isPartner: res.isPartner ?? false });
      setDone(true);
    } else setError(res.error ?? "신청에 실패했어요.");
  };

  return (
    <main className="shell" style={{ minHeight: "100dvh" }}>
      <div className="backbar" style={{ display: "flex", alignItems: "center", gap: 6, padding: "16px 22px 6px" }}>
        <Link href={`/hospital/${hospitalId}`} className="reset"><span style={{ fontSize: 22, color: "var(--ink2)" }}>‹</span></Link>
        <span style={{ fontWeight: 800, fontSize: 17 }}>방문 희망 신청</span>
      </div>

      <form onSubmit={onSubmit} className="pad" style={{ paddingBottom: 28 }}>
        <div className="estcard" style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 15.5 }}>{hospitalName}</div>
          <div className="sub" style={{ marginTop: 3 }}>{district}{isPartner ? " · 파트너 병원" : ""}</div>
        </div>

        <div className="kick">방문 희망 날짜 *</div>
        <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "8px 0 14px" }}>
          {days.map((d) => (
            <button type="button" key={d.iso} onClick={() => setDate(d.iso)}
              style={{
                flexShrink: 0, width: 56, padding: "9px 0", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                border: `1.5px solid ${date === d.iso ? "var(--coral)" : "var(--line)"}`,
                background: date === d.iso ? "var(--coral-soft)" : "var(--white)",
                color: d.dow === "일" ? "var(--coral-strong)" : "var(--ink)",
              }}>
              <div style={{ fontSize: 11.5, fontWeight: 600 }}>{d.month}/{d.d}</div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{d.dow}</div>
            </button>
          ))}
        </div>

        <div className="kick">희망 시간 * <span className="disc">(최대 3개 · 병원 사정에 따라 조정될 수 있어요)</span></div>
        <div className="chipwrap" style={{ margin: "8px 0 16px" }}>
          {TIMES.map((t) => (
            <button type="button" key={t} onClick={() => toggleTime(t)}
              className={`chip${times.includes(t) ? " on" : ""}`} style={{ fontSize: 14, padding: "10px 13px" }}>{t}</button>
          ))}
        </div>

        <div className="kick">성함 *</div>
        <input name="visitorName" placeholder="병원에서 확인할 이름" style={inp} />
        <div className="kick" style={{ marginTop: 14 }}>연락처 *</div>
        <input name="phone" inputMode="tel" placeholder="010-0000-0000" style={inp} />
        <div className="kick" style={{ marginTop: 14 }}>남기실 말 (선택)</div>
        <input name="note" placeholder="예: 울쎄라 상담 원해요, 오후만 가능해요" style={inp} />

        <label style={{ display: "block", fontSize: 13, color: "var(--ink2)", lineHeight: 1.55, marginTop: 14, fontWeight: 600 }}>
          <input type="checkbox" name="consented" /> (필수) 방문 일정 확인·연락 목적의 연락처 수집·이용에 동의해요. 확정 후 파기돼요.
        </label>

        {error && <p style={{ color: "var(--coral-strong)", fontSize: 13.5, fontWeight: 700, marginTop: 12 }}>{error}</p>}

        <button className="btn" disabled={sending} style={{ marginTop: 16 }}>
          {sending ? "전달하는 중…" : "방문 희망 전달하기"}
        </button>
        <p className="disc" style={{ textAlign: "center", marginTop: 10, lineHeight: 1.55 }}>
          글로우메이트는 예약·시술 건당 수수료를 받지 않아요(의료법 §27). 일정 전달·확인만 도와드려요.
        </p>
      </form>
    </main>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: "14px 15px", borderRadius: 14, fontSize: 15, marginTop: 6,
};
