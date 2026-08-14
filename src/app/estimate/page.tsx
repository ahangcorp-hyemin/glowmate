"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import GlowGuide from "@/components/GlowGuide";
import GlowHero from "@/components/GlowHero";
import type { Concern } from "@/lib/catalog/rules";
import type { NearbyHospital } from "@/lib/hospitals/types";
import type { Estimate, EstimateItem, AgeBand, BudgetBand } from "@/lib/estimate/engine";
import { fetchConcerns, runEstimate, fetchNearbyHospitals, fetchRegionLabel } from "./actions";
import { fetchLessonIds } from "../learn/actions";
import Icon from "@/components/Icon";
import { getEstimateSnapshots } from "@/lib/client/saved";
import { track } from "@/lib/analytics";
import { REGIONS } from "@/lib/geo/region";
import { saveEstimateSnapshot } from "@/lib/client/saved";
import { saveLoc } from "@/lib/geo/loc";

// 분야별로 쪼갠 질문(화면당 선택지 적게)
const DOMAINS = [
  { id: "contour", title: "얼굴 윤곽·처짐 중\n신경 쓰이는 게 있나요?", ids: ["lift", "nasolabial", "jowl"], arrows: true },
  { id: "wrinkle", title: "주름은 어떠세요?", ids: ["wrinkle", "neck"], arrows: false },
  { id: "tone", title: "피부 톤·결은 어떠세요?", ids: ["pigment", "pore"], arrows: false },
  { id: "volume", title: "볼륨은 어떠세요?", ids: ["volume"], arrows: false },
];
const AGES: { v: AgeBand; l: string }[] = [{ v: "30대", l: "30대" }, { v: "40대", l: "40대" }, { v: "50대+", l: "50대 이상" }];
const BUDGETS: BudgetBand[] = ["~50만", "100–200만", "상관없음"];
const man = (won: number) => Math.round(won / 10000).toLocaleString();
const ANALYZE_MSG = ["고민을 하나씩 살펴보고 있어요", "3,000건 시술 데이터와 대조하는 중", "40·50대 같은 고민 사례를 찾는 중", "맞춤 견적을 정리하는 중"];

// stage: 0~3 도메인 / 4 연령 / 5 예산 / 6 분석중 / 7 탐색
const N_INPUT = DOMAINS.length + 2; // 6

const slide = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.25 } };
const card = (on: boolean): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%",
  minHeight: 60, padding: "15px 16px", borderRadius: 16, cursor: "pointer", fontFamily: "inherit",
  fontSize: 16, fontWeight: 700, lineHeight: 1.35,
  border: `1.5px solid ${on ? "var(--coral)" : "var(--line)"}`,
  background: on ? "var(--coral-soft)" : "var(--white)", color: on ? "var(--coral)" : "var(--ink)",
});

export default function EstimatePage() {
  const [started, setStarted] = useState(false);
  const [stage, setStage] = useState(0);
  const [hasPastEstimates, setHasPastEstimates] = useState(false);
  useEffect(() => { setHasPastEstimates(getEstimateSnapshots().length > 0); }, []);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [age, setAge] = useState<AgeBand | null>(null);
  const [budget, setBudget] = useState<BudgetBand | null>(null);
  const [result, setResult] = useState<Estimate | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [xi, setXi] = useState(0); // 탐색 카드 인덱스
  const [hosp, setHosp] = useState<EstimateItem | null>(null);
  const [hospRows, setHospRows] = useState<NearbyHospital[] | null>(null);
  const [detailHosp, setDetailHosp] = useState<NearbyHospital | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "location">("info");
  const [geoState, setGeoState] = useState<"locating" | "ready" | "needRegion">("locating");
  const [placeLabel, setPlaceLabel] = useState<string>("");
  const [concernsById, setConcernsById] = useState<Record<string, Concern>>({});
  const [lessonIds, setLessonIds] = useState<Set<string>>(new Set());
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const advTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggle = (id: string) => setConcerns((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const auto = (next: number) => { if (advTimer.current) clearTimeout(advTimer.current); advTimer.current = setTimeout(() => setStage(next), 320); };

  // 시작 시 위치 요청(D4: 허가 + 폴백). 여기서 받아두면 병원 화면에서 바로 근처가 뜬다.
  const start = () => {
    setStarted(true);
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); saveLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "" }); },
        () => {},
        { timeout: 10000, maximumAge: 600000 }
      );
    }
  };

  // 고민 목록(sentence/emoji) 서버에서 로드
  useEffect(() => {
    let alive = true;
    fetchConcerns().then((list) => {
      if (!alive) return;
      setConcernsById(Object.fromEntries(list.map((c) => [c.id, c])));
    });
    fetchLessonIds().then((ids) => { if (alive) setLessonIds(new Set(ids)); });
    return () => { alive = false; };
  }, []);

  // 좌표 기준 근처 병원 실데이터 로드(위치 or 지역폴백 공용)
  const loadNearby = (lat: number, lng: number, label: string, procId: string) => {
    setHospRows(null); setPlaceLabel(label); setGeoState("ready");
    fetchNearbyHospitals(lat, lng, procId).then(setHospRows);
    if (!label) fetchRegionLabel(lat, lng).then((l) => { if (l) setPlaceLabel(l); });
  };

  // 병원 오버레이: 시작 때 받아둔 위치가 있으면 즉시, 없으면 재요청 → 실패 시 지역 수동선택 폴백.
  useEffect(() => {
    if (!hosp) { setHospRows(null); setGeoState("locating"); setPlaceLabel(""); setDetailHosp(null); return; }
    const procId = hosp.procedureId;
    setGeoState("locating"); setHospRows(null); setPlaceLabel("");
    if (userLoc) { loadNearby(userLoc.lat, userLoc.lng, "", procId); return; }
    if (typeof navigator === "undefined" || !navigator.geolocation) { setGeoState("needRegion"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); loadNearby(pos.coords.latitude, pos.coords.longitude, "", procId); },
      () => setGeoState("needRegion"),
      { timeout: 8000, maximumAge: 300000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hosp]);

  useEffect(() => {
    if (stage !== 6) return;
    setMsgIdx(0);
    let alive = true;
    const int = setInterval(() => setMsgIdx((i) => Math.min(i + 1, ANALYZE_MSG.length - 1)), 700);
    const started = Date.now();
    runEstimate({ concerns, ageBand: age ?? "40대", budgetBand: budget ?? "상관없음" }).then((est) => {
      // 최소 2.6s 로더(노동 착시) 보장
      const wait = Math.max(0, 2600 - (Date.now() - started));
      setTimeout(() => {
        if (!alive) return;
        setResult(est); setXi(0); setStage(7);
        // '내 활동'용 스냅샷(가입 없이 이 기기에 저장)
        if (!est.needsConsult) saveEstimateSnapshot({
          at: new Date().toISOString(), concerns,
          items: est.items.map((i) => ({ nameKo: i.nameKo, role: i.role, priceMin: i.priceMin, priceMax: i.priceMax })),
          totalMin: est.totalMin, totalMax: est.totalMax,
        });
      }, wait);
    });
    return () => { alive = false; clearInterval(int); };
  }, [stage, concerns, age, budget]);

  const progress = stage < N_INPUT ? ((stage + 1) / N_INPUT) * 100 : 100;

  // ── 후킹 인트로(온보딩 시작) ──
  if (!started) {
    return (
      <main className="shell" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
        <div style={{ padding: "14px 22px 0", display: "flex", justifyContent: "flex-end" }}>
          <Link href="/" className="reset"><span className="chip" style={{ padding: "6px 12px" }}>닫기</span></Link>
        </div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "8px 22px 0" }}><GlowHero height={224} /></div>
          <div className="pad" style={{ marginTop: 4 }}>
            <div className="kick">60초 · 무료 · 가입 없이</div>
            <div className="h2" style={{ fontSize: 25, marginTop: 8, lineHeight: 1.32 }}>
              고민만 말해주세요.<br />나머지는 저희가 정리할게요.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 16 }}>
              {[
                ["search", "왜 이 시술인지 근거·출처까지"],
                ["shield", "예약 수수료 안 받아요 · 밀어붙이지 않아요"],
                ["sparkle", "40·50대 또래 고민 기준으로 조합"],
              ].map(([e, t]) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5, fontWeight: 700, color: "var(--ink2)" }}>
                  <span style={{ display: "flex", color: "var(--key-deep)" }}><Icon name={e} size={18} /></span>{t}
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }} />
          <div className="cta">
            {hasPastEstimates && (
              <Link href="/saved" className="reset">
                <p className="sub" style={{ textAlign: "center", marginBottom: 10, fontWeight: 700, textDecoration: "underline" }}>
                  지난 견적 다시 보기
                </p>
              </Link>
            )}
            <button className="btn" onClick={start}>내 고민부터 골라볼게요 →</button>
            <p className="disc" style={{ textAlign: "center", marginTop: 10 }}>
              가입 없이 60초 · 시작하면 <b>내 주변 병원</b>을 보여드리려 위치를 여쭤봐요(거부해도 이용 가능)
            </p>
          </div>
        </motion.div>
      </main>
    );
  }

  // ── 병원 상세 (탭: 정보 / 위치) + 문의 CTA ──
  if (detailHosp && hosp) {
    const d = detailHosp;
    const estbYear = d.estbDd ? new Date(d.estbDd).getFullYear() : null;
    const years = estbYear ? new Date().getFullYear() - estbYear : null;
    const tel = d.phone ? `tel:${d.phone.replace(/[^0-9]/g, "")}` : null;
    const q = encodeURIComponent(d.address || [d.name, d.district].filter(Boolean).join(" "));
    const mapEmbed = `https://maps.google.com/maps?q=${q}&z=16&hl=ko&output=embed`;
    const mapUrl = `https://map.kakao.com/?q=${encodeURIComponent([d.name, d.district].filter(Boolean).join(" "))}`;
    const home = d.homepageUrl ? (/^https?:\/\//.test(d.homepageUrl) ? d.homepageUrl : `http://${d.homepageUrl}`) : null;
    const badges: [string, string][] = [];
    if (years != null) badges.push(["calendar", `개원 ${years}년차`]);
    if (d.doctorCount != null) badges.push(["doctor", `의사 ${d.doctorCount}명`]);
    if (d.clNm) badges.push(["hospital", d.clNm]);
    if (d.isAd) badges.push(["📣", "광고 제휴"]);
    const cta = (label: string, href: string | null, primary = false) => href ? (
      <a href={href} target="_blank" rel="noopener noreferrer" className="reset" style={{ flex: 1 }}>
        <button className={primary ? "btn" : "btn ghost"} style={{ width: "100%" }}>{label}</button>
      </a>
    ) : null;
    const tab = (id: "info" | "location", label: string) => (
      <button onClick={() => setDetailTab(id)} style={{
        flex: 1, padding: "12px 0", fontFamily: "inherit", fontSize: 15, cursor: "pointer",
        fontWeight: detailTab === id ? 800 : 600, color: detailTab === id ? "var(--ink)" : "var(--muted)",
        background: "none", border: "none", borderBottom: `2px solid ${detailTab === id ? "var(--coral)" : "var(--line)"}`,
      }}>{label}</button>
    );
    return (
      <main className="shell" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
        <div className="backbar" style={{ display: "flex", alignItems: "center", gap: 6, padding: "16px 22px 6px" }}>
          <span style={{ fontSize: 22, color: "var(--ink2)", cursor: "pointer" }} onClick={() => setDetailHosp(null)}>‹</span>
          <span style={{ fontWeight: 800, fontSize: 17 }}>병원 상세</span>
        </div>

        <div className="pad">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
            <div className="h2" style={{ fontSize: 23, lineHeight: 1.25 }}>{d.name}</div>
          </div>
          <p className="sub" style={{ margin: "6px 0 10px" }}>{d.distanceKm.toFixed(1)}km · {d.district}</p>
          {badges.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 4 }}>
              {badges.map(([e, t]) => (
                <span key={t} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink2)", background: "var(--chip)", padding: "6px 10px", borderRadius: 999 }}>{e} {t}</span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", marginTop: 10 }}>{tab("info", "병원 정보")}{tab("location", "위치·지도")}</div>
        </div>

        <div className="pad" style={{ flex: 1, paddingTop: 14 }}>
          {detailTab === "info" && (
            <>
              <div className="estcard">
                <Info k="종별" v={d.clNm ?? "-"} />
                <Info k="주소" v={d.address ?? "-"} />
                <Info k="전화" v={d.phone ?? "-"} />
                {estbYear && <Info k="개원" v={`${estbYear}년${years != null ? ` (${years}년차)` : ""}`} />}
                {d.doctorCount != null && <Info k="의사 수" v={`${d.doctorCount}명`} />}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: "1px dashed #E7DAD3", marginTop: 10, paddingTop: 12 }}>
                  <span className="sub">{hosp.nameKo} · {hosp.priceUnit}</span>
                  {d.price != null
                    ? <span className="price" style={{ fontSize: 20 }}>{d.price.toLocaleString()}원</span>
                    : <span className="sub" style={{ fontWeight: 800 }}>공개가 없음 · 문의</span>}
                </div>
              </div>
              <div className="srcbox" style={{ marginTop: 10 }}>
                <div className="si"><span className="num">출처</span> 건강보험심사평가원 공개데이터(병원정보·비급여). 가짜 정보 없이 공식 데이터만 보여드려요.</div>
              </div>
              <p className="disc" style={{ marginTop: 10, lineHeight: 1.6 }}>
                실제 비용·시술 가능 여부는 상담에서 확인하세요. 아래 버튼은 병원 안내로 연결되며 예약·건당 수수료를 받지 않아요(§27).
              </p>
            </>
          )}

          {detailTab === "location" && (
            <>
              <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)" }}>
                <iframe title="지도" src={mapEmbed} style={{ width: "100%", height: 240, border: 0, display: "block" }} loading="lazy" />
              </div>
              <div className="estcard" style={{ marginTop: 10 }}>
                <Info k="주소" v={d.address ?? "-"} />
                {d.phone && <Info k="전화" v={d.phone} />}
              </div>
              <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="reset">
                <button className="btn ghost" style={{ marginTop: 10 }}>카카오맵에서 열기 →</button>
              </a>
            </>
          )}
        </div>

        <div className="cta" style={{ display: "flex", gap: 8 }}>
          {cta("전화 문의", tel, true)}
          {cta("길찾기", mapUrl)}
          {cta("홈페이지", home)}
        </div>
      </main>
    );
  }

  // ── 병원 오버레이 (실위치 기준 근처 병원) ──
  if (hosp) {
    const rows = hospRows ?? [];
    const picker = (
      <div style={{ marginTop: 8 }}>
        <p className="sub" style={{ marginBottom: 8 }}>지역을 골라주세요</p>
        <div className="chipwrap">
          {REGIONS.map((r) => (
            <button key={r.id} className="chip" onClick={() => loadNearby(r.lat, r.lng, r.label, hosp.procedureId)}>{r.label}</button>
          ))}
        </div>
      </div>
    );
    return (
      <main className="shell">
        <div className="backbar" style={{ display: "flex", alignItems: "center", gap: 6, padding: "16px 22px 6px" }}>
          <span style={{ fontSize: 22, color: "var(--ink2)", cursor: "pointer" }} onClick={() => setHosp(null)}>‹</span>
          <span style={{ fontWeight: 800, fontSize: 17 }}>{hosp.nameKo} · 근처 병원</span>
        </div>
        <div className="pad">
          {geoState === "locating" && <p className="sub" style={{ padding: "20px 2px" }}>내 위치로 근처 병원을 찾는 중…</p>}

          {geoState === "needRegion" && (
            <div style={{ padding: "6px 0" }}>
              <p className="sub" style={{ marginBottom: 4 }}>위치를 못 받았어요. 지역을 골라주시면 근처 병원을 보여드릴게요.</p>
              {picker}
            </div>
          )}

          {geoState === "ready" && (
            <>
              <p className="sub" style={{ margin: "4px 0 6px" }}>{placeLabel || "내 주변"} · 가까운 순 · {hosp.priceUnit} 공개가</p>
              {hospRows === null && <p className="sub" style={{ padding: "20px 2px" }}>근처 병원을 불러오는 중…</p>}

              {hospRows !== null && rows.length === 0 && (
                <div style={{ padding: "10px 0" }}>
                  <p className="sub" style={{ marginBottom: 10, lineHeight: 1.55 }}>이 위치엔 아직 등록된 실데이터가 없어요. 다른 지역으로 확인해볼까요?</p>
                  {picker}
                </div>
              )}

              {rows.map((h) => (
                <div key={h.id} onClick={() => { setDetailHosp(h); setDetailTab("info"); }}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 2px", borderBottom: "1px solid var(--line)", cursor: "pointer" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, display: "flex", gap: 7, alignItems: "center" }}>
                      {h.name}{h.isAd && <span style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", background: "var(--chip)", padding: "2px 6px", borderRadius: 5 }}>광고</span>}
                    </div>
                    <div className="sub" style={{ marginTop: 4 }}>
                      {h.distanceKm.toFixed(1)}km{h.district ? ` · ${h.district}` : ""}{h.doctorCount ? ` · 의사 ${h.doctorCount}명` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ textAlign: "right" }}>
                      {h.price != null ? (
                        <><div className="price" style={{ fontSize: 17 }}>{h.price.toLocaleString()}</div><div className="disc">원</div></>
                      ) : (
                        <div className="sub" style={{ fontWeight: 700 }}>문의</div>
                      )}
                    </div>
                    <span style={{ color: "var(--faint)", fontWeight: 800 }}>›</span>
                  </div>
                </div>
              ))}

              {hospRows !== null && rows.length > 0 && (
                <p className="disc" style={{ marginTop: 14, paddingBottom: 24 }}>
                  병원을 누르면 상세정보·전화·길찾기로 이동해요. 공개 비급여가 없는 시술은 '문의'로 표시돼요(건강보험심사평가원).
                  예약·시술 건당 수수료를 받지 않아요.
                </p>
              )}
            </>
          )}
        </div>
      </main>
    );
  }

  const items = result?.items ?? [];
  const isSummary = result && xi >= items.length; // 마지막 = 요약

  return (
    <main className="shell" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      {stage < 7 && (
        <div style={{ padding: "14px 22px 0" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link href="/" className="reset"><span className="chip" style={{ padding: "6px 12px" }}>닫기</span></Link>
          </div>
          {stage < N_INPUT && (
            <div style={{ height: 6, background: "var(--line)", borderRadius: 99, marginTop: 10, overflow: "hidden" }}>
              <motion.div style={{ height: "100%", background: "var(--coral)", borderRadius: 99 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
            </div>
          )}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ── 도메인 질문 (분야별) ── */}
        {stage < DOMAINS.length && (() => {
          const d = DOMAINS[stage];
          return (
            <motion.div key={d.id} {...slide} style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
              <div style={{ display: "grid", placeItems: "center", padding: "10px 0 2px" }}><GlowGuide mood="hi" arrows={d.arrows} size={110} /></div>
              <div className="pad">
                <div className="h2" style={{ whiteSpace: "pre-line" }}>{d.title}</div>
                <p className="sub" style={{ margin: "6px 0 14px" }}>해당되는 걸 골라주세요 · 없으면 그냥 넘어가도 돼요</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {d.ids.map((id) => {
                    const c = concernsById[id]; if (!c) return null;
                    const on = concerns.includes(id);
                    return (
                      <motion.button key={id} whileTap={{ scale: 0.98 }} onClick={() => toggle(id)} style={card(on)}>
                        <span style={{ fontSize: 22 }}>{c.emoji}</span>
                        <span style={{ flex: 1 }}>{c.sentence}</span>
                        <span style={{ color: "var(--coral)", fontWeight: 800, opacity: on ? 1 : 0 }}>✓</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
              <div className="cta">
                <button className="btn" onClick={() => setStage(stage + 1)}>
                  {d.ids.some((id) => concerns.includes(id)) ? "다음" : "해당 없어요"}
                </button>
              </div>
            </motion.div>
          );
        })()}

        {/* ── 연령 ── */}
        {stage === 4 && (
          <motion.div key="age" {...slide} style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={{ display: "grid", placeItems: "center", padding: "10px 0 2px" }}><GlowGuide mood="hi" size={110} /></div>
            <div className="pad">
              <div className="h2">연령대를 선택해 주세요</div>
              <p className="sub" style={{ margin: "6px 0 14px" }}>비슷한 또래의 시술 사례를 반영해요</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {AGES.map((a) => (
                  <motion.button key={a.v} whileTap={{ scale: 0.98 }} onClick={() => { setAge(a.v); auto(5); }}
                    style={{ ...card(age === a.v), fontSize: 17, fontWeight: 800 }}>{a.l}</motion.button>
                ))}
              </div>
            </div>
            <div className="cta"><button className="btn" disabled={!age} onClick={() => setStage(5)}>다음</button></div>
          </motion.div>
        )}

        {/* ── 예산 ── */}
        {stage === 5 && (
          <motion.div key="budget" {...slide} style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={{ display: "grid", placeItems: "center", padding: "10px 0 2px" }}><GlowGuide mood="hi" size={110} /></div>
            <div className="pad">
              <div className="h2">예산은 어느 정도<br />생각하고 계세요?</div>
              <p className="sub" style={{ margin: "6px 0 14px" }}>정확하지 않아도 괜찮아요. 대략만 골라주세요</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {BUDGETS.map((b) => (
                  <motion.button key={b} whileTap={{ scale: 0.98 }} onClick={() => { setBudget(b); auto(6); }}
                    style={{ ...card(budget === b), fontSize: 17, fontWeight: 800 }}>{b}</motion.button>
                ))}
              </div>
            </div>
            <div className="cta">
              <button className="btn" disabled={!budget} onClick={() => setStage(6)}>내 견적 보기</button>
              <p className="disc" style={{ textAlign: "center", marginTop: 10 }}>견적은 정보 제공이며 의료 진단이 아니에요</p>
            </div>
          </motion.div>
        )}

        {/* ── 분석중 ── */}
        {stage === 6 && (
          <motion.div key="analyzing" {...slide} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 22px" }}>
            <GlowGuide mood="think" size={148} />
            <div style={{ height: 6, width: 200, background: "var(--line)", borderRadius: 99, overflow: "hidden", marginTop: 24 }}>
              <motion.div style={{ height: "100%", background: "var(--coral)" }} initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 2.9, ease: "easeInOut" }} />
            </div>
            <AnimatePresence mode="wait">
              <motion.p key={msgIdx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} style={{ marginTop: 18, fontSize: 15, fontWeight: 700, color: "var(--ink2)" }}>
                {ANALYZE_MSG[msgIdx]}…
              </motion.p>
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── 탐색: 한 페이지당 시술 1개 ── */}
        {stage === 7 && result && result.needsConsult && (
          <motion.div key="consult" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ flex: 1 }}>
            <div className="pad" style={{ paddingTop: 24 }}>
              <div className="card">{result.answerBlocks[0].text}</div>
              <Link href="/" className="reset"><button className="btn ghost" style={{ marginTop: 14 }}>처음으로</button></Link>
            </div>
          </motion.div>
        )}

        {stage === 7 && result && !result.needsConsult && !isSummary && (() => {
          const it = items[xi];
          return (
            <motion.div key={"x" + xi} {...slide} style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 22px 2px" }}>
                <span className="kick">나에게 맞는 시술 · {xi + 1}/{items.length}</span>
                <div style={{ display: "flex", gap: 5 }}>
                  {items.map((_, i) => <span key={i} style={{ width: 7, height: 7, borderRadius: 99, background: i === xi ? "var(--coral)" : "var(--line)" }} />)}
                </div>
              </div>
              <div style={{ display: "grid", placeItems: "center", padding: "6px 0 2px" }}><GlowGuide mood="happy" size={96} /></div>
              <div className="pad">
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div className="h2" style={{ fontSize: 25 }}>{it.nameKo}</div>
                  <span className="badge">{it.role === "base" ? "베이스" : it.role === "addon" ? "재생·결" : "선택"}</span>
                </div>
                <p className="sub" style={{ margin: "6px 0 14px", color: "var(--ink2)", fontWeight: 600 }}>{it.tagline}</p>

                <div className="estcard">
                  <div className="kick">왜 나에게 맞나요?</div>
                  <p style={{ fontSize: 15, color: "var(--ink)", fontWeight: 700, margin: "8px 0 0", lineHeight: 1.5 }}>{it.rationale}</p>
                  <p className="sub" style={{ marginTop: 10, lineHeight: 1.6 }}>{it.mechanism}
                    {it.sources.slice(0, 2).map((_, i) => <sup className="ref" key={i}> [{i + 1}]</sup>)}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: "1px dashed #E7DAD3", marginTop: 12, paddingTop: 12 }}>
                    <div><div className="sub">예상 가격대 · {it.sessions}</div></div>
                    <div className="price" style={{ fontSize: 20 }}>{man(it.priceMin)}–{man(it.priceMax)}만<span className="disc" style={{ fontWeight: 400 }}> {it.priceUnit}</span></div>
                  </div>
                </div>

                {lessonIds.has(it.procedureId) && (
                  <Link href={`/learn/${it.procedureId}`} className="reset">
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "var(--coral-soft)", border: "1.5px solid var(--coral)", borderRadius: 14, padding: "13px 15px", cursor: "pointer" }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--coral-strong)" }}>병원 가기 전, {it.nameKo} 알고 가기</div>
                        <div className="disc" style={{ marginTop: 2 }}>깊이·효과·가격·후기 보는 법까지 5분 정리</div>
                      </div>
                      <span style={{ color: "var(--coral)", fontWeight: 900, fontSize: 18 }}>→</span>
                    </div>
                  </Link>
                )}
                <div className="disc" style={{ marginTop: 10, background: "var(--chip)", borderRadius: 12, padding: "10px 12px" }}>⚠ 이런 분은 상담이 필요해요 — {it.contraindication}</div>
                <div className="srcbox" style={{ marginTop: 10 }}>
                  <div className="sub" style={{ fontWeight: 800, marginBottom: 6 }}>🔖 출처</div>
                  {it.sources.map((s, i) => <div className="si" key={i}><span className="num">[{i + 1}]</span> {s.label}</div>)}
                </div>
              </div>
              <div className="cta" style={{ display: "flex", gap: 8 }}>
                {xi > 0 && <button className="btn ghost" style={{ width: 96 }} onClick={() => setXi(xi - 1)}>이전</button>}
                <button className="btn" style={{ flex: 1 }} onClick={() => setHosp(it)}>이 시술 병원 보기 →</button>
                <button className="btn ghost" style={{ width: 96 }} onClick={() => setXi(xi + 1)}>{xi === items.length - 1 ? "요약" : "다음"}</button>
              </div>
            </motion.div>
          );
        })()}

        {/* ── 요약 ── */}
        {stage === 7 && result && !result.needsConsult && isSummary && (
          <motion.div key="summary" {...slide} style={{ flex: 1, overflowY: "auto" }}>
            <div className="top"><div className="logo">견적 <span className="m">요약</span></div>
              <button className="chip" style={{ padding: "6px 12px" }} onClick={() => { setResult(null); setConcerns([]); setAge(null); setBudget(null); setStage(0); }}>다시</button></div>
            <div className="pad">
              {/* 도착 프레이밍(#67 B7, UX_WRITING §1·§2) */}
              <div className="h2" style={{ fontSize: 21, margin: "2px 0 4px" }}>맞춤 시술 조합이 도착했어요</div>
              <p className="sub" style={{ marginBottom: 12, lineHeight: 1.55 }}>
                병원 상담 전에 조합·비용·근거를 비교해보세요.
              </p>

              {/* 조건 요약(#67 B6) — 모두닥 '최근 설정한 조건' 문법 */}
              <div className="card" style={{ padding: "12px 16px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="kick">내가 고른 조건</div>
                  <button onClick={() => { setResult(null); setStage(0); }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--key-deep)", fontFamily: "inherit", padding: 0 }}>
                    수정하기
                  </button>
                </div>
                <div className="sub" style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.6 }}>
                  {concerns.map((id) => concernsById[id]?.nameKo).filter(Boolean).join(" · ") || "고민 미선택"}
                  {age ? ` · ${age}` : ""}{budget ? ` · 예산 ${budget}` : ""}
                </div>
              </div>

              <div className="estcard">
                <div className="kick">추천 시술 조합</div>
                {items.map((it) => (
                  <div key={it.procedureId} onClick={() => setHosp(it)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)", cursor: "pointer" }}>
                    <div><span style={{ fontWeight: 800 }}>{it.nameKo}</span> <span className="badge">{it.role === "base" ? "베이스" : it.role === "addon" ? "재생·결" : "선택"}</span></div>
                    <span className="price">{man(it.priceMin)}–{man(it.priceMax)}만 ›</span>
                  </div>
                ))}
                {result.totalMin != null && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12 }}>
                    <span className="sub">예상 총 비용(병원별 상이)</span>
                    <span className="price" style={{ fontSize: 22 }}>{man(result.totalMin)}–{man(result.totalMax!)}만</span>
                  </div>
                )}
              </div>
              <div className="card answer" style={{ marginTop: 14 }}>
                {result.answerBlocks.map((b, i) => <p key={i}>{b.text}{b.refs.map((n) => <sup className="ref" key={n}>[{n}]</sup>)}</p>)}
                <div className="srcbox">
                  <div className="sub" style={{ fontWeight: 800, marginBottom: 6 }}>🔖 출처</div>
                  {result.sources.map((s) => <div className="si" key={s.n}><span className="num">[{s.n}]</span> {s.label}</div>)}
                </div>
              </div>
              <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => setXi(0)}>시술 하나씩 다시 보기</button>
              <Link href="/" className="reset"><button className="btn ghost" style={{ marginTop: 10 }}>처음으로</button></Link>
              <div style={{ height: 24 }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--line)" }}>
      <span className="sub" style={{ flexShrink: 0 }}>{k}</span>
      <span style={{ fontWeight: 600, fontSize: 13.5, textAlign: "right" }}>{v}</span>
    </div>
  );
}
