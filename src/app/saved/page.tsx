"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TabBar from "@/components/TabBar";
import HeartButton from "@/components/HeartButton";
import { getSavedHospitalIds, getEstimateSnapshots, getVisitRecords, getTreatments, removeTreatment, getQuoteRecords, type EstimateSnapshot, type VisitRecord, type TreatmentRecord, type QuoteRecord } from "@/lib/client/saved";
import { renewalWeeksOf } from "@/lib/catalog/renewal";
import { PROCEDURES } from "@/lib/catalog/procedures";
import { track } from "@/lib/analytics";
import { fetchHospitalsByIds } from "../hospitals/actions";
import type { NearbyHospital } from "@/lib/hospitals/types";

// '내 활동' — 가입 없이 이 기기에 저장된 것들(찜 병원·최근 견적). 미모먼트 마이페이지의 무가입 버전.
const man = (won: number) => Math.round(won / 10000).toLocaleString();

export default function SavedPage() {
  const [hospitals, setHospitals] = useState<NearbyHospital[] | null>(null);
  const [estimates, setEstimates] = useState<EstimateSnapshot[]>([]);
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [treatments, setTreatments] = useState<TreatmentRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);

  useEffect(() => {
    setEstimates(getEstimateSnapshots());
    setVisits(getVisitRecords());
    setTreatments(getTreatments());
    setQuotes(getQuoteRecords());
    const ids = getSavedHospitalIds();
    if (!ids.length) { setHospitals([]); return; }
    fetchHospitalsByIds(ids).then(setHospitals);
  }, []);

  return (
    <main className="shell" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <div className="top">
        <div className="logo">내 <span className="m">활동</span></div>
      </div>
      <div className="pad" style={{ flex: 1 }}>
        <p className="disc" style={{ marginBottom: 16, lineHeight: 1.55 }}>
          가입 없이 이 기기에만 저장돼요. 기기를 바꾸면 사라지니 중요한 건 캡처해두세요.
        </p>

        {quotes.length > 0 && (
          <>
            <div className="kick" style={{ marginBottom: 8 }}>내 견적 요청</div>
            <div className="card" style={{ padding: "4px 14px 8px", marginBottom: 18 }}>
              {quotes.map((q, i) => (
                <Link key={q.id} href={`/quote/${q.id}`} className="reset">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: i < quotes.length - 1 ? "1px solid var(--line)" : "none" }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14.5 }}>{q.label}</div>
                      <div className="sub" style={{ marginTop: 3, fontSize: 12.5 }}>{new Date(q.at).toLocaleDateString("ko-KR")} 요청 · 받은 견적 보기</div>
                    </div>
                    <span style={{ color: "var(--key-deep)", fontWeight: 800 }}>›</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {treatments.length > 0 && (
          <>
            <div className="kick" style={{ marginBottom: 8 }}>시술 기록 · 다음 시기</div>
            <div className="card" style={{ padding: "4px 14px 10px", marginBottom: 18 }}>
              {treatments.map((t, i) => {
                const p = PROCEDURES.find((x) => x.id === t.procedureId);
                const rw = renewalWeeksOf(t.procedureId);
                let dday: number | null = null;
                if (rw != null) {
                  const due = new Date(t.date); due.setDate(due.getDate() + rw * 7);
                  dday = Math.ceil((due.getTime() - Date.now()) / 86400000);
                }
                return (
                  <div key={`${t.procedureId}-${t.date}`} style={{ padding: "11px 0", borderBottom: i < treatments.length - 1 ? "1px solid var(--line)" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: 14.5 }}>{p?.nameKo ?? t.procedureId}</span>
                        <span className="sub" style={{ marginLeft: 8, fontSize: 12.5 }}>{t.date}</span>
                      </div>
                      <button onClick={() => { removeTreatment(t.procedureId, t.date); setTreatments(getTreatments()); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--faint)", fontSize: 12, fontFamily: "inherit" }}>삭제</button>
                    </div>
                    {dday != null && (
                      <Link href="/estimate" className="reset" onClick={() => track("ledger_banner_click", { from: "saved" })}>
                        <div className="sub" style={{ marginTop: 4, fontSize: 13 }}>
                          {dday > 0
                            ? <>다음 권장 시기까지 <b style={{ color: "var(--key-deep)" }}>D-{dday}</b></>
                            : <><b style={{ color: "var(--key-deep)" }}>권장 시기가 지났어요</b> — 지금 견적 보기 ›</>}
                        </div>
                      </Link>
                    )}
                  </div>
                );
              })}
              <p className="disc" style={{ margin: "8px 0 4px", lineHeight: 1.5 }}>
                권장 주기는 일반적 기준이에요. 실제 시기는 병원 상담에서 확인하세요.
              </p>
            </div>
          </>
        )}

        {visits.length > 0 && (
          <>
            <div className="kick" style={{ marginBottom: 8 }}>방문 희망 내역</div>
            <div className="card" style={{ padding: "4px 14px 8px", marginBottom: 18 }}>
              {visits.map((v, i) => (
                <Link key={i} href={`/hospital/${v.hospitalId}`} className="reset">
                  <div style={{ padding: "11px 0", borderBottom: i < visits.length - 1 ? "1px solid var(--line)" : "none" }}>
                    <div style={{ fontWeight: 800, fontSize: 14.5 }}>{v.hospitalName}</div>
                    <div className="sub" style={{ marginTop: 3 }}>
                      {v.date} · {v.times.join(", ")} · {v.isPartner ? "병원에서 연락드려요" : "글로우메이트가 확인 후 연락드려요"}
                    </div>
                  </div>
                </Link>
              ))}
              <p className="disc" style={{ margin: "8px 0 6px", lineHeight: 1.5 }}>
                연락을 못 받으셨다면 병원 상세의 전화 문의를 이용해주세요.
              </p>
            </div>
          </>
        )}

        <div className="kick" style={{ marginBottom: 8 }}>저장한 병원</div>
        {hospitals === null && <p className="sub" style={{ padding: "8px 0" }}>불러오는 중…</p>}
        {hospitals !== null && hospitals.length === 0 && (
          <div className="card" style={{ padding: 16 }}>
            <p className="sub" style={{ lineHeight: 1.55 }}>아직 저장한 병원이 없어요. 병원 상세에서 ♡를 눌러 저장해보세요.</p>
            <Link href="/hospitals" className="reset"><button className="btn ghost" style={{ marginTop: 10 }}>병원 찾기 →</button></Link>
          </div>
        )}
        {(hospitals ?? []).map((h) => (
          <Link key={h.id} href={`/hospital/${h.id}`} className="reset">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 2px", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, display: "flex", gap: 6, alignItems: "center" }}>
                  {h.name}
                  {h.isPartner && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "var(--coral)", padding: "2px 6px", borderRadius: 5 }}>파트너</span>}
                </div>
                <div className="sub" style={{ marginTop: 3 }}>{h.district}{h.doctorCount ? ` · 의사 ${h.doctorCount}명` : ""}</div>
              </div>
              <HeartButton hospitalId={h.id} />
            </div>
          </Link>
        ))}

        <div className="kick" style={{ margin: "20px 0 8px" }}>최근 견적</div>
        {estimates.length === 0 && (
          <div className="card" style={{ padding: 16 }}>
            <p className="sub" style={{ lineHeight: 1.55 }}>받아본 견적이 여기에 저장돼요.</p>
            <Link href="/estimate" className="reset"><button className="btn ghost" style={{ marginTop: 10 }}>1분 견적 받기 →</button></Link>
          </div>
        )}
        {estimates.map((e, i) => (
          <div key={i} className="estcard" style={{ marginBottom: 10, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="kick">{new Date(e.at).toLocaleDateString("ko-KR")}</span>
              {e.totalMin != null && <span className="price">{man(e.totalMin)}–{man(e.totalMax!)}만</span>}
            </div>
            <div style={{ marginTop: 8, fontSize: 14.5, fontWeight: 700 }}>
              {e.items.map((it) => it.nameKo).join(" + ")}
            </div>
            <Link href="/estimate" className="reset">
              <div className="sub" style={{ marginTop: 8, color: "var(--coral)", fontWeight: 700 }}>다시 견적 받기 →</div>
            </Link>
          </div>
        ))}

        <div className="kick" style={{ margin: "20px 0 8px" }}>내가 쓴 후기</div>
        <p className="disc" style={{ lineHeight: 1.6, marginBottom: 20 }}>
          후기는 완전 익명으로 저장돼서 목록을 보여드릴 수 없어요. 검수 후 2~3일 내 후기 탭에 공개돼요.
        </p>
      </div>
      <TabBar />
    </main>
  );
}
