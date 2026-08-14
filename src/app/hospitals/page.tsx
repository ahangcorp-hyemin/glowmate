"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TabBar from "@/components/TabBar";
import { REGIONS } from "@/lib/geo/region";
import { loadLoc, saveLoc } from "@/lib/geo/loc";
import { PROCEDURES } from "@/lib/catalog/procedures";
import type { NearbyHospital } from "@/lib/hospitals/types";
import { fetchNearbyHospitals, fetchRegionLabel } from "../estimate/actions";
import { searchHospitalsAction } from "./actions";

// 병원 찾기(공개 탐색) — 굿닥·모두닥 패턴:
//  · 위치는 자동(저장된 위치 → 즉시 목록, GPS 성공 시 갱신·저장)
//  · 지역 변경은 상단 '📍 동네 ▾' 필 하나로(칩 상시 노출 X)
//  · 시술 필터는 보조(가로 스크롤 한 줄), 리스트가 주인공

const won = (n: number) => n.toLocaleString();

export default function HospitalsBrowse() {
  const [loc, setLoc] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [ready, setReady] = useState(false);      // 초기 위치 결정 완료
  const [pickerOpen, setPickerOpen] = useState(false);
  const [proc, setProc] = useState("ulthera");
  const [rows, setRows] = useState<NearbyHospital[] | null>(null);
  const [q, setQ] = useState("");
  const [searchRows, setSearchRows] = useState<NearbyHospital[] | null>(null);

  // 병원명 검색(2자+, 디바운스). 검색 중엔 거리 목록 대신 전국 이름 매칭.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setSearchRows(null); return; }
    let alive = true;
    const t = setTimeout(() => {
      searchHospitalsAction(query).then((r) => { if (alive) setSearchRows(r); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const applyLoc = (lat: number, lng: number, label: string) => {
    setLoc({ lat, lng, label });
    if (label) saveLoc({ lat, lng, label });
    setPickerOpen(false);
  };

  // 초기: 저장된 위치로 즉시 시작 + GPS를 조용히 시도(성공하면 갱신·저장)
  useEffect(() => {
    const saved = loadLoc();
    if (saved) { setLoc(saved); setReady(true); }
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, label: "" }); setReady(true); },
        () => setReady(true),
        { timeout: 8000, maximumAge: 600000 }
      );
    } else setReady(true);
  }, []);

  // 좌표·시술 바뀌면 목록 로드(+역지오코딩 라벨 저장)
  useEffect(() => {
    if (!loc) return;
    let alive = true;
    setRows(null);
    fetchNearbyHospitals(loc.lat, loc.lng, proc).then((r) => { if (alive) setRows(r); });
    if (!loc.label) fetchRegionLabel(loc.lat, loc.lng).then((l) => {
      if (!alive || !l) return;
      setLoc((cur) => (cur ? { ...cur, label: l } : cur));
      saveLoc({ lat: loc.lat, lng: loc.lng, label: l });
    });
    return () => { alive = false; };
  }, [loc?.lat, loc?.lng, proc]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => applyLoc(p.coords.latitude, p.coords.longitude, ""),
      () => setPickerOpen(true),
      { timeout: 8000 }
    );
  };

  const procName = PROCEDURES.find((p) => p.id === proc)?.nameKo ?? "";

  return (
    <main className="shell" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      {/* 헤더: 타이틀 + 위치 필(탭하면 지역 패널) */}
      <div className="top">
        <div className="logo">병원 <span className="m">찾기</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Link href="/saved" className="reset" aria-label="내 활동">
            <span style={{ fontSize: 20, color: "var(--coral)" }}>♥</span>
          </Link>
          <button className="loc" style={{ border: "none", cursor: "pointer", fontFamily: "inherit" }}
            onClick={() => setPickerOpen((v) => !v)}>
            📍 {loc?.label || (loc ? "내 위치" : "위치 선택")} ▾
          </button>
        </div>
      </div>

      {/* 병원명 검색 */}
      <div className="pad" style={{ paddingBottom: 8 }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="🔎 찾는 병원 이름이 있나요?"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--line)", fontSize: 15, fontFamily: "inherit", background: "var(--white)" }}
        />
      </div>

      {searchRows !== null && (
        <div className="pad" style={{ flex: 1 }}>
          {searchRows.length === 0 && <p className="sub" style={{ padding: "12px 2px" }}>‘{q.trim()}’ 이름의 병원을 못 찾았어요. 철자를 확인해보세요.</p>}
          {searchRows.map((h) => (
            <Link key={h.id} href={`/hospital/${h.id}`} className="reset">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 2px", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{h.name}</div>
                  <div className="sub" style={{ marginTop: 3 }}>{h.district}{h.doctorCount ? ` · 의사 ${h.doctorCount}명` : ""}</div>
                </div>
                <span style={{ color: "var(--coral)", fontWeight: 900 }}>›</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 지역 패널(접이식) */}
      {searchRows === null && pickerOpen && (
        <div className="pad" style={{ paddingBottom: 12 }}>
          <div className="card" style={{ padding: 14 }}>
            <button className="btn ghost" style={{ marginBottom: 10 }} onClick={requestGps}>📍 내 위치로 찾기</button>
            <div className="chipwrap">
              {REGIONS.map((r) => (
                <button key={r.id} className={`chip${loc?.label === r.label ? " on" : ""}`}
                  onClick={() => applyLoc(r.lat, r.lng, r.label)}>{r.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="pad" style={{ flex: 1, display: searchRows !== null ? "none" : undefined }}>
        {/* 시술 필터(보조, 한 줄) */}
        <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "2px 0 10px", marginTop: 2 }}>
          {PROCEDURES.map((p) => (
            <button key={p.id} className={`chip${proc === p.id ? " on" : ""}`}
              style={{ whiteSpace: "nowrap", flexShrink: 0, fontSize: 13.5, padding: "9px 13px" }}
              onClick={() => setProc(p.id)}>{p.nameKo}</button>
          ))}
        </div>

        {/* 상태 */}
        {!loc && !ready && <p className="sub" style={{ padding: "18px 2px" }}>📍 내 위치를 확인하는 중…</p>}
        {!loc && ready && (
          <div style={{ padding: "18px 2px" }}>
            <p className="sub" style={{ marginBottom: 10 }}>위치를 허용하거나 동네를 골라주시면 가까운 순으로 보여드려요.</p>
            <button className="btn" onClick={requestGps}>📍 내 위치로 찾기</button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setPickerOpen(true)}>동네 직접 고르기</button>
          </div>
        )}
        {loc && rows === null && <p className="sub" style={{ padding: "18px 2px" }}>근처 병원을 불러오는 중…</p>}
        {loc && rows !== null && rows.length === 0 && (
          <p className="sub" style={{ padding: "18px 2px" }}>이 근처엔 등록된 병원이 없어요. 위쪽에서 동네를 바꿔보세요.</p>
        )}

        {/* 리스트(주인공) */}
        {rows?.map((h) => (
          <Link key={h.id} href={`/hospital/${h.id}`} className="reset">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "14px 2px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15.5, display: "flex", gap: 7, alignItems: "center" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                  {h.isAd && <span style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", background: "var(--chip)", padding: "2px 6px", borderRadius: 5, flexShrink: 0 }}>광고</span>}
                </div>
                <div className="sub" style={{ marginTop: 4 }}>
                  <b style={{ color: "var(--coral)" }}>{h.distanceKm.toFixed(1)}km</b>
                  {h.district ? ` · ${h.district}` : ""}{h.doctorCount != null ? ` · 의사 ${h.doctorCount}명` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                {h.price != null && (
                  <div>
                    <div className="price" style={{ fontSize: 15 }}>{won(h.price)}원</div>
                    <div className="disc">{procName}</div>
                  </div>
                )}
                <span style={{ color: "var(--faint)", fontSize: 18, fontWeight: 700 }}>›</span>
              </div>
            </div>
          </Link>
        ))}

        {rows !== null && rows.length > 0 && (
          <p className="disc" style={{ marginTop: 12, paddingBottom: 8, lineHeight: 1.6 }}>
            전국 2,791곳 · 출처: 건강보험심사평가원 공개데이터. 순위·추천이 아닌 거리순이며, 예약·건당 수수료를 받지 않아요(§27).
          </p>
        )}
        <div style={{ height: 12 }} />
      </div>
      <TabBar />
    </main>
  );
}
