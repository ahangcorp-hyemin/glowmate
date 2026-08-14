"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TabBar from "@/components/TabBar";
import { REGIONS } from "@/lib/geo/region";
import { PROCEDURES } from "@/lib/catalog/procedures";
import type { NearbyHospital } from "@/lib/hospitals/types";
import { fetchNearbyHospitals, fetchRegionLabel } from "../estimate/actions";

// 병원 탐색 뷰(공개) — 견적 플로우와 무관하게 그냥 둘러보는 진입점.
// GPS 우선, 실패 시 지역 선택. 시술 필터는 공개가(있으면) 표시용.

const won = (n: number) => n.toLocaleString();

export default function HospitalsBrowse() {
  const [loc, setLoc] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [geoTried, setGeoTried] = useState(false);
  const [proc, setProc] = useState("ulthera");
  const [rows, setRows] = useState<NearbyHospital[] | null>(null);

  // 최초: 위치 시도(거부해도 지역칩으로 계속)
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { setGeoTried(true); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, label: "" }); setGeoTried(true); },
      () => setGeoTried(true),
      { timeout: 8000, maximumAge: 600000 }
    );
  }, []);

  // 좌표·시술 바뀌면 목록 로드
  useEffect(() => {
    if (!loc) return;
    let alive = true;
    setRows(null);
    fetchNearbyHospitals(loc.lat, loc.lng, proc).then((r) => { if (alive) setRows(r); });
    if (!loc.label) fetchRegionLabel(loc.lat, loc.lng).then((l) => { if (alive && l) setLoc((cur) => (cur ? { ...cur, label: l } : cur)); });
    return () => { alive = false; };
  }, [loc?.lat, loc?.lng, proc]); // eslint-disable-line react-hooks/exhaustive-deps

  const procName = PROCEDURES.find((p) => p.id === proc)?.nameKo ?? "";

  return (
    <main className="shell" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <div className="top">
        <div className="logo">병원 <span className="m">탐색</span></div>
        {loc?.label && <div className="loc">📍 {loc.label}</div>}
      </div>
      <div className="pad" style={{ flex: 1 }}>
        <p className="sub" style={{ margin: "2px 0 12px", lineHeight: 1.55 }}>
          전국 피부과·성형외과 2,791곳 — 공공데이터 기반, 광고 순위 없이 가까운 순이에요.
        </p>

        {/* 지역 */}
        <div className="chipwrap" style={{ marginBottom: 10 }}>
          {REGIONS.map((r) => (
            <button key={r.id} className={`chip${loc?.label === r.label ? " on" : ""}`}
              onClick={() => setLoc({ lat: r.lat, lng: r.lng, label: r.label })}>{r.label}</button>
          ))}
        </div>

        {/* 시술 필터 */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 8 }}>
          {PROCEDURES.map((p) => (
            <button key={p.id} className={`chip${proc === p.id ? " on" : ""}`} style={{ whiteSpace: "nowrap", flexShrink: 0 }}
              onClick={() => setProc(p.id)}>{p.nameKo}</button>
          ))}
        </div>

        {!loc && geoTried && <p className="sub" style={{ padding: "16px 2px" }}>위쪽에서 지역을 골라주세요. 위치를 허용하면 내 주변부터 보여드려요.</p>}
        {!loc && !geoTried && <p className="sub" style={{ padding: "16px 2px" }}>📍 내 위치를 확인하는 중…</p>}
        {loc && rows === null && <p className="sub" style={{ padding: "16px 2px" }}>근처 병원을 불러오는 중…</p>}
        {loc && rows !== null && rows.length === 0 && (
          <p className="sub" style={{ padding: "16px 2px" }}>이 근처엔 등록된 병원이 없어요. 다른 지역을 골라보세요.</p>
        )}

        {rows?.map((h) => (
          <Link key={h.id} href={`/hospital/${h.id}`} className="reset">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 2px", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, display: "flex", gap: 7, alignItems: "center" }}>
                  {h.name}
                  {h.isAd && <span style={{ fontSize: 10, fontWeight: 800, color: "var(--muted)", background: "var(--chip)", padding: "2px 6px", borderRadius: 5 }}>광고</span>}
                </div>
                <div className="sub" style={{ marginTop: 4 }}>
                  {h.distanceKm.toFixed(1)}km{h.district ? ` · ${h.district}` : ""}{h.doctorCount != null ? ` · 의사 ${h.doctorCount}명` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                {h.price != null
                  ? <><div className="price" style={{ fontSize: 16 }}>{won(h.price)}</div><div className="disc">원 · {procName}</div></>
                  : <span className="sub" style={{ fontWeight: 700 }}>문의 ›</span>}
              </div>
            </div>
          </Link>
        ))}

        {rows !== null && rows.length > 0 && (
          <p className="disc" style={{ marginTop: 12, paddingBottom: 8, lineHeight: 1.6 }}>
            출처: 건강보험심사평가원 공개데이터. 순위·추천이 아닌 거리순 나열이며, 예약·시술 건당 수수료를 받지 않아요(§27).
          </p>
        )}
        <div style={{ height: 12 }} />
      </div>
      <TabBar />
    </main>
  );
}
