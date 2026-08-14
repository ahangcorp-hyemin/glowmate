"use client";

// 가입 없는 '내 활동' — localStorage (우리 원칙: 연락처·계정 최소화. 이 기기에서만 유지됨을 UI에 고지)

const H_KEY = "glowmate.savedHospitals";
const E_KEY = "glowmate.recentEstimates";

export function getSavedHospitalIds(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(H_KEY) ?? "[]"); } catch { return []; }
}

export function isHospitalSaved(id: string): boolean {
  return getSavedHospitalIds().includes(id);
}

/** 토글 후 저장 여부 반환. */
export function toggleSavedHospital(id: string): boolean {
  const ids = getSavedHospitalIds();
  const has = ids.includes(id);
  const next = has ? ids.filter((x) => x !== id) : [id, ...ids].slice(0, 50);
  localStorage.setItem(H_KEY, JSON.stringify(next));
  return !has;
}

export interface EstimateSnapshot {
  at: string; // ISO
  concerns: string[];
  items: { nameKo: string; role: string; priceMin: number; priceMax: number }[];
  totalMin: number | null;
  totalMax: number | null;
}

export function saveEstimateSnapshot(s: EstimateSnapshot) {
  if (typeof window === "undefined") return;
  try {
    const list: EstimateSnapshot[] = JSON.parse(localStorage.getItem(E_KEY) ?? "[]");
    localStorage.setItem(E_KEY, JSON.stringify([s, ...list].slice(0, 5)));
  } catch { /* ignore */ }
}

export function getEstimateSnapshots(): EstimateSnapshot[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(E_KEY) ?? "[]"); } catch { return []; }
}
