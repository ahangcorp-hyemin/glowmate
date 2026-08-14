"use client";

import { useState } from "react";
import Link from "next/link";
import GlowGuide from "@/components/GlowGuide";
import { submitReview } from "../actions";

// 4050 후기 폼 — 단일 페이지(멀티스텝 이탈 방지), 큰 글씨, 필수 5 + 선택 2.
// 제출 = 검수 대기(hidden). 영수증은 선택이며 '실방문 인증' 배지 근거.

const AGE_BANDS = ["30대", "40대", "50대", "60대+"];

export default function ReviewForm({ procedures }: { procedures: { id: string; nameKo: string }[] }) {
  const [procedureId, setProcedureId] = useState("");
  const [rating, setRating] = useState(0);
  const [ageBand, setAgeBand] = useState("");
  const [priceMatch, setPriceMatch] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <main className="shell" style={{ display: "grid", placeItems: "center", minHeight: "100dvh" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <GlowGuide mood="happy" size={120} />
          <div className="h2" style={{ marginTop: 12 }}>고마워요, 잘 받았어요</div>
          <p className="sub" style={{ marginTop: 10, lineHeight: 1.6 }}>
            과장·홍보성 여부를 사람이 직접 검수한 뒤<br />익명으로 공개돼요(보통 2~3일).
          </p>
          <Link href="/explore" className="reset"><button className="btn" style={{ marginTop: 18 }}>후기 탭으로 →</button></Link>
        </div>
      </main>
    );
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null); setSending(true);
    const form = new FormData(e.currentTarget);
    form.set("procedureId", procedureId);
    form.set("rating", String(rating));
    form.set("ageBand", ageBand);
    form.set("priceMatch", priceMatch);
    const res = await submitReview(form);
    setSending(false);
    if (res.ok) setDone(true);
    else setError(res.error ?? "제출에 실패했어요.");
  };

  return (
    <main className="shell" style={{ minHeight: "100dvh" }}>
      <div className="backbar" style={{ display: "flex", alignItems: "center", gap: 6, padding: "16px 22px 6px" }}>
        <Link href="/explore" className="reset"><span style={{ fontSize: 22, color: "var(--ink2)" }}>‹</span></Link>
        <span style={{ fontWeight: 800, fontSize: 17 }}>후기 남기기</span>
      </div>
      <form onSubmit={onSubmit} className="pad" style={{ paddingBottom: 28 }}>
        <p className="sub" style={{ margin: "4px 0 16px", lineHeight: 1.55 }}>
          같은 고민을 하는 또래에게 큰 도움이 돼요. <b>익명</b>이고, 검수 후 공개돼요.
        </p>

        <div className="kick">어떤 시술을 받으셨나요? *</div>
        <div className="chipwrap" style={{ margin: "8px 0 16px" }}>
          {procedures.map((p) => (
            <button type="button" key={p.id} onClick={() => setProcedureId(p.id)}
              className={`chip${procedureId === p.id ? " on" : ""}`}>{p.nameKo}</button>
          ))}
        </div>

        <div className="kick">어느 병원이었나요? *</div>
        <input name="hospitalName" placeholder="예: ○○피부과의원 (강남)" style={inp} />

        <div className="kick" style={{ marginTop: 16 }}>연령대 *</div>
        <div className="chipwrap" style={{ margin: "8px 0 16px" }}>
          {AGE_BANDS.map((a) => (
            <button type="button" key={a} onClick={() => setAgeBand(a)} className={`chip${ageBand === a ? " on" : ""}`}>{a}</button>
          ))}
        </div>

        <div className="kick">만족도 *</div>
        <div style={{ display: "flex", gap: 6, margin: "8px 0 16px" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} onClick={() => setRating(n)}
              style={{ fontSize: 30, background: "none", border: "none", cursor: "pointer", color: n <= rating ? "var(--mid)" : "var(--line)" }}>★</button>
          ))}
        </div>

        <div className="kick">받은 지 얼마나 되셨나요? (선택)</div>
        <select name="weeks" style={{ ...inp, appearance: "auto" }} defaultValue="">
          <option value="">선택 안 함</option>
          <option value="1">1주 이내</option>
          <option value="4">한 달쯤</option>
          <option value="12">3개월쯤</option>
          <option value="26">6개월쯤</option>
          <option value="52">1년 이상</option>
        </select>

        {/* 가격 데이터 수집(#67 C) — 모두닥 암묵지: '실제 낸 가격'이 4050에게 가장 중요한 정보 */}
        <div className="kick" style={{ marginTop: 16 }}>실제로 내신 총액 (선택) <span className="disc">— 또래에게 가장 도움되는 정보예요</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
          <input name="paidAmount" inputMode="numeric" placeholder="예: 90" style={{ ...inp, marginTop: 0, flex: 1 }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: "var(--ink2)", flexShrink: 0 }}>만원</span>
        </div>

        <div className="kick" style={{ marginTop: 16 }}>글로우메이트 예상 범위와 비교하면? (선택)</div>
        <div className="chipwrap" style={{ margin: "8px 0 4px" }}>
          {([["in_range", "범위 안이었어요"], ["higher", "더 비쌌어요"], ["lower", "더 쌌어요"], ["unsure", "기억 안 나요"]] as const).map(([v, label]) => (
            <button type="button" key={v} onClick={() => setPriceMatch((cur) => (cur === v ? "" : v))}
              className={`chip${priceMatch === v ? " on" : ""}`} style={{ fontSize: 13.5, padding: "9px 13px" }}>{label}</button>
          ))}
        </div>

        <div className="kick" style={{ marginTop: 16 }}>시술 부위·회차 (선택)</div>
        <input name="procedureSpec" placeholder="예: 얼굴 전체 300샷 / 이마·눈가 1회" style={inp} />

        <div className="kick" style={{ marginTop: 16 }}>경험담 * <span className="disc">(30자 이상)</span></div>
        <textarea name="body" rows={6} style={{ ...inp, lineHeight: 1.6 }}
          placeholder="통증·회복·비용·상담 분위기 등, 받기 전에 알았으면 했던 것 위주로 적어주시면 또래에게 가장 도움이 돼요." />

        <div className="kick" style={{ marginTop: 16 }}>영수증 사진 (선택)</div>
        <p className="disc" style={{ margin: "4px 0 8px", lineHeight: 1.55 }}>
          첨부해주시면 확인 후 <b>✓ 실방문 인증</b> 배지가 붙어요. 금액 등 민감한 부분은 가려서 찍으셔도 돼요. 외부에 공개되지 않아요.
        </p>
        <input type="file" name="receipt" accept="image/*" style={{ fontSize: 14 }} />

        <label style={chk}>
          <input type="checkbox" name="consented" /> (필수) 시술 이력 등 민감정보 수집·이용에 동의해요.
          검수·게시 목적 외엔 쓰지 않고, 요청 시 삭제해요.
        </label>
        <label style={chk}>
          <input type="checkbox" name="independent" /> (필수) 병원의 요청·대가 없이 제 경험을 직접 적었어요.
        </label>

        {error && <p style={{ color: "var(--coral-strong)", fontSize: 13.5, fontWeight: 700, marginTop: 12 }}>{error}</p>}

        <button className="btn" disabled={sending} style={{ marginTop: 16 }}>
          {sending ? "보내는 중…" : "후기 보내기"}
        </button>
        <p className="disc" style={{ textAlign: "center", marginTop: 10, lineHeight: 1.55 }}>
          병원과 무관한 후기만 받아요. 부작용 경험도 소중한 정보라 삭제 압력에 응하지 않아요.
        </p>
      </form>
    </main>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: "13px 14px", borderRadius: 12, border: "1.5px solid var(--line)",
  fontSize: 15, fontFamily: "inherit", background: "var(--white)", marginTop: 6,
};
const chk: React.CSSProperties = {
  display: "block", fontSize: 13.5, color: "var(--ink2)", lineHeight: 1.55, marginTop: 14, fontWeight: 600,
};
