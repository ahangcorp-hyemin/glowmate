"use client";

import { useEffect, useState } from "react";
import { isHospitalSaved, toggleSavedHospital } from "@/lib/client/saved";

// 가입 없는 찜(이 기기에 저장). 병원 상세·목록 공용.
export default function HeartButton({ hospitalId, size = 22 }: { hospitalId: string; size?: number }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => { setSaved(isHospitalSaved(hospitalId)); }, [hospitalId]);
  return (
    <button
      aria-label={saved ? "저장 해제" : "병원 저장"}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSaved(toggleSavedHospital(hospitalId)); }}
      style={{ background: "none", border: "none", cursor: "pointer", fontSize: size, lineHeight: 1, padding: 4, color: saved ? "var(--coral)" : "var(--faint)" }}
    >
      {saved ? "♥" : "♡"}
    </button>
  );
}
