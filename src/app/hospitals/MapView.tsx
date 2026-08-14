"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import type { NearbyHospital } from "@/lib/hospitals/types";

// 지도 멀티핀 뷰(미모먼트 패턴) — Leaflet+OSM(키 불필요). 핀 탭 → 하단 카드 → 상세.

export default function MapView({ rows, center }: { rows: NearbyHospital[]; center: { lat: number; lng: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const [sel, setSel] = useState<NearbyHospital | null>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !ref.current || mapRef.current) return;
      const map = L.map(ref.current, { zoomControl: false }).setView([center.lat, center.lng], 14);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      L.circleMarker([center.lat, center.lng], { radius: 7, color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.9 })
        .addTo(map).bindTooltip("내 위치");
      for (const h of rows) {
        const m = L.circleMarker([h.lat, h.lng], {
          radius: 9, color: "#E84E30", weight: 2, fillColor: "#F0563C", fillOpacity: 0.85,
        }).addTo(map);
        m.on("click", () => setSel(h));
      }
    })();
    return () => { disposed = true; mapRef.current?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => r.id).join(","), center.lat, center.lng]);

  return (
    <div style={{ position: "relative" }}>
      <div ref={ref} style={{ height: 420, borderRadius: 16, overflow: "hidden", border: "1px solid var(--line)" }} />
      {sel && (
        <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, zIndex: 1000 }}>
          <Link href={`/hospital/${sel.id}`} className="reset">
            <div className="card" style={{ padding: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.14)", background: "var(--white)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, display: "flex", gap: 6, alignItems: "center" }}>
                    {sel.name}
                    {sel.isPartner && <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "var(--coral)", padding: "2px 6px", borderRadius: 5 }}>파트너</span>}
                  </div>
                  <div className="sub" style={{ marginTop: 3 }}>
                    {sel.distanceKm ? `${sel.distanceKm.toFixed(1)}km · ` : ""}{sel.district}
                    {sel.doctorCount ? ` · 의사 ${sel.doctorCount}명` : ""}
                  </div>
                </div>
                <span style={{ color: "var(--coral)", fontWeight: 900, fontSize: 18 }}>›</span>
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
