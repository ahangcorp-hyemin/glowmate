"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import GlowGuide from "@/components/GlowGuide";
import type { LessonCard, LessonContent, ReviewSample } from "@/lib/lessons/types";
import { fetchLesson } from "../actions";

const won = (n: number) => n.toLocaleString();
const slide = { initial: { opacity: 0, x: 28 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -28 }, transition: { duration: 0.25 } };

export default function LessonPage() {
  const { procedureId } = useParams<{ procedureId: string }>();
  const [lesson, setLesson] = useState<LessonContent | null>(null);
  const [i, setI] = useState(0);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => { if (procedureId) fetchLesson(procedureId).then(setLesson); }, [procedureId]);

  const cards = lesson?.cards ?? [];
  const card = cards[i];
  // 카드 바뀔 때 '다음' 게이트 초기화 — 상호작용 없는 카드는 바로 열어줌
  useEffect(() => {
    if (!card) return;
    const noGate = ["intro", "realReviews", "questionSheet", "done"];
    setCanNext(noGate.includes(card.kind));
  }, [i, card]);

  if (!lesson) {
    return <main className="shell" style={{ display: "grid", placeItems: "center", minHeight: "100dvh" }}>
      <p className="sub">레슨을 불러오는 중…</p>
    </main>;
  }

  const last = i >= cards.length - 1;
  const progress = ((i + 1) / cards.length) * 100;

  return (
    <main className="shell" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      {/* 상단: 진행바 + 닫기 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px 0" }}>
        <div style={{ flex: 1, height: 8, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}>
          <motion.div style={{ height: "100%", background: "var(--coral)", borderRadius: 99 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        </div>
        <Link href="/" className="reset"><span style={{ fontSize: 20, color: "var(--muted)" }}>✕</span></Link>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={i} {...slide} style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
          <CardView card={card} onReady={() => setCanNext(true)} />
        </motion.div>
      </AnimatePresence>

      {/* 하단 CTA */}
      <div className="cta">
        {card.kind === "done" ? (
          <>
            <Link href="/estimate" className="reset"><button className="btn">우리 동네 병원 참고가 보기 →</button></Link>
            <Link href="/" className="reset"><button className="btn ghost" style={{ marginTop: 8 }}>처음으로</button></Link>
          </>
        ) : (
          <button className="btn" disabled={!canNext} onClick={() => !last && setI(i + 1)}>
            {canNext ? "다음" : "위에서 눌러보세요"}
          </button>
        )}
      </div>
    </main>
  );
}

function CardView({ card, onReady }: { card: LessonCard; onReady: () => void }) {
  switch (card.kind) {
    case "intro": return <Intro card={card} />;
    case "layers": return <Layers card={card} onReady={onReady} />;
    case "timeline": return <Timeline card={card} onReady={onReady} />;
    case "compare": return <Compare card={card} onReady={onReady} />;
    case "contra": return <Contra card={card} onReady={onReady} />;
    case "price": return <PriceSim card={card} onReady={onReady} />;
    case "reviewLiteracy": return <ReviewLiteracy card={card} onReady={onReady} />;
    case "realReviews": return <RealReviews card={card} />;
    case "questionSheet": return <QuestionSheet card={card} />;
    case "done": return <Done card={card} />;
  }
}

function Head({ kick, title, prompt }: { kick?: string; title: string; prompt?: string }) {
  return (
    <div className="pad" style={{ paddingTop: 6 }}>
      {kick && <div className="kick">{kick}</div>}
      <div className="h2" style={{ fontSize: 23, marginTop: 6, lineHeight: 1.3 }}>{title}</div>
      {prompt && <p className="sub" style={{ marginTop: 8, lineHeight: 1.5 }}>{prompt}</p>}
    </div>
  );
}

// ── intro ──
function Intro({ card }: { card: Extract<LessonCard, { kind: "intro" }> }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "grid", placeItems: "center", marginTop: 24 }}><GlowGuide mood="happy" size={132} /></div>
      <Head title={card.title} prompt={card.subtitle} />
    </div>
  );
}

// ── layers: 피부 단면 + 깊이별 열응고점 ──
function Layers({ card, onReady }: { card: Extract<LessonCard, { kind: "layers" }>; onReady: () => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const bands = [
    { name: "표피", y: 24, h: 22, fill: "#F7E7DE" },
    { name: "진피", y: 46, h: 66, fill: "#F3D4C6" },
    { name: "SMAS 근막", y: 112, h: 40, fill: "#E9B7A3" },
    { name: "지방층", y: 152, h: 34, fill: "#F6E3D0" },
  ];
  const yOf = (mm: number) => 24 + (mm / 4.5) * 128; // 0mm=표피 상단, 4.5mm=SMAS 하단쯤
  const active = sel != null ? card.depths[sel] : null;

  return (
    <div>
      <Head title={card.title} prompt={card.prompt} />
      <div className="pad" style={{ marginTop: 8 }}>
        <svg viewBox="0 0 300 200" style={{ width: "100%", borderRadius: 16, background: "var(--chip)" }}>
          {bands.map((b) => (
            <g key={b.name}>
              <rect x="24" y={b.y} width="252" height={b.h} fill={b.fill} />
              <text x="32" y={b.y + b.h / 2 + 4} fontSize="9" fontWeight="700" fill="#8C6A58">{b.name}</text>
            </g>
          ))}
          {active && (
            <>
              {[130, 150, 170].map((x) => (
                <motion.circle key={x} cx={x} cy={yOf(active.mm)} r="4" fill="var(--coral)"
                  animate={{ r: [3, 6, 3], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1, repeat: Infinity }} />
              ))}
              <motion.line x1="150" y1="12" x2="150" y2={yOf(active.mm)} stroke="var(--coral)" strokeWidth="2" strokeDasharray="3 3"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
              <text x="150" y="10" fontSize="10" fontWeight="800" fill="var(--coral)" textAnchor="middle">{active.mm}mm</text>
            </>
          )}
        </svg>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {card.depths.map((d, idx) => (
            <button key={idx} onClick={() => { setSel(idx); onReady(); }}
              className="chip" style={{ flex: 1, textAlign: "center", ...(sel === idx ? { borderColor: "var(--coral)", background: "var(--coral-soft)", color: "var(--coral)" } : {}) }}>
              {d.mm}mm
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          {active && (
            <motion.div key={sel} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="estcard" style={{ marginTop: 12, padding: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{active.layer}</div>
              <p className="sub" style={{ marginTop: 6, lineHeight: 1.5 }}>{active.note}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── timeline: 슬라이드로 효과 경과 ──
function Timeline({ card, onReady }: { card: Extract<LessonCard, { kind: "timeline" }>; onReady: () => void }) {
  const [day, setDay] = useState(0);
  const maxDay = card.points[card.points.length - 1].day;
  const active = useMemo(() => [...card.points].reverse().find((p) => day >= p.day) ?? card.points[0], [day, card.points]);
  const prog = Math.round((day / maxDay) * 100); // 시간 경과 막대(효능 % 아님)
  return (
    <div>
      <Head title={card.title} prompt={card.prompt} />
      <div className="pad" style={{ marginTop: 12 }}>
        <div className="estcard" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="kick">{day === 0 ? "시술 직후" : `${day}일 후`}</span>
            <span className="sub" style={{ fontWeight: 700 }}>경과 {day}/{maxDay}일</span>
          </div>
          <div style={{ height: 10, background: "var(--line)", borderRadius: 99, overflow: "hidden", margin: "10px 0 14px" }}>
            <motion.div style={{ height: "100%", background: "var(--coral)", borderRadius: 99 }} animate={{ width: `${prog}%` }} transition={{ type: "spring", stiffness: 120, damping: 18 }} />
          </div>
          <input type="range" min={0} max={maxDay} step={1} value={day}
            onChange={(e) => { setDay(+e.target.value); onReady(); }}
            style={{ width: "100%", accentColor: "var(--coral)" }} />
          <AnimatePresence mode="wait">
            <motion.p key={active.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ fontSize: 15, fontWeight: 700, marginTop: 12, lineHeight: 1.5 }}>{active.label}</motion.p>
          </AnimatePresence>
        </div>
        <div className="disc" style={{ marginTop: 10, background: "var(--chip)", borderRadius: 12, padding: "11px 13px", lineHeight: 1.6 }}>
          ⚠ {card.reality}
        </div>
      </div>
    </div>
  );
}

// ── compare: 탭으로 대안 비교 ──
function Compare({ card, onReady }: { card: Extract<LessonCard, { kind: "compare" }>; onReady: () => void }) {
  const [sel, setSel] = useState(card.options[0].id);
  const opt = card.options.find((o) => o.id === sel)!;
  return (
    <div>
      <Head title={card.title} prompt={card.prompt} />
      <div className="pad" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {card.options.map((o) => (
            <button key={o.id} onClick={() => { setSel(o.id); onReady(); }}
              className="chip" style={{ flex: 1, textAlign: "center", ...(sel === o.id ? { borderColor: "var(--coral)", background: "var(--coral-soft)", color: "var(--coral)" } : {}) }}>
              {o.name}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={sel} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="estcard" style={{ marginTop: 12, padding: 18 }}>
            <Stat label="작용 깊이" val={`${opt.depthMm}mm`} pct={(opt.depthMm / 4.5) * 100} />
            <Stat label="유지 기간" val={opt.keep} pct={70} />
            <Row label="통증"><Dots n={opt.pain} /></Row>
            <p className="sub" style={{ marginTop: 12, lineHeight: 1.5 }}>{opt.note}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}><span className="sub">{label}</span>{children}</div>;
}
function Stat({ label, val, pct }: { label: string; val: string; pct: number }) {
  return (
    <div style={{ padding: "7px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span className="sub">{label}</span><span style={{ fontWeight: 800, fontSize: 14 }}>{val}</span></div>
      <div style={{ height: 7, background: "var(--line)", borderRadius: 99, overflow: "hidden", marginTop: 5 }}>
        <motion.div style={{ height: "100%", background: "var(--coral)", borderRadius: 99 }} initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct)}%` }} transition={{ duration: 0.5 }} />
      </div>
    </div>
  );
}
function Dots({ n }: { n: number }) {
  return <span style={{ display: "flex", gap: 4 }}>{[1, 2, 3, 4, 5].map((k) => <span key={k} style={{ width: 9, height: 9, borderRadius: 99, background: k <= n ? "var(--coral)" : "var(--line)" }} />)}</span>;
}

// ── contra: 금기 셀프체크 ──
function Contra({ card, onReady }: { card: Extract<LessonCard, { kind: "contra" }>; onReady: () => void }) {
  const [sel, setSel] = useState<number | null>(null);
  const active = sel != null ? card.options[sel] : null;
  return (
    <div>
      <Head title={card.title} prompt={card.prompt} />
      <div className="pad" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 9 }}>
        {card.options.map((o, idx) => (
          <button key={idx} onClick={() => { setSel(idx); onReady(); }}
            className="chip" style={{ textAlign: "left", ...(sel === idx ? { borderColor: o.safe ? "var(--hi)" : "var(--coral)", background: o.safe ? "var(--hi-bg)" : "var(--coral-soft)", color: o.safe ? "var(--hi)" : "var(--coral)" } : {}) }}>
            {o.label}
          </button>
        ))}
        <AnimatePresence mode="wait">
          {active && (
            <motion.div key={sel} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="estcard" style={{ marginTop: 4, padding: 15, borderColor: active.safe ? "var(--hi-bg)" : "var(--coral-soft)" }}>
              <div style={{ fontWeight: 800, color: active.safe ? "var(--hi)" : "var(--coral)" }}>{active.safe ? "✓ 진행 가능해 보여요" : "⚠ 상담이 필요해요"}</div>
              <p className="sub" style={{ marginTop: 6, lineHeight: 1.5 }}>{active.note}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── price: 샷수 슬라이드 → 가격 ──
function PriceSim({ card, onReady }: { card: Extract<LessonCard, { kind: "price" }>; onReady: () => void }) {
  const [shots, setShots] = useState(300);
  const price = shots * card.unitWon;
  const low = shots < card.lowWarnBelow;
  return (
    <div>
      <Head title={card.title} prompt={card.prompt} />
      <div className="pad" style={{ marginTop: 12 }}>
        <div className="estcard" style={{ padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontWeight: 800 }}>{shots}샷</span>
            <span className="price" style={{ fontSize: 22 }}>약 {won(price)}원</span>
          </div>
          <input type="range" min={card.minUnit} max={card.maxUnit} step={card.step} value={shots}
            onChange={(e) => { setShots(+e.target.value); onReady(); }}
            style={{ width: "100%", accentColor: "var(--coral)", marginTop: 14 }} />
          <div className="sub" style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span>{card.minUnit}샷</span><span>{card.maxUnit}샷</span></div>
        </div>
        <AnimatePresence>
          {low && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="disc" style={{ marginTop: 10, background: "var(--coral-soft)", color: "var(--coral)", borderRadius: 12, padding: "11px 13px", lineHeight: 1.6, fontWeight: 700 }}>
              🚩 {card.lowWarn}
            </motion.div>
          )}
        </AnimatePresence>
        <p className="disc" style={{ marginTop: 10, lineHeight: 1.6 }}>{card.note}</p>
      </div>
    </div>
  );
}

// ── reviewLiteracy: 스와이프로 신뢰/의심 판별 ──
function ReviewLiteracy({ card, onReady }: { card: Extract<LessonCard, { kind: "reviewLiteracy" }>; onReady: () => void }) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<{ correct: boolean; s: ReviewSample } | null>(null);
  const done = idx >= card.samples.length;

  const judge = (choseTrust: boolean) => {
    const s = card.samples[idx];
    const correct = choseTrust === s.trustworthy;
    if (correct) setScore((v) => v + 1);
    setResult({ correct, s });
    setTimeout(() => {
      setResult(null);
      const next = idx + 1;
      setIdx(next);
      if (next >= card.samples.length) onReady();
    }, 1500);
  };

  return (
    <div>
      <Head title={card.title} prompt={card.prompt} />
      <div className="pad" style={{ marginTop: 8 }}>
        {!done ? (
          <>
            <div style={{ position: "relative", height: 230, marginTop: 6 }}>
              <AnimatePresence>
                {result ? (
                  <motion.div key="res" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                    className="estcard" style={{ position: "absolute", inset: 0, padding: 18, display: "flex", flexDirection: "column", justifyContent: "center", borderColor: result.correct ? "var(--hi-bg)" : "var(--coral-soft)" }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: result.correct ? "var(--hi)" : "var(--coral)" }}>
                      {result.correct ? "정답이에요 ✓" : "다시 볼까요"} · {result.s.trustworthy ? "신뢰" : "의심"} 후기
                    </div>
                    <p className="sub" style={{ marginTop: 8, lineHeight: 1.5 }}>{result.s.flag}</p>
                  </motion.div>
                ) : (
                  <SwipeCard key={idx} sample={card.samples[idx]} onChoose={judge} />
                )}
              </AnimatePresence>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => !result && judge(false)}>의심 ✕</button>
              <button className="btn ghost" style={{ flex: 1, borderColor: "var(--hi)", color: "var(--hi)" }} onClick={() => !result && judge(true)}>신뢰 ✓</button>
            </div>
            <p className="sub" style={{ textAlign: "center", marginTop: 10 }}>{idx + 1} / {card.samples.length}</p>
          </>
        ) : (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="estcard" style={{ padding: 20, textAlign: "center", marginTop: 8 }}>
            <div style={{ display: "grid", placeItems: "center", marginBottom: 8 }}><GlowGuide mood="happy" size={92} /></div>
            <div style={{ fontWeight: 800, fontSize: 17 }}>{card.samples.length}개 중 {score}개 맞혔어요</div>
            <p className="sub" style={{ marginTop: 8, lineHeight: 1.5 }}>이제 광고성 후기랑 진짜 후기를 구별할 수 있어요.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function SwipeCard({ sample, onChoose }: { sample: ReviewSample; onChoose: (choseTrust: boolean) => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-160, 160], [-12, 12]);
  const trustOp = useTransform(x, [20, 120], [0, 1]);
  const doubtOp = useTransform(x, [-120, -20], [1, 0]);
  return (
    <motion.div
      style={{ position: "absolute", inset: 0, x, rotate, cursor: "grab" }}
      drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.6}
      onDragEnd={(_, info) => { if (info.offset.x > 110) onChoose(true); else if (info.offset.x < -110) onChoose(false); }}
      whileTap={{ cursor: "grabbing" }}
    >
      <div className="card" style={{ height: "100%", padding: 20, display: "flex", alignItems: "center", position: "relative" }}>
        <motion.span style={{ position: "absolute", top: 14, left: 14, opacity: doubtOp, color: "var(--coral)", fontWeight: 800, border: "2px solid var(--coral)", borderRadius: 8, padding: "2px 8px", fontSize: 13 }}>의심</motion.span>
        <motion.span style={{ position: "absolute", top: 14, right: 14, opacity: trustOp, color: "var(--hi)", fontWeight: 800, border: "2px solid var(--hi)", borderRadius: 8, padding: "2px 8px", fontSize: 13 }}>신뢰</motion.span>
        <p style={{ fontSize: 15.5, lineHeight: 1.6, fontWeight: 600, color: "var(--ink)" }}>“{sample.body}”</p>
      </div>
    </motion.div>
  );
}

// ── realReviews: 진짜 후기 탐색 ──
function RealReviews({ card }: { card: Extract<LessonCard, { kind: "realReviews" }> }) {
  return (
    <div>
      <Head title={card.title} prompt={card.prompt} />
      <div className="pad" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8 }}>
        {card.reviews.map((r, idx) => (
          <div key={idx} className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span className="badge">{r.ageBand}</span>
                <span className="badge">{r.concern}</span>
                {r.verified && <span style={{ fontSize: 11, fontWeight: 800, color: "var(--hi)" }}>✓ 인증</span>}
              </div>
              <span style={{ color: "var(--coral)", fontSize: 13, letterSpacing: 1 }}>{"★".repeat(r.rating)}<span style={{ color: "var(--line)" }}>{"★".repeat(5 - r.rating)}</span></span>
            </div>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--ink2)" }}>{r.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── questionSheet: 상담 질문지(공유/저장) ──
function QuestionSheet({ card }: { card: Extract<LessonCard, { kind: "questionSheet" }> }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setChecked((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  return (
    <div>
      <Head title={card.title} prompt={card.intro} />
      <div className="pad" style={{ marginTop: 10 }}>
        <div className="estcard" style={{ padding: 18 }}>
          <div className="kick" style={{ marginBottom: 10 }}>🔖 상담 질문 체크리스트</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {card.questions.map((q, i) => (
              <button key={i} onClick={() => toggle(i)} style={{ display: "flex", gap: 11, alignItems: "flex-start", textAlign: "left", background: "none", border: "none", padding: "9px 0", cursor: "pointer", fontFamily: "inherit", borderBottom: i < card.questions.length - 1 ? "1px solid var(--line)" : "none" }}>
                <span style={{ flex: "0 0 22px", width: 22, height: 22, borderRadius: 7, border: `2px solid ${checked.has(i) ? "var(--coral)" : "var(--faint)"}`, background: checked.has(i) ? "var(--coral)" : "transparent", color: "#fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 900, marginTop: 1 }}>{checked.has(i) ? "✓" : ""}</span>
                <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.45, color: checked.has(i) ? "var(--muted)" : "var(--ink)", textDecoration: checked.has(i) ? "line-through" : "none" }}>{q}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={() => alert("카카오톡 공유 (연동 예정)")}>카톡으로 공유</button>
          <button className="btn ghost" style={{ flex: 1 }} onClick={() => alert("이미지로 저장 (연동 예정)")}>⬇ 저장</button>
        </div>
        <p className="disc" style={{ marginTop: 10, lineHeight: 1.6 }}>이 질문지는 의료 진단이 아니라 정보 제공이에요. 실제 판단은 병원 상담에서 확인하세요.</p>
      </div>
    </div>
  );
}

// ── done ──
function Done({ card }: { card: Extract<LessonCard, { kind: "done" }> }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 22px", textAlign: "center" }}>
      <GlowGuide mood="happy" size={140} />
      <div className="h2" style={{ fontSize: 24, marginTop: 16 }}>{card.title}</div>
      <p className="sub" style={{ marginTop: 10, lineHeight: 1.5 }}>{card.subtitle}</p>
    </div>
  );
}
