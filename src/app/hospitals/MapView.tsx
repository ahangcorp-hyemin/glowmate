"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { NearbyHospital } from "@/lib/hospitals/types";
import { loadNaverMaps } from "@/lib/geo/naver";

// 지도 멀티핀 뷰 — 네이버 지도 v3(NCP). 핀 탭 → 하단 카드 → 상세.
// 그린 커스텀 핀(병원) + 내 위치 파란 점. 키 없으면 안내 폴백.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NMaps = any;

function pinIcon(nmaps: NMaps) {
  // SVG 그린 핀(글로우메이트 키컬러). anchor는 핀 끝(하단 중앙).
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="38" viewBox="0 0 30 38">` +
    `<path d="M15 37C15 37 27 22.5 27 14A12 12 0 1 0 3 14C3 22.5 15 37 15 37Z" fill="#12A15A" stroke="#0B7A43" stroke-width="1.5"/>` +
    `<circle cx="15" cy="14" r="4.6" fill="#fff"/></svg>`
  );
  return {
    url: `data:image/svg+xml;charset=UTF-8,${svg}`,
    size: new nmaps.Size(30, 38),
    scaledSize: new nmaps.Size(30, 38),
    anchor: new nmaps.Point(15, 37),
  };
}

export default function MapView({ rows, center }: { rows: NearbyHospital[]; center: { lat: number; lng: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<NMaps>(null);
  const markersRef = useRef<NMaps[]>([]);
  const [sel, setSel] = useState<NearbyHospital | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    loadNaverMaps().then(() => {
      if (disposed || !ref.current) return;
      const nmaps = (window.naver as { maps: NMaps }).maps;
      if (!mapRef.current) {
        mapRef.current = new nmaps.Map(ref.current, {
          center: new nmaps.LatLng(center.lat, center.lng),
          zoom: 14,
          zoomControl: false,
          mapDataControl: false,
          scaleControl: false,
          logoControlOptions: { position: nmaps.Position.BOTTOM_LEFT },
        });
      } else {
        mapRef.current.setCenter(new nmaps.LatLng(center.lat, center.lng));
      }
      const map = mapRef.current;

      // 기존 마커 제거
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];

      // 내 위치(파란 점)
      const me = new nmaps.Marker({
        position: new nmaps.LatLng(center.lat, center.lng),
        map,
        icon: {
          content: `<div style="width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2.5px solid #fff;box-shadow:0 0 0 1px #2563eb"></div>`,
          anchor: new nmaps.Point(7, 7),
        },
        zIndex: 50,
      });
      markersRef.current.push(me);

      // 병원 핀
      const icon = pinIcon(nmaps);
      for (const h of rows) {
        const marker = new nmaps.Marker({ position: new nmaps.LatLng(h.lat, h.lng), map, icon });
        nmaps.Event.addListener(marker, "click", () => setSel(h));
        markersRef.current.push(marker);
      }
    }).catch((e: Error) => { if (!disposed) setErr(e.message); });

    return () => { disposed = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => r.id).join(","), center.lat, center.lng]);

  return (
    <div style={{ position: "relative" }}>
      <div ref={ref} style={{ height: 420, borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)", background: "var(--chip)" }} />
      {err && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 20 }}>
          <p className="sub" style={{ textAlign: "center", lineHeight: 1.55 }}>지도를 불러오지 못했어요.<br />목록으로 보실 수 있어요.</p>
        </div>
      )}
      {sel && (
        <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, zIndex: 1000 }}>
          <Link href={`/hospital/${sel.id}`} className="reset">
            <div className="card elev" style={{ padding: 14, background: "var(--white)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, display: "flex", gap: 6, alignItems: "center" }}>
                    {sel.name}
                    {sel.isPartner && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "var(--key)", padding: "2px 6px", borderRadius: 5 }}>파트너</span>}
                  </div>
                  <div className="sub" style={{ marginTop: 3 }}>
                    {sel.distanceKm ? `${sel.distanceKm.toFixed(1)}km · ` : ""}{sel.district}
                    {sel.doctorCount ? ` · 의사 ${sel.doctorCount}명` : ""}
                  </div>
                </div>
                <span style={{ color: "var(--key-deep)", fontWeight: 900, fontSize: 18 }}>›</span>
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
