"use client";

import { useState } from "react";
import { submitPartnerInquiry } from "./actions";

export default function PartnerForm() {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <div className="estcard" style={{ textAlign: "center", padding: "26px 18px" }}>
        <div style={{ fontSize: 30 }}>🤝</div>
        <div style={{ fontWeight: 800, fontSize: 16, marginTop: 8 }}>접수됐어요</div>
        <p className="sub" style={{ marginTop: 6, lineHeight: 1.55 }}>영업일 기준 2일 안에 담당자가 연락드릴게요.</p>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null); setSending(true);
    const res = await submitPartnerInquiry(new FormData(e.currentTarget));
    setSending(false);
    if (res.ok) setDone(true);
    else setError(res.error ?? "접수에 실패했어요.");
  };

  return (
    <form onSubmit={onSubmit}>
      <input name="hospitalName" placeholder="병원 이름 *" style={inp} />
      <input name="region" placeholder="지역 (예: 강남, 분당)" style={inp} />
      <input name="contactName" placeholder="담당자 성함 *" style={inp} />
      <input name="contact" placeholder="연락처(전화 또는 이메일) *" style={inp} />
      <textarea name="message" rows={3} placeholder="문의 내용 (선택)" style={{ ...inp, lineHeight: 1.6 }} />
      <label style={{ display: "block", fontSize: 13, color: "var(--ink2)", lineHeight: 1.5, marginTop: 10, fontWeight: 600 }}>
        <input type="checkbox" name="consented" /> (필수) 문의 응대 목적의 개인정보 수집·이용에 동의합니다.
      </label>
      {error && <p style={{ color: "var(--coral-strong)", fontSize: 13.5, fontWeight: 700, marginTop: 10 }}>{error}</p>}
      <button className="btn" disabled={sending} style={{ marginTop: 12 }}>{sending ? "보내는 중…" : "문의 보내기"}</button>
    </form>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: "13px 14px", borderRadius: 12, border: "1.5px solid var(--line)",
  fontSize: 15, fontFamily: "inherit", background: "var(--white)", marginTop: 8,
};
